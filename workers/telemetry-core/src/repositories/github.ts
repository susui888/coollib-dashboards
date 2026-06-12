import { GithubMetricResult } from "../types";

export async function fetchGithubMetricsData(db: any, range: string): Promise<GithubMetricResult[]> {
	const r = range.toLowerCase();
	let params: string[] = [];
	let dateGroup = "DATE(created_at)";

	if (r === "90d") {
		dateGroup = "strftime('%Y-W%W', created_at)";
	} else if (r === "all_time") {
		dateGroup = "strftime('%Y-%m', created_at)";
	}

	let timeClause = "1=1";
	if (r !== "all_time") {
		const days = parseInt(r.replace('d', ''), 10) || 30;
		timeClause = "created_at >= date('now', ?)";
		params = [`-${days} days`, `-${days} days`, `-${days} days`, `-${days} days`];
	}

	const query = `
       SELECT 'commit_activity' AS dataset_type, ${dateGroup} AS metric_key, SUM(json_array_length(payload->'$.commits')) AS metric_value
       FROM github_app_metrics WHERE event_type = 'push' AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"} GROUP BY metric_key
       UNION ALL
       SELECT 'code_growth' AS dataset_type, ${dateGroup} AS metric_key, SUM(COALESCE(json_array_length(payload->'$.head_commit.added'), 0) + COALESCE(json_array_length(payload->'$.head_commit.removed'), 0) + COALESCE(json_array_length(payload->'$.head_commit.modified'), 0)) AS metric_value
       FROM github_app_metrics WHERE event_type = 'push' AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"} GROUP BY metric_key
       UNION ALL
       SELECT 'repo_activity' AS dataset_type, repository_name AS metric_key, SUM(json_array_length(payload->'$.commits')) AS metric_value
       FROM github_app_metrics WHERE event_type = 'push' AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"} GROUP BY metric_key
       UNION ALL
       SELECT 'language_dist' AS dataset_type, CASE WHEN repository_name LIKE '%CoolLeaf%' OR repository_name LIKE '%coollib-android%' THEN 'Kotlin' WHEN repository_name LIKE '%coollib-ios%' THEN 'Swift' WHEN repository_name LIKE '%coollib-dashboards%' THEN 'TypeScript' WHEN repository_name LIKE '%resume-website%' THEN 'Astro/TS' ELSE 'Other' END AS metric_key, SUM(json_array_length(payload->'$.commits')) AS metric_value
       FROM github_app_metrics WHERE event_type = 'push' AND ${timeClause === "1=1" ? "1=1" : "created_at >= date('now', ?)"} AND (repository_name LIKE '%CoolLeaf%' OR repository_name LIKE '%coollib-android%' OR repository_name LIKE '%coollib-ios%' OR repository_name LIKE '%coollib-dashboards%' OR repository_name LIKE '%resume-website%') GROUP BY metric_key
       ORDER BY dataset_type ASC, metric_key ASC;
    `;

	const { results } = await db.prepare(query).bind(...params).all();
	return (results ?? []) as unknown as GithubMetricResult[];
}

export async function fetchGithubLatestData(db: any): Promise<any[]> {
	const targetRepos = [
		'susui888/coollib-android',
		'susui888/coollib-ios',
		'susui888/CoolLeaf',
		'susui888/coollib-dashboards',
		'susui888/resume-website'
	];
	const placeholders = targetRepos.map(() => '?').join(', ');

	const sql = `
        SELECT m.id, m.event_type, m.action, m.repository_name, m.sender_login, m.payload, m.created_at
        FROM github_app_metrics m
        INNER JOIN (
            SELECT MAX(id) as max_id FROM github_app_metrics WHERE repository_name IN (${placeholders}) GROUP BY repository_name
        ) latest ON m.id = latest.max_id;
    `;

	const { results } = await db.prepare(sql).bind(...targetRepos).all();

	return (results ?? []).map((row: any) => {
		let parsedPayload = null;
		try { parsedPayload = row.payload ? JSON.parse(row.payload) : null; } catch (e) {}
		return {
			id: row.id, event_type: row.event_type, action: row.action, repository_name: row.repository_name,
			sender_login: row.sender_login, created_at: row.created_at, payload: parsedPayload
		};
	});
}
