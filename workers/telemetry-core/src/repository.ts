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

	// 💡 针对不同范围，动态收拢 X 轴的时间分组粒度
	let dateGroup = "DATE(created_at)";
	if (r === "90d") {
		dateGroup = "strftime('%Y-W%W', created_at)"; // 按周聚合
	} else if (r === "all_time") {
		dateGroup = "strftime('%Y-%m', created_at)";  // 按月聚合
	}

	let timeClause = "1=1";
	if (r !== "all_time") {
		const days = parseInt(r.replace('d', ''), 10) || 30;
		timeClause = "created_at >= date('now', ?)";
		params = [`-${days} days`, `-${days} days`, `-${days} days`, `-${days} days`];
	}

	const query = `
       SELECT 'commit_activity' AS dataset_type,
              ${dateGroup}      AS metric_key,
              SUM(json_array_length(payload->'$.commits')) AS metric_value
       FROM github_app_metrics
       WHERE event_type = 'push' AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"}
       GROUP BY metric_key

       UNION ALL

       -- == CHART 2: CODE GROWTH (平铺无子查询版：单日/周/月独立变更，绝不累计) ==
       SELECT 'code_growth' AS dataset_type,
              ${dateGroup}  AS metric_key,
              SUM(
				  COALESCE(json_array_length(payload->'$.head_commit.added'), 0) +
	              COALESCE(json_array_length(payload->'$.head_commit.removed'), 0) +
	              COALESCE(json_array_length(payload->'$.head_commit.modified'), 0)
              ) AS metric_value
       FROM github_app_metrics
       WHERE event_type = 'push' AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"}
       GROUP BY metric_key

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

       ORDER BY dataset_type ASC, metric_key ASC;
    `;

	const {results} = await db.prepare(query).bind(...params).all<GithubMetricResult>();
	return results ?? [];
}

/**
 * 💡 终极精准版：仅过滤并返回指定 5 个核心仓库的最新一条记录
 */
export async function fetchGithubLatestData(db: D1Database): Promise<any[]> {
	// 定义你需要锁定的 5 个核心仓库名单
	// 如果你数据库里存的是全称，请将其修改为 ['susui888/coollib-android', 'susui888/coollib-ios', ...]
	const targetRepos = [
		'susui888/coollib-android',
		'susui888/coollib-ios',
		'susui888/CoolLeaf',
		'susui888/coollib-dashboards',
		'susui888/resume-website'
	];

	// 将数组转化为 SQL IN 语句需要的占位符字符串，例如 "?, ?, ?, ?, ?"
	const placeholders = targetRepos.map(() => '?').join(', ');

	const sql = `
        SELECT
            m.id,
            m.event_type,
            m.action,
            m.repository_name,
            m.sender_login,
            m.payload,
            m.created_at
        FROM github_app_metrics m
        INNER JOIN (
            SELECT MAX(id) as max_id
            FROM github_app_metrics
            WHERE repository_name IN (${placeholders}) -- 💡 在聚合前过滤，最大化压榨索引性能
            GROUP BY repository_name
        ) latest ON m.id = latest.max_id;
    `;

	// 将目标仓库数组作为参数安全地绑定到 SQL 中，防止 SQL 注入
	const { results } = await db.prepare(sql).bind(...targetRepos).all();

	// 映射结果并安全解析 payload
	return results.map((row: any) => {
		let parsedPayload = null;
		try {
			parsedPayload = row.payload ? JSON.parse(row.payload) : null;
		} catch (e) {
			console.error(`[D1 Error] Failed to parse JSON payload for log ID ${row.id}:`, e);
		}

		return {
			id: row.id,
			event_type: row.event_type,
			action: row.action,
			repository_name: row.repository_name,
			sender_login: row.sender_login,
			created_at: row.created_at,
			payload: parsedPayload
		};
	});
}
