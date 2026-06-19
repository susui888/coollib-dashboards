// src/services/testIncidentAlert.ts
import { Env } from '../types';

interface IncidentRow {
    id: string;
    level: string;
    title: string;
    message: string;
}

/**
 * Checks for active 'spring-boot-test' incidents in D1 and escalates to PagerDuty
 */
export async function alertForTestIncident(env: Env, ctx: ExecutionContext): Promise<{ success: boolean; message: string }> {
    // 1. Safeguard check for PagerDuty integration key
    if (!env.PAGERDUTY_INTEGRATION_KEY) {
        console.error("[Alert] Missing PagerDuty integration routing key in environment variables.");
        return { success: false, message: "PagerDuty key is unconfigured." };
    }

    try {
        // 2. Select the active incident bound to the test component
        const activeTestAlert = await env.DB.prepare(`
            SELECT id, level, title, message
            FROM incidents
            WHERE component = 'spring-boot-test'
              AND status = 'active'
            LIMIT 1
        `).first<IncidentRow>();

        if (!activeTestAlert) {
            console.log("[Alert] No active incident found for component 'spring-boot-test'.");
            return { success: true, message: "No active 'spring-boot-test' incident found." };
        }

        console.warn(`[Alert] Found active test incident [${activeTestAlert.id}]. Dispatching to PagerDuty...`);

        // 3. Construct and dispatch the PagerDuty Event V2 payload
        const pdPayload = {
            routing_key: env.PAGERDUTY_INTEGRATION_KEY,
            event_action: "trigger",
            dedup_key: activeTestAlert.id, // Ensures continuity if resolved later
            payload: {
                summary: `[Mock Chaos] ${activeTestAlert.title}`,
                source: "cloudflare-worker-test-executor",
                severity: activeTestAlert.level.toLowerCase() === 'critical' ? 'critical' : 'error',
                component: "spring-boot-test",
                custom_details: {
                    incident_id: activeTestAlert.id,
                    database_log: activeTestAlert.message,
                    triggered_at: new Date().toISOString()
                }
            }
        };

        // 4. Fire the webhook request off asynchronously using ctx.waitUntil to avoid blocking the user response
        ctx.waitUntil(
            fetch("https://events.eu.pagerduty.com/v2/enqueue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pdPayload)
            })
            .then(async (res) => {
                if (!res.ok) {
                    const errorText = await res.text();
                    console.error(`[PagerDuty Error] Status [${res.status}]: ${errorText}`);
                } else {
                    console.log(`[PagerDuty Success] Alert fired flawlessly for deduplication key: ${activeTestAlert.id}`);
                }
            })
            .catch((err) => {
                console.error("[PagerDuty Network Failure] Failed to route endpoint payload:", err.message);
            })
        );

        return {
            success: true,
            message: `Active incident [${activeTestAlert.id}] dispatched to PagerDuty telemetry stream.`
        };

    } catch (dbError: any) {
        console.error("[SQL Error] Failed to fetch target test incident from D1:", dbError.message);
        return { success: false, message: `Database execution failed: ${dbError.message}` };
    }
}
