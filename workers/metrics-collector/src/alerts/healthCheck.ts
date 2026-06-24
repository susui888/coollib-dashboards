// src/services/checkSpringHealth.ts
// Code snippet is entirely in English as requested

import { Env } from '../types';

export async function checkSpringHealth(env: Env, ctx: ExecutionContext): Promise<void> {
	const healthUrl = "https://coollib.ryansu.uk/actuator/health";
	let isHealthy = false;
	let errorMessage = "";

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000);

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
		errorMessage = err.name === 'AbortError' ? 'Connection timeout (10s)' : err.message;
	}

	try {
		if (!isHealthy) {
			console.warn(`[Probe] Spring Boot Unhealthy: ${errorMessage}`);

			// Fetch the active alert to prevent flooding
			const activeAlert = await env.DB.prepare(
				"SELECT id FROM incidents WHERE component = 'spring-boot' AND status = 'active' LIMIT 1"
			).first<{ id: string }>();

			// 🚨 Case 1: First time failing -> Create D1 entry and fire PagerDuty phone alert
			if (!activeAlert) {
				const incidentId = crypto.randomUUID();

				await env.DB.prepare(`
                    INSERT INTO incidents (id, source, component, level, title, message, status)
                    VALUES (?, 'INFRA', 'spring-boot', 'CRITICAL', 'Spring Boot Server Unreachable', ?, 'active')
                `).bind(incidentId, errorMessage).run();

				// Use the exact D1 incidentId as the PagerDuty dedup_key
				ctx.waitUntil(syncWithPagerDuty(env, "trigger", incidentId, errorMessage));
			}
		} else {
			// 🚨 Case 2: System recovered -> Auto-resolve in both D1 and PagerDuty
			const activeAlert = await env.DB.prepare(
				"SELECT id FROM incidents WHERE component = 'spring-boot' AND status = 'active' LIMIT 1"
			).first<{ id: string }>();

			if (activeAlert) {
				console.log(`[Probe] Spring Boot recovered. Mitigating active incident: ${activeAlert.id}`);
				const currentTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

				// 1. Shift state in D1 so React Query updates the frontend instantly
				await env.DB.prepare(`
                    UPDATE incidents
                    SET status = 'resolved', resolved_at = ?
                    WHERE id = ?
                `).bind(currentTimestamp, activeAlert.id).run();

				// 2. Fire "resolve" event using the same incidentId to stop the mobile page call!
				ctx.waitUntil(syncWithPagerDuty(env, "resolve", activeAlert.id, "System recovery verified by actuator probe."));
			}
		}
	} catch (dbErr: any) {
		console.error("Failed to sync incident pipeline states:", dbErr.message);
	}
}

/**
 * Robust Lifecycle Communicator with PagerDuty Events API V2
 */
async function syncWithPagerDuty(
	env: Env,
	action: "trigger" | "resolve",
	dedupKey: string,
	detail: string
): Promise<void> {
	if (!env.PAGERDUTY_INTEGRATION_KEY) return;

	try {
		const response = await fetch("https://events.eu.pagerduty.com/v2/enqueue", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				routing_key: env.PAGERDUTY_INTEGRATION_KEY,
				event_action: action,              // "trigger" to raise alarm, "resolve" to clear it
				dedup_key: dedupKey,               // Ties the trigger and recovery together flawlessly
				payload: {
					summary: action === "trigger"
						? "[CoolLib Infra] Spring Boot Server is DOWN!"
						: "[CoolLib Infra] Spring Boot Server has RECOVERED",
					source: "cloudflare-worker-health-monitor",
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
			console.log(`[PagerDuty] Successfully sent [${action}] signal for incident fingerprint: ${dedupKey}`);
		}
	} catch (err: any) {
		console.error("Network failure routing payload to PagerDuty Events ingress:", err.message);
	}
}
