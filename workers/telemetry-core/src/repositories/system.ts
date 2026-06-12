import { MetricQueryResult } from "../types";

export async function fetchAnalyticsData(db: any, range: string): Promise<MetricQueryResult[]> {
	const r = range.toLowerCase();
	const timeFormat = r === "24h" ? '%H:%M' : '%m-%d';
	const modifier = r === "24h" ? "-24 hours" : `-${parseInt(r.replace('d', ''), 10) || 7} days`;

	const query = `
       SELECT strftime('${timeFormat}', timestamp)         as time_label,
              ROUND(MAX(cpu_usage) * 100, 1)               as cpu,
              ROUND(MAX(jvm_memory_used) / 1024 / 1024, 0) as memory,
              MAX(http_requests)                           as requests,
              MAX(active_db_connections)                   as db_conn,
              ROUND(MAX(uptime) / 3600, 1)                 as uptime,
              MAX(timestamp)                               as raw_time
       FROM app_metrics2
       WHERE timestamp > datetime('now', ?)
       GROUP BY time_label
       ORDER BY raw_time DESC
    `;

	const { results } = await db.prepare(query).bind(modifier).all();
	return (results ?? []) as unknown as MetricQueryResult[];
}
