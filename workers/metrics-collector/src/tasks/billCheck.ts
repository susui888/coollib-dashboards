// src/billCheck.ts
// Code snippet is entirely in English as requested
// wrangler d1 execute coollib --remote --command "UPDATE incidents SET status = 'resolved' WHERE component = 'cloudflare-billing';"

import { Env } from '../types';

function formatMetrics(num: number): string {
	if (num < 1000) {
		return num.toString();
	} else if (num < 1000000) {
		return (num / 1000).toFixed(1) + 'K';
	} else {
		return (num / 1000000).toFixed(2) + 'M';
	}
}

export async function executeBillingSentinelPoll(env: Env, batchStatements: any[]): Promise<void> {
	const now = new Date();
	const todayStr = now.toISOString().substring(0, 10);

	try {
		const graphqlEndpoint = "https://api.cloudflare.com/client/v4/graphql";
		const twentyFourHoursAgoISO = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

		const query = `
          query GetD1Usage($accountId: String!, $databaseId: String!, $startTime: Time!) {
            viewer {
              accounts(filter: { accountTag: $accountId }) {
                d1AnalyticsAdaptiveGroups(
                  filter: { databaseId: $databaseId, datetime_geq: $startTime },
                  limit: 1
                ) {
                  sum {
                    rowsRead
                    rowsWritten
                    readQueries
                  }
                }
              }
            }
          }
        `;

		const response = await fetch(graphqlEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`
			},
			body: JSON.stringify({
				query: query,
				variables: {
					accountId: env.CLOUDFLARE_ACCOUNT_ID,
					databaseId: env.CLOUDFLARE_D1_DATABASE_ID,
					startTime: twentyFourHoursAgoISO
				}
			})
		});

		if (!response.ok) {
			throw new Error(`GraphQL connection downstream abort: ${response.status}`);
		}

		const result = await response.json() as any;
		console.log(`[RAW GRAPHQL RESPONSE]: ${JSON.stringify(result)}`);

		const metrics = result?.data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups?.[0]?.sum;

		const rowsReadCount = metrics?.rowsRead || 0;
		const rowsWrittenCount = metrics?.rowsWritten || 0;
		const totalRequests = metrics?.readQueries || 0;

		// 📝 Log with formatted counters for readability
		console.log(`[TELEMETRY LOG] Verified Cloudflare Ground-Truth -> Rows Read: ${formatMetrics(rowsReadCount)}, Rows Written: ${formatMetrics(rowsWrittenCount)}, Total Read Queries: ${totalRequests}`);

		let alertLevel: "WARNING" | "CRITICAL" | "FATAL" | null = null;

		if (rowsReadCount >= 4000000) {
			alertLevel = "FATAL";
		} else if (rowsReadCount >= 2000000) {
			alertLevel = "CRITICAL";
		} else if (rowsReadCount >= 500000) {
			alertLevel = "WARNING";
		}

		const formattedRead = formatMetrics(rowsReadCount);

		if (alertLevel !== null) {
			console.warn(`[BREACH DETECTED] Threshold activated: ${alertLevel}`);

			const incidentId = `billing-breach-${alertLevel}-${todayStr}`;
			const title = `D1 Quota Consumption Alert [Level: ${alertLevel}]`;
			const message = `Cloudflare GraphQL audit logged ${formattedRead} rows read within the tracking cycle, breaching the ${alertLevel} marker.`;

			const incidentStmt = env.DB.prepare(`
				INSERT INTO incidents (id, source, component, level, title, message, status)
				VALUES (?, 'INFRA', 'cloudflare-billing', ?, ?, ?, 'active')
					ON CONFLICT(id) DO UPDATE SET message = ?;
			`).bind(incidentId, alertLevel, title, message, message);

			batchStatements.push(incidentStmt);

			// Pass the pre-formatted string to guarantee uniform alert visualization
			routeToPagerDuty(env.PAGERDUTY_INTEGRATION_KEY, alertLevel, formattedRead);
		} else {
			console.log(`[STATUS NOMINAL] D1 query consumption profiles remain safely below the 50K boundary marker. Current: ${formattedRead}`);
		}

	} catch (err: any) {
		console.error(`[SENTINEL EXCEPTION] Run loop aborted: ${err.message}`);
	}
}

async function routeToPagerDuty(integrationKey: string, severityLevel: string, formattedRead: string): Promise<void> {
	if (!integrationKey) return;
	const pdSeverity = severityLevel === "WARNING" ? "warning" : severityLevel === "CRITICAL" ? "error" : "critical";
	const dedupKey = `billing-quota-breach-${severityLevel.toLowerCase()}`;

	try {
		await fetch("https://events.eu.pagerduty.com/v2/enqueue", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				routing_key: integrationKey,
				event_action: "trigger",
				dedup_key: dedupKey,
				payload: {
					// 💡 VISUAL OPTIMIZATION: Display readable metric scale directly in PagerDuty notifications
					summary: `[${severityLevel}] D1 Overconsumption: ${formattedRead} Rows Intercepted`,
					source: "cloudflare-graphql-sentinel",
					severity: pdSeverity,
					custom_details: {
						scanned_rows_read: formattedRead,
						timestamp: new Date().toISOString()
					}
				}
			})
		});
	} catch (pdErr: any) {
		console.error(`[PAGERDUTY INTERRUPT] ${pdErr.message}`);
	}
}
