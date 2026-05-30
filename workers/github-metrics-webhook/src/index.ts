import { Hono } from 'hono';

type Bindings = {
	GITHUB_WEBHOOK_SECRET: string;
	DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

async function verifySignature(secret: string, header: string, payload: string): Promise<boolean> {
	if (!header.startsWith("sha256=")) return false;
	const signatureFromGithub = header.substring(7);

	const encoder = new TextEncoder();
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

	const calculatedSignature = Array.from(new Uint8Array(signedBuffer))
		.map(b => b.toString(16).padStart(2, "0"))
		.join("");

	// 提示：生产环境若追求极致防时序攻击，可改用 crypto.subtle.verify()，但目前的直接比对在大多数 Webhook 场景也足够
	return calculatedSignature === signatureFromGithub;
}

// 2. Hono Webhook 路由
app.post('/api/webhooks/github', async (c) => {
	const githubEvent = c.req.header("X-GitHub-Event");
	const signatureHeader = c.req.header("X-Hub-Signature-256");

	if (!githubEvent || !signatureHeader) {
		return c.json({ success: false, error: "Missing required GitHub headers" }, 400);
	}

	const rawBody = await c.req.text();

	const isValid = await verifySignature(c.env.GITHUB_WEBHOOK_SECRET, signatureHeader, rawBody);
	if (!isValid) {
		return c.text("Unauthorized: Invalid webhook signature", 401);
	}

	try {
		const body = JSON.parse(rawBody);

		const action = body.action || null;
		const repoName = body.repository?.full_name || null;
		const sender = body.sender?.login || null;
		const installationId = body.installation?.id || null;

		// 实现异步非阻塞写入 D1
		c.executionCtx.waitUntil(
			c.env.DB.prepare(
				`INSERT INTO github_app_metrics (event_type, action, repository_name, sender_login, installation_id, payload)
                 VALUES (?, ?, ?, ?, ?, ?)`
			)
				.bind(githubEvent, action, repoName, sender, installationId, rawBody)
				.run()
				.then(() => console.log(`Successfully stored GitHub event: ${githubEvent}`))
				.catch(err => console.error("D1 storage failed in background:", err.message))
		);

		return c.json({
			success: true,
			message: "Webhook accepted and queued for storage"
		}, 202);

	} catch (error: any) {
		return c.json({ success: false, error: "Malformed JSON payload" }, 400);
	}
});

export default app;
