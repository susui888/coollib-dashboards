import { Env } from '../types';

export async function prepareEndpointTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		// 1. 先从 D1 中拉取昨日的原始路由统计流水（此时不对 endpoint 做任何修改）
		const queryRaw = `
            SELECT
                DATE(timestamp / 1000, 'unixepoch') as snapshot_date,
                endpoint,
                method,
                latency_ms
            FROM mobile_telemetry_api_metrics
            WHERE datetime(timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
              AND datetime(timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day');
        `;

		const { results } = await env.DB.prepare(queryRaw).all();

		if (!results || results.length === 0) {
			console.log("No endpoint metrics found for yesterday.");
			return;
		}

		// 2. 在 TypeScript 内存中利用 Map 进行全自动泛化规整与内存聚合
		// Key 结构: snapshot_date | normalized_endpoint | method
		const aggregationMap = new Map<string, {
			snapshot_date: string;
			endpoint: string;
			method: string;
			total_latency: number;
			call_count: number;
		}>();

		for (const row of results) {
			const date = row.snapshot_date as string;
			const originalEndpoint = row.endpoint as string;
			const method = row.method as string;
			const latency = row.latency_ms as number;

			// 1：把所有路径中的纯数字 ID 替换为 :id
			let normalizedEndpoint = originalEndpoint.replace(/\/\d+/g, '/:id');
			// 2：把末尾复杂的图片/静态资源文件名整体替换为 :filename
			normalizedEndpoint = normalizedEndpoint.replace(/\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png|gif)$/i, '/:filename');

			const aggKey = `${date}|${normalizedEndpoint}|${method}`;

			if (!aggregationMap.has(aggKey)) {
				aggregationMap.set(aggKey, {
					snapshot_date: date,
					endpoint: normalizedEndpoint,
					method: method,
					total_latency: 0,
					call_count: 0
				});
			}

			const current = aggregationMap.get(aggKey)!;
			current.total_latency += latency;
			current.call_count += 1;
		}

		// 3. 遍历 Map 聚合结果，生成 D1 UPSERT 预备语句，塞入全局 batch 队列
		for (const [_, item] of aggregationMap) {
			const avgLatency = parseFloat((item.total_latency / item.call_count).toFixed(2));

			const insertEndpointStmt = env.DB.prepare(`
                INSERT INTO summary_api_endpoints (snapshot_date, endpoint, method, avg_latency_ms, call_count)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(snapshot_date, endpoint, method) DO UPDATE SET
                    avg_latency_ms = excluded.avg_latency_ms,
                    call_count = excluded.call_count;
            `).bind(item.snapshot_date, item.endpoint, item.method, avgLatency, item.call_count);

			batchStatements.push(insertEndpointStmt);
		}

		console.log(`API endpoint tasks successfully prepared in memory. Rows to upsert: ${aggregationMap.size}`);
	} catch (err: any) {
		console.error("Failed to process endpoint aggregation in worker memory:", err.message);
	}
}
