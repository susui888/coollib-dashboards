import { Hono } from 'hono';
import { Env } from './types';
import { prepareStatsTasks } from './tasks/stats';
import { prepareActuatorTasks } from './tasks/actuator';
import { preparePerformanceTasks } from './tasks/performance';
import { prepareFunnelTasks } from './tasks/funnel';
import { prepareErrorTasks } from './tasks/errors';
import { prepareScreenVisitTasks } from './tasks/screens'
import { prepareEndpointTasks } from './tasks/endpoints';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.text('Metrics Collector Worker is running.'));

export default {
	fetch: app.fetch,

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Cron trigger started at: ${new Date().toISOString()}`);

		const batchStatements: any[] = [];

		// 1. 系统与业务同步基础设施任务
		await prepareStatsTasks(env, batchStatements);
		await prepareActuatorTasks(env, batchStatements);

		// 2. 遥测核心 5 大维度明细聚合 (ETL Queue)
		await preparePerformanceTasks(env, batchStatements);
		await prepareFunnelTasks(env, batchStatements);
		await prepareErrorTasks(env, batchStatements);
		await prepareScreenVisitTasks(env,batchStatements)
		await prepareEndpointTasks(env, batchStatements);

		// 3. 最终在单个事务中统一批量原子写入 D1
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
