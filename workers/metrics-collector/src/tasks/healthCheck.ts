import { Env } from '../types';

export async function checkSpringHealth(env: Env, ctx: ExecutionContext): Promise<void> {
	// 1. Target the standard Spring Boot Actuator health endpoint
	const healthUrl = "https://coollib.ryansu.uk/actuator/health";

	let isHealthy = false;
	let errorMessage = "";

	try {
		// Fetch with a strict timeout (e.g., 5 seconds) to catch frozen/unresponsive instances
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		const response = await fetch(healthUrl, { signal: controller.signal });
		clearTimeout(timeoutId);

		if (response.ok) {
			const data = await response.json() as { status: string };
			if (data.status === "UP") {
				isHealthy = true;
			} else {
				errorMessage = `Spring Actuator status is: ${data.status}`;
			}
		} else {
			errorMessage = `HTTP Server Error: ${response.status}`;
		}
	} catch (err: any) {
		errorMessage = err.name === 'AbortError' ? 'Connection timeout (5s)' : err.message;
	}

	// 2. Lifecycle Sync with D1 Database
	try {
		if (!isHealthy) {
			console.warn(`Spring Boot Unhealthy: ${errorMessage}`);

			// Check if there is already an active incident to prevent flooding
			const activeAlert = await env.DB.prepare(
				"SELECT id FROM incidents WHERE component = 'spring-boot' AND status = 'active' LIMIT 1"
			).first();

			if (!activeAlert) {
				const incidentId = crypto.randomUUID();

				// Log the active incident into D1
				await env.DB.prepare(`
                    INSERT INTO incidents (id, source, component, level, title, message)
                    VALUES (?, 'INFRA', 'spring-boot', 'CRITICAL', 'Spring Boot Server Unreachable', ?)
                `).bind(incidentId, errorMessage).run();

				// Dispatches real-time notification to your PagerDuty mobile app / Telegram Bot
				ctx.waitUntil(triggerPagerDutyAlert(env, errorMessage));
			}
		} else {
			// System is healthy: Auto-resolve any existing active alert
			const activeAlert = await env.DB.prepare(
				"SELECT id FROM incidents WHERE component = 'spring-boot' AND status = 'active' LIMIT 1"
			).first();

			if (activeAlert) {
				console.log("Spring Boot recovered. Resolving active incidents.");
				const currentTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

				await env.DB.prepare(`
                    UPDATE incidents
                    SET status = 'resolved', resolved_at = ?
                    WHERE component = 'spring-boot' AND status = 'active'
                `).bind(currentTimestamp).run();
			}
		}
	} catch (dbErr: any) {
		console.error("Failed to sync incident state with D1:", dbErr.message);
	}
}

// Helper function to dispatch alerts to PagerDuty or Telegram
async function triggerPagerDutyAlert(env: Env, errorDetail: string): Promise<void> {
	if (!env.PAGERDUTY_INTEGRATION_KEY) return;

	try {
		await fetch("https://events.eu.pagerduty.com/v2/enqueue", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				routing_key: env.PAGERDUTY_INTEGRATION_KEY,
				event_action: "trigger",
				payload: {
					summary: "[CoolLib Infra] Spring Boot Server is DOWN!",
					source: "cloudflare-worker-health-monitor",
					severity: "critical",
					custom_details: { error: errorDetail }
				}
			})
		});
	} catch (err: any) {
		console.error("Failed to route alert payload to PagerDuty:", err.message);
	}
}
