import { Hono } from 'hono';
import { Env } from './types';
import { prepareStatsTasks } from './tasks/stats';
import { prepareActuatorTasks } from './tasks/actuator';
import { preparePerformanceTasks } from './tasks/performance';
import { prepareFunnelTasks } from './tasks/funnel';
import { prepareErrorTasks } from './tasks/errors';
import { prepareScreenVisitTasks } from './tasks/screens';
import { prepareEndpointTasks } from './tasks/endpoints';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.text('Metrics Collector Worker is running.'));

function prepareRetentionTasks(env: Env, batchStatements: any[]): void {
	const purgeEventsStmt = env.DB.prepare(`
        DELETE FROM mobile_telemetry_events
        WHERE datetime(timestamp / 1000, 'unixepoch') < datetime('now', '-3 days')
    `);

	const purgeMetricsStmt = env.DB.prepare(`
        DELETE FROM mobile_telemetry_api_metrics
        WHERE datetime(timestamp / 1000, 'unixepoch') < datetime('now', '-3 days')
    `);

	batchStatements.push(purgeEventsStmt, purgeMetricsStmt);
	console.log("Data retention eviction tasks successfully prepared.");
}

export default {
	fetch: app.fetch,

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Cron trigger started at: ${new Date().toISOString()}`);

		// Initialize an atomic execution stack for D1 PreparedStatement batching
		const batchStatements: any[] = [];

		// Stage 1: Poll system status indicators and core application metadata summaries
		if (event.cron === "*/30 * * * *") {
			console.log("Running Stage 1 (Stats & Actuator)...");

			await prepareStatsTasks(env, batchStatements);
			await prepareActuatorTasks(env, batchStatements);
		} else {
		// Stage 2: Execute lookback window ETL algorithms across 5 core telemetry dimensions
			console.log("Running Full Pipeline (Daily)...");
			await preparePerformanceTasks(env, batchStatements);
			await prepareFunnelTasks(env, batchStatements);
			await prepareErrorTasks(env, batchStatements);
			await prepareScreenVisitTasks(env, batchStatements);
			await prepareEndpointTasks(env, batchStatements);

			// Stage 2.5: Prune raw pipeline details older than 30 days
			prepareRetentionTasks(env, batchStatements);
		}
		// Stage 3: Flush the prepared transaction sequence down into D1 atomically
		if (batchStatements.length > 0) {
			try {
				await env.DB.batch(batchStatements);
				console.log(`🎉 [D1 Success] Batch transaction completed. Executed operations: ${batchStatements.length}`);
			} catch (batchErr: any) {
				console.error("❌ D1 Batch execution failed:", batchErr.message);
			}
		} else {
			console.log("No statements prepared. Batch skipped.");
		}
	}
};
