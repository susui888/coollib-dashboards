import {StatsEntry, MetricQueryResult, GithubMetricResult} from "./types";

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
		ORDER BY raw_time DESC
	`;

	const {results} = await db.prepare(query).all<MetricQueryResult>();
	return results ?? [];
}

// GitHub Metrics (支持动态 range: '30d' | '90d' | 'all_time')
export async function fetchGithubMetricsData(db: D1Database, range: string): Promise<GithubMetricResult[]> {
	const r = range.toLowerCase();

	// 动态构建时间过滤 SQL 片段
	let timeFilterCondition = "";
	if (r !== "all_time") {
		const days = r.replace('d', '');
		timeFilterCondition = `AND created_at >= date('now', '-${days} days')`;
	}

	const query = `
        SELECT
            'commit_activity' AS dataset_type,
            DATE(created_at) AS metric_key,
            SUM(json_array_length(json_extract(payload, '$.commits'))) AS metric_value
        FROM github_app_metrics
        WHERE event_type = 'push' ${timeFilterCondition}
        GROUP BY metric_key

        UNION ALL

        SELECT
            'code_growth' AS dataset_type,
            date AS metric_key,
            SUM(daily_commits) OVER (ORDER BY date) AS metric_value
        FROM (
            SELECT
                DATE(created_at) AS date,
                SUM(json_array_length(json_extract(payload, '$.commits'))) AS daily_commits
            FROM github_app_metrics
            WHERE event_type = 'push' ${timeFilterCondition}
            GROUP BY date
        )

        UNION ALL

        SELECT
            'repo_activity' AS dataset_type,
            repository_name AS metric_key,
            SUM(json_array_length(json_extract(payload, '$.commits'))) AS metric_value
        FROM github_app_metrics
        WHERE event_type = 'push' ${timeFilterCondition}
        GROUP BY metric_key

        UNION ALL

        SELECT
            'language_dist' AS dataset_type,
            CASE
                WHEN repository_name LIKE '%CoolLeaf%' OR repository_name LIKE '%coollib-android%' THEN 'Kotlin'
                WHEN repository_name LIKE '%coollib-ios%' THEN 'Swift'
                WHEN repository_name LIKE '%coollib-dashboards%' THEN 'TypeScript'
                WHEN repository_name LIKE '%resume-website%' THEN 'Astro/TS'
                ELSE 'Other'
            END AS metric_key,
            SUM(json_array_length(json_extract(payload, '$.commits'))) AS metric_value
        FROM github_app_metrics
        WHERE event_type = 'push'
          ${timeFilterCondition}
          AND (
              repository_name LIKE '%CoolLeaf%'
              OR repository_name LIKE '%coollib-android%'
              OR repository_name LIKE '%coollib-ios%'
              OR repository_name LIKE '%coollib-dashboards%'
              OR repository_name LIKE '%resume-website%'
          )
        GROUP BY metric_key
        ORDER BY dataset_type, metric_key ASC;
    `;

	const { results } = await db.prepare(query).all<GithubMetricResult>();
	return results ?? [];
}
