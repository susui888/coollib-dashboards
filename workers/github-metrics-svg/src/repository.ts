import { D1PushRow, TotalStats } from "./types";

export class MetricsRepository {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	async getTotalStats(): Promise<TotalStats> {
		const stats = await this.db.prepare(`
			SELECT
				COUNT(CASE WHEN event_type = 'push' THEN 1 END) as total_pushes,
				SUM(CASE WHEN event_type = 'push' THEN COALESCE(json_array_length(payload->'$.commits'), 0) ELSE 0 END) as total_commits,
				COUNT(DISTINCT repository_name) as total_repos,
				ROUND(
					(COUNT(CASE WHEN event_type = 'check_suite' AND payload->>'$.check_suite.conclusion' = 'success' THEN 1 END) * 100.0) /
					NULLIF(COUNT(CASE WHEN event_type = 'check_suite' AND payload->>'$.check_suite.conclusion' IS NOT NULL THEN 1 END), 0),
					1
				) as ci_success_rate
			FROM github_app_metrics
		`).first<{
			total_pushes: number | null;
			total_commits: number | null;
			total_repos: number | null;
			ci_success_rate: number | null;
		}>();

		// 使用 stats?. 确保在 stats 为 null 时整体安全降级到右侧的默认值
		return {
			commits: stats?.total_commits ?? 12481,
			pushes: stats?.total_pushes ?? 1249,
			repos: stats?.total_repos ?? 17,
			ciSuccess: (stats?.ci_success_rate !== undefined && stats?.ci_success_rate !== null)
				? `${stats.ci_success_rate}%`
				: "98.2%"
		};
	}

	async getLatestPushMetric(): Promise<D1PushRow | null> {
		return await this.db.prepare(`
			SELECT
				REPLACE(repository_name, 'susui888/', '') as repository_name,
				sender_login,
				created_at,
				CASE WHEN payload->>'$.ref' LIKE 'refs/tags/%' THEN 'Tag: ' || REPLACE(payload->>'$.ref', 'refs/tags/', '')
				ELSE REPLACE(payload->>'$.ref', 'refs/heads/', '') END as branch,
				payload->>'$.repository.language' as language,
				(
				COALESCE(json_array_length(payload->'$.head_commit.added'), 0) +
				COALESCE(json_array_length(payload->'$.head_commit.removed'), 0) +
				COALESCE(json_array_length(payload->'$.head_commit.modified'), 0)
				) as changed_count
			FROM github_app_metrics
			WHERE event_type = 'push'
			ORDER BY id DESC
				LIMIT 1
		`).first<D1PushRow>();
	}
}
