import { ScaleMetrics, RuntimeRawRow } from "../types";

export async function fetchMiniMonitorData(db: D1Database): Promise<{
	scale: ScaleMetrics | null;
	runtimeResults: RuntimeRawRow[];
}> {
	// 1. 获取最新的一条业务大盘物理快照
	const scaleQuery = `
		SELECT books, users, loans, reviews, review_images, timestamp
		FROM stats_history
		ORDER BY timestamp DESC
			LIMIT 1
	`;

	// 2. 极致扁平查询：直接抓取最新的一行宽表记录，绝不使用 UNION ALL
	const runtimeQuery = `
		SELECT cpu_usage, jvm_memory_used, http_requests, active_db_connections, uptime
		FROM app_metrics2
		ORDER BY timestamp DESC
			LIMIT 1
	`;

	// 这一步在 D1 底层只会产生极其纯粹的 1 Row Read
	const [scaleResult, runtimeRowResult] = await Promise.all([
		db.prepare(scaleQuery).first<ScaleMetrics>(),
		db.prepare(runtimeQuery).first<any>() // 获取整行对象
	]);

	// 3. 在 TypeScript 内存层动态进行转置，重新组装为满足原契约的数组
	const runtimeResults: RuntimeRawRow[] = [];

	if (runtimeRowResult) {
		runtimeResults.push(
			{ metric_name: 'process.cpu.usage', metric_value: runtimeRowResult.cpu_usage ?? 0 },
			{ metric_name: 'jvm.memory.used', metric_value: runtimeRowResult.jvm_memory_used ?? 0 },
			{ metric_name: 'spring.security.http.secured.requests', metric_value: runtimeRowResult.http_requests ?? 0 },
			{ metric_name: 'hikaricp.connections.active', metric_value: runtimeRowResult.active_db_connections ?? 0 },
			{ metric_name: 'process.uptime', metric_value: runtimeRowResult.uptime ?? 0 }
		);
	}

	return {
		scale: scaleResult,
		runtimeResults: runtimeResults
	};
}
