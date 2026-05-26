import { MetricQueryResult } from "./types";

export async function fetchAnalyticsData(db: D1Database, range: string): Promise<MetricQueryResult[]> {
	const timeFilter = range === "24h" ? "-24 hours" : `-${range} days`;
	const timeFormat = range === "24h" ? '%H:%M' : '%m-%d';

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
    WHERE timestamp > datetime('now', '${timeFilter}')
    GROUP BY time_label
    ORDER BY raw_time ASC
  `;

	const { results } = await db.prepare(query).all<MetricQueryResult>();
	return results || [];
}
