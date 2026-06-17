import { Hono } from 'hono';
import { Env } from './types';
import { prepareStatsTasks } from './system-tasks/stats';
import { prepareActuatorTasks } from './system-tasks/actuator';
import { preparePerformanceTasks } from './mobile-tasks/performance';
import { prepareFunnelTasks } from './mobile-tasks/funnel';
import { prepareErrorTasks } from './mobile-tasks/errors';
import { prepareScreenVisitTasks } from './mobile-tasks/screens';
import { prepareEndpointTasks } from './mobile-tasks/endpoints';
import { checkSpringHealth } from './alerts/healthCheck';
import { executeBillingSentinelPoll } from './alerts/billCheck';

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
		console.log(`Cron trigger [${event.cron}] started at: ${new Date().toISOString()}`);

		// Initialize an atomic execution stack for D1 PreparedStatement batching
		const batchStatements: any[] = [];

		switch (event.cron) {

			case "*/2 * * * *":
				console.log("Running 2-Min Live Critical Health Check...");
				ctx.waitUntil(checkSpringHealth(env, ctx));

				break;

			case "*/30 * * * *":
				console.log("Running 30-Min Metrics Extraction (Stage 1)...");
				await prepareStatsTasks(env, batchStatements);
				await prepareActuatorTasks(env, batchStatements);

				await executeBillingSentinelPoll(env, batchStatements);
				break;

			default:

				console.log("Running Full Pipeline ETL (Daily Mode)...");
				await preparePerformanceTasks(env, batchStatements);
				await prepareFunnelTasks(env, batchStatements);
				await prepareErrorTasks(env, batchStatements);
				await prepareScreenVisitTasks(env, batchStatements);
				await prepareEndpointTasks(env, batchStatements);
				prepareRetentionTasks(env, batchStatements);
				break;
		}

		// 统一为 Stage 1 和 Daily 管道刷新 D1 事务
		if (batchStatements.length > 0) {
			try {
				await env.DB.batch(batchStatements);
				console.log(`🎉 [D1 Success] Batch transaction completed. Executed operations: ${batchStatements.length}`);
			} catch (batchErr: any) {
				console.error("❌ D1 Batch execution failed:", batchErr.message);
			}
		} else {
			console.log("No batch statements required for this trigger.");
		}
	}
};
