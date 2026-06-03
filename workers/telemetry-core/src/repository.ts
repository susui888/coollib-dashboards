import {StatsEntry, MetricQueryResult} from "./types";

// Business
export async function fetchStatsData(db: D1Database, range: string): Promise<StatsEntry[]> {
	let query = "";
	let params: any[] = [];

	const normalizedRange = range.toLowerCase();

	if (normalizedRange === "24h") {
		query = `SELECT (substr(timestamp, 12, 2) || ':00') as day,
						MAX(books) as books,
						MAX(users) as users,
						MAX(loans) as loans,
						MAX(reviews) as reviews,
						MAX(review_images) as review_images,
						MAX(timestamp) as timestamp
		         FROM stats_history
		         WHERE timestamp > datetime('now', '-24 hours')
		         GROUP BY day
		         ORDER BY timestamp DESC LIMIT 24`;
	} else {
		const limitDays = parseInt(range, 10) || 7;
		query = `SELECT substr(timestamp, 1, 10) as day,
						MAX(books) as books,
						MAX(users) as users,
						MAX(loans) as loans,
						MAX(reviews) as reviews,
						MAX(review_images) as review_images,
						MAX(timestamp) as timestamp
		         FROM stats_history
		         GROUP BY day
		         ORDER BY day DESC LIMIT ?`;
		params = [limitDays];
	}
	const {results} = await db.prepare(query).bind(...params).all<StatsEntry>();
	return results ?? [];
}

// System
export async function fetchAnalyticsData(db: D1Database, range: string): Promise<MetricQueryResult[]> {

	const r = range.toLowerCase();

	const timeFormat = r === "24h" ? '%H:%M' : '%m-%d';
	const timeFilter = r === "24h" ? "-24 hours" : `-${r.replace('d', '')} days`;

	const query = `
		SELECT strftime('${timeFormat}', timestamp)         as time_label,
		       ROUND(MAX(cpu_usage) * 100, 1)               as cpu,
		       ROUND(MAX(jvm_memory_used) / 1024 / 1024, 0) as memory,
		       MAX(http_requests)                           as requests,
		       MAX(active_db_connections)                   as db_conn,
		       ROUND(MAX(uptime) / 3600, 1)                 as uptime,
		       MAX(timestamp)                               as raw_time
		FROM app_metrics2
		WHERE timestamp > datetime('now', '${timeFilter}')
		GROUP BY time_label
		ORDER BY raw_time ASC
	`;

	const {results} = await db.prepare(query).all<MetricQueryResult>();
	return results ?? [];
}
