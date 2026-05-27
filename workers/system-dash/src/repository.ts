import { MetricQueryResult } from "./types";

export async function fetchAnalyticsData(db: D1Database, range: string): Promise<MetricQueryResult[]> {
	const timeFormat = range === "24h" ? '%H:%M' : '%m-%d';

	// 1. 构建一个静态的时间锚点（对齐到固定的 30 分钟或当天整点，保持编译计划缓存）
	let baseTimeAnchor: string;
	if (range === "24h") {
		// 将 'now' 的分钟数向下取整到 30 的倍数（例如：18:54 -> 18:30:00）
		baseTimeAnchor = `datetime(strftime('%Y-%m-%dT%H:', 'now') || printf('%02d:00', (cast(strftime('%M', 'now') as INT) / 30) * 30))`;
	} else {
		// 7d 或 30d 维度，直接对齐到明天的凌晨 00:00:00
		baseTimeAnchor = `datetime('now', 'start of day', '+1 day')`;
	}

	const timeFilter = range === "24h" ? "-24 hours" : `-${range} days`;

	// 2. 基于宽表 app_metrics2 的极致精简查询
	const query = `
    SELECT
      strftime('${timeFormat}', timestamp) as time_label,
      ROUND(MAX(cpu_usage) * 100, 1) as cpu,
      ROUND(MAX(jvm_memory_used) / 1024 / 1024, 0) as memory,
      MAX(http_requests) as requests,
      MAX(active_db_connections) as db_conn,
      ROUND(MAX(uptime) / 3600, 1) as uptime,
      MAX(timestamp) as raw_time
    FROM app_metrics2
    WHERE timestamp > datetime(${baseTimeAnchor}, '${timeFilter}')
    GROUP BY time_label
    ORDER BY raw_time ASC
  `;

	const { results } = await db.prepare(query).all<MetricQueryResult>();
	return results || [];
}
