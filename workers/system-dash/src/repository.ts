import { MetricQueryResult } from "./types";

export async function fetchAnalyticsData(db: D1Database, range: string): Promise<MetricQueryResult[]> {
	const timeFormat = range === "24h" ? '%H:%M' : '%m-%d';

	// 1. 构建一个静态的时间锚点（对齐到固定的 30 分钟或当天整点）
	let baseTimeAnchor: string;
	if (range === "24h") {
		// 将 'now' 的分钟数向下取整到 30 的倍数（例如：18:54 -> 18:30:00）
		baseTimeAnchor = `datetime(strftime('%Y-%m-%dT%H:', 'now') || printf('%02d:00', (cast(strftime('%M', 'now') as INT) / 30) * 30))`;
	} else {
		// 7d 或 30d 维度，直接对齐到明天的凌晨 00:00:00
		baseTimeAnchor = `datetime('now', 'start of day', '+1 day')`;
	}

	const timeFilter = range === "24h" ? "-24 hours" : `-${range} days`;

	// 2. 在 WHERE 条件中使用 baseTimeAnchor
	const query = `
    SELECT
      strftime('${timeFormat}', timestamp) as time_label,
      ROUND(MAX(CASE WHEN metric_name = 'process.cpu.usage' THEN metric_value END) * 100, 1) as cpu,
      ROUND(MAX(CASE WHEN metric_name = 'jvm.memory.used' THEN metric_value END) / 1024 / 1024, 0) as memory,
      MAX(CASE WHEN metric_name = 'spring.security.http.secured.requests' THEN metric_value END) as requests,
      MAX(CASE WHEN metric_name = 'hikaricp.connections.active' THEN metric_value END) as db_conn,
      ROUND(MAX(CASE WHEN metric_name = 'process.uptime' THEN metric_value END) / 3600, 1) as uptime,
      MAX(timestamp) as raw_time
    FROM app_metrics
    WHERE timestamp > datetime(${baseTimeAnchor}, '${timeFilter}')
    GROUP BY time_label
    ORDER BY raw_time ASC
  `;

	const { results } = await db.prepare(query).all<MetricQueryResult>();
	return results || [];
}
