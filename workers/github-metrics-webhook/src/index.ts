// src/components/analytics/webhook.ts
// Code snippet is entirely in English as requested

import { Hono } from 'hono';

type Bindings = {
	GITHUB_WEBHOOK_SECRET: string;
	PAGERDUTY_INTEGRATION_KEY: string; // Added for routing live alerts
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

	return calculatedSignature === signatureFromGithub;
}

// 1. Core Lifecycle Communicator with PagerDuty Events API V2
async function syncWithPagerDuty(
	integrationKey: string | undefined,
	action: "trigger" | "resolve",
	dedupKey: string,
	summary: string,
	detail: string
): Promise<void> {
	if (!integrationKey) return;

	try {
		const response = await fetch("https://events.eu.pagerduty.com/v2/enqueue", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				routing_key: integrationKey,
				event_action: action,              // "trigger" to sound alarm, "resolve" to close it
				dedup_key: dedupKey,               // Ties workflow failure and success together via Run ID
				payload: {
					summary: summary,
					source: "github-webhook-pipeline-monitor",
					severity: "critical",
					custom_details: {
						telemetry: detail,
						timestamp: new Date().toISOString()
					}
				}
			})
		});

		if (!response.ok) {
			const errText = await response.text();
			console.error(`PagerDuty API replied with error status [${response.status}]: ${errText}`);
		} else {
			console.log(`[PagerDuty] Dispatched [${action}] signal for fingerprint: ${dedupKey}`);
		}
	} catch (err: any) {
		console.error("Network failure routing payload to PagerDuty:", err.message);
	}
}

// 2. Pipeline executor for updating the core incidents dashboard table and triggering alerts
// src/components/analytics/webhook.ts
// Code snippet is entirely in English as requested

async function handleIncidentPipeline(db: D1Database, integrationKey: string | undefined, eventType: string, body: any): Promise<void> {
	if (eventType !== 'workflow_run' || body.action !== 'completed') {
		return;
	}

	const run = body.workflow_run;
	if (!run || !body.workflow) return;

	// 🔥 FIX: Generate a deterministic, component-scoped fingerprint instead of using ephemeral run.id
	const repoName = body.repository?.name || run.repository?.name; // "coollib-android"
	const workflowId = body.workflow.id; // 252275559
	const incidentId = `gh-pipeline-${repoName}-${workflowId}`; // Formulates: gh-pipeline-coollib-android-252275559

	// Case 1: The build failed -> Upsert an Active Incident using the component-scoped ID
	if (run.conclusion === 'failure') {
		const shortSha = run.head_commit?.id?.substring(0, 7) || 'unknown';
		const commitMsg = run.head_commit?.message || 'No commit message';
		const authorName = run.head_commit?.author?.name || run.actor?.login || 'unknown';
		const formattedDate = run.updated_at ? run.updated_at.replace('T', ' ').replace('Z', '') : new Date().toISOString();

		const title = `GitHub CI/CD Pipeline Failure: ${run.name} #${run.run_number}`;

		// Include the specific Run ID inside the contextual description metadata for frontend hyperlink references
		const message = `Commit '${commitMsg}' (${shortSha}) by ${authorName} triggered a failure in run #${run.run_number}. Review logs at: ${run.html_url}`;

		// ON CONFLICT(id) will gracefully reset the row to 'active' if a brand new different run fails again
		await db.prepare(`
			INSERT INTO incidents (id, source, component, level, title, message, status, created_at, resolved_at)
			VALUES (?, 'GITHUB', ?, 'CRITICAL', ?, ?, 'active', ?, NULL)
				ON CONFLICT(id) DO UPDATE SET
				title = excluded.title,
									   message = excluded.message,
									   status = 'active',
									   created_at = excluded.created_at,
									   resolved_at = NULL;
		`).bind(incidentId, repoName, title, message, formattedDate).run();

		console.log(`[Alert] Active component-scoped incident registered/updated: ${incidentId}`);

		// Trigger PagerDuty using the shared component dedup_key
		await syncWithPagerDuty(
			integrationKey,
			"trigger",
			incidentId,
			`[CI/CD Failure] ${repoName} #${run.run_number} failed!`,
			message
		);
	}
	// Case 2: The build succeeded -> Now we can locate and resolve the active incident perfectly!
	else if (run.conclusion === 'success') {
		const formattedDate = run.updated_at ? run.updated_at.replace('T', ' ').replace('Z', '') : new Date().toISOString();

		// Atomically transition the specific pipeline tracker to resolved
		const result = await db.prepare(`
			UPDATE incidents
			SET status = 'resolved', resolved_at = ?
			WHERE id = ? AND status = 'active';
		`).bind(formattedDate, incidentId).run();

		// Only dispatch PagerDuty resolution if there was an actual open failure caught in D1
		if (result.meta.changes > 0) {
			console.log(`[Recovery] Active component pipeline auto-mitigated in D1: ${incidentId}`);

			const summary = `[CI/CD Fixed] ${repoName} pipeline recovered in run #${run.run_number}`;
			const detail = `Workflow run #${run.run_number} succeeded for commit: ${run.head_commit?.message || ''}. Tracked via token: ${incidentId}`;

			// Send the identical component-scoped id to close out the PagerDuty mobile page alert session
			await syncWithPagerDuty(integrationKey, "resolve", incidentId, summary, detail);
		}
	}
}

// 3. Hono Webhook Route
app.post('/api/webhooks/github', async (c) => {
	const githubEvent = c.req.header("X-GitHub-Event");
	const signatureHeader = c.req.header("X-Hub-Signature-256");

	if (!githubEvent || !signatureHeader) {
		return c.json({ success: false, error: "Missing required GitHub headers" }, 400);
	}

	const rawBody = await c.req.raw.clone().text();

	const isValid = await verifySignature(c.env.GITHUB_WEBHOOK_SECRET, signatureHeader, rawBody);
	if (!isValid) {
		return c.text("Unauthorized: Invalid webhook signature", 401);
	}

	try {
		const body = JSON.parse(rawBody);

		const action = body.action || null;
		const repoFullName = body.repository?.full_name || null;
		const sender = body.sender?.login || null;
		const installationId = body.installation?.id || null;

		c.executionCtx.waitUntil(
			Promise.all([
				// 1. Audit Log Stream
				c.env.DB.prepare(
					`INSERT INTO github_app_metrics (event_type, action, repository_name, sender_login, installation_id, payload)
                      VALUES (?, ?, ?, ?, ?, ?)`
				)
					.bind(githubEvent, action, repoFullName, sender, installationId, rawBody)
					.run()
					.then(() => console.log(`Stored raw metrics for event: ${githubEvent}`)),

				// 2. State Triage & Alert Management Pipeline
				handleIncidentPipeline(c.env.DB, c.env.PAGERDUTY_INTEGRATION_KEY, githubEvent, body)
			])
				.catch(err => console.error("Database background operations encountered an error:", err.message))
		);

		return c.json({
			success: true,
			message: "Webhook accepted and background pipelines dispatched"
		}, 202);

	} catch (error: any) {
		return c.json({ success: false, error: "Malformed JSON payload" }, 400);
	}
});

export default app;
