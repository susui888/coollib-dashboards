export interface Env {
	GITHUB_WEBHOOK_SECRET: string;
	DB: D1Database;
}

async function verifySignature(secret: string, header: string, payload: string): Promise<boolean> {
	if (!header.startsWith("sha256=")) return false;
	const signatureFromGithub = header.substring(7);

	const encoder = new TextEncoder();
	// Fix: Added both "sign" and "verify" to satisfy the Web Crypto runtime constraints
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"]
	);

	const signedBuffer = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(payload)
	);

	// Convert directly to hex string for reliable constant-time comparison
	const calculatedSignature = Array.from(new Uint8Array(signedBuffer))
		.map(b => b.toString(16).padStart(2, "0"))
		.join("");

	return calculatedSignature === signatureFromGithub;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		const githubEvent = request.headers.get("X-GitHub-Event");
		const signatureHeader = request.headers.get("X-Hub-Signature-256");

		if (!githubEvent || !signatureHeader) {
			return new Response("Bad Request: Missing required GitHub headers", { status: 400 });
		}

		const rawBody = await request.text();

		const isValid = await verifySignature(env.GITHUB_WEBHOOK_SECRET, signatureHeader, rawBody);
		if (!isValid) {
			return new Response("Unauthorized: Invalid webhook signature", { status: 401 });
		}

		try {
			const body = JSON.parse(rawBody);

			const action = body.action || null;
			const repoName = body.repository?.full_name || null;
			const sender = body.sender?.login || null;
			const installationId = body.installation?.id || null;

			ctx.waitUntil(
				env.DB.prepare(
					`INSERT INTO github_app_metrics (event_type, action, repository_name, sender_login, installation_id, payload)
					 VALUES (?, ?, ?, ?, ?, ?)`
				)
					.bind(
						githubEvent,
						action,
						repoName,
						sender,
						installationId,
						rawBody
					)
					.run()
			);

			return new Response(JSON.stringify({ success: true, message: "Webhook accepted and queued for storage" }), {
				status: 202,
				headers: { "Content-Type": "application/json" },
			});

		} catch (error: any) {
			return new Response(JSON.stringify({ success: false, error: error.message }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	},
};
