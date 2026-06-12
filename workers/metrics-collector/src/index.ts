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

export default {
	fetch: app.fetch,

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Cron trigger started at: ${new Date().toISOString()}`);

		// Initialize an atomic execution stack for D1 PreparedStatement batching
		const batchStatements: any[] = [];

		// Stage 1: Poll system status indicators and core application metadata summaries
		await prepareStatsTasks(env, batchStatements);
		await prepareActuatorTasks(env, batchStatements);

		// Stage 2: Execute lookback window ETL algorithms across 5 core telemetry dimensions
		await preparePerformanceTasks(env, batchStatements);
		await prepareFunnelTasks(env, batchStatements);
		await prepareErrorTasks(env, batchStatements);
		await prepareScreenVisitTasks(env, batchStatements);
		await prepareEndpointTasks(env, batchStatements);

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
