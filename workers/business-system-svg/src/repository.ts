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

	// 2. 实时基础设施指标查询（最新时间戳内切）
	const runtimeQuery = `
    SELECT m.metric_name, m.metric_value
    FROM app_metrics m
    INNER JOIN (
      SELECT metric_name, MAX(timestamp) as max_ts
      FROM app_metrics
      GROUP BY metric_name
    ) latest
    ON m.metric_name = latest.metric_name AND m.timestamp = latest.max_ts
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
