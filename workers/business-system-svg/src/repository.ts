import { ScaleMetrics, RuntimeRawRow } from "./types";

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

	const runtimeQuery = `
		SELECT * FROM (SELECT metric_name, metric_value FROM app_metrics WHERE metric_name = 'process.cpu.usage' ORDER BY timestamp DESC LIMIT 1)
		UNION ALL
		SELECT * FROM (SELECT metric_name, metric_value FROM app_metrics WHERE metric_name = 'jvm.memory.used' ORDER BY timestamp DESC LIMIT 1)
		UNION ALL
		SELECT * FROM (SELECT metric_name, metric_value FROM app_metrics WHERE metric_name = 'spring.security.http.secured.requests' ORDER BY timestamp DESC LIMIT 1)
		UNION ALL
		SELECT * FROM (SELECT metric_name, metric_value FROM app_metrics WHERE metric_name = 'hikaricp.connections.active' ORDER BY timestamp DESC LIMIT 1)
		UNION ALL
		SELECT * FROM (SELECT metric_name, metric_value FROM app_metrics WHERE metric_name = 'process.uptime' ORDER BY timestamp DESC LIMIT 1);
	`;

	const [scaleResult, runtimeResults] = await Promise.all([
		db.prepare(scaleQuery).first<ScaleMetrics>(),
		db.prepare(runtimeQuery).all<RuntimeRawRow>()
	]);

	return {
		scale: scaleResult,
		runtimeResults: runtimeResults.results || []
	};
}
