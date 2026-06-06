import {StatsEntry, MetricQueryResult, GithubMetricResult} from "./types";

// ============================================================================
// 1. Business Metrics
// ============================================================================
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

// ============================================================================
// 2. System Analytics
// ============================================================================
export async function fetchAnalyticsData(db: D1Database, range: string): Promise<MetricQueryResult[]> {
	const r = range.toLowerCase();

	const timeFormat = r === "24h" ? '%H:%M' : '%m-%d';
	// 安全策略：统一转成具体的 modifier 字符串，用 D1 参数绑定防注入
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

	const {results} = await db.prepare(query).bind(modifier).all<MetricQueryResult>();
	return results ?? [];
}

// ============================================================================
// 3. GitHub Metrics (支持动态 range: '30d' | '90d' | 'all_time')
// ============================================================================
export async function fetchGithubMetricsData(db: D1Database, range: string): Promise<GithubMetricResult[]> {
	const r = range.toLowerCase();
	let params: string[] = [];

	// 动态构建 WHERE 条件。注意：由于我们在多段 UNION 中共用了这个时间过滤，
	// 使用统一的命名或位置绑定变量可以确保数据安全性。
	let timeClause = "1=1";
	if (r !== "all_time") {
		const days = parseInt(r.replace('d', ''), 10) || 30;
		timeClause = "created_at >= date('now', ?)";
		// 由于 UNION ALL 中有 4 个独立的子查询使用了此条件，我们需要绑定 4 次参数
		params = [`-${days} days`, `-${days} days`, `-${days} days`, `-${days} days`];
	}

	// 修复了所有 `- >` 的断字错误，并在每个子查询中完美注入了 timeClause 过滤
	const query = `

       SELECT 'commit_activity' AS dataset_type,
              DATE(created_at)  AS metric_key,
              SUM(json_array_length(payload->'$.commits')) AS metric_value
       FROM github_app_metrics
       WHERE event_type = 'push' AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"}
       GROUP BY metric_key

       UNION ALL

       -- == CHART 2: CODE GROWTH (基于过滤范围计算的累计文件变更趋势) ==
       SELECT 'code_growth' AS dataset_type,
              date          AS metric_key,
              SUM(daily_files_changed) OVER (ORDER BY date ASC) AS metric_value
       FROM (
          SELECT DATE(created_at) AS date,
                 SUM(
                    COALESCE(json_array_length(payload->'$.head_commit.added'), 0) +
                    COALESCE(json_array_length(payload->'$.head_commit.removed'), 0) +
                    COALESCE(json_array_length(payload->'$.head_commit.modified'), 0)
                 ) AS daily_files_changed
          FROM github_app_metrics
          WHERE event_type = 'push' AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"}
          GROUP BY date
       )

       UNION ALL

       -- == CHART 3: REPOSITORY ACTIVITY ==

	   SELECT 'repo_activity' AS dataset_type,
              repository_name AS metric_key,
              SUM(json_array_length(payload->'$.commits')) AS metric_value
       FROM github_app_metrics
       WHERE event_type = 'push' AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"}
       GROUP BY metric_key
       UNION ALL

       -- == CHART 4: LANGUAGE DISTRIBUTION ==
       SELECT 'language_dist' AS dataset_type,
              CASE
                 WHEN repository_name LIKE '%CoolLeaf%' OR repository_name LIKE '%coollib-android%' THEN 'Kotlin'
                 WHEN repository_name LIKE '%coollib-ios%' THEN 'Swift'
                 WHEN repository_name LIKE '%coollib-dashboards%' THEN 'TypeScript'
                 WHEN repository_name LIKE '%resume-website%' THEN 'Astro/TS'
                 ELSE 'Other'
              END AS metric_key,
              SUM(json_array_length(payload->'$.commits')) AS metric_value
       FROM github_app_metrics
       WHERE event_type = 'push'
         AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"}
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

	const {results} = await db.prepare(query).bind(...params).all<GithubMetricResult>();
	return results ?? [];
}
