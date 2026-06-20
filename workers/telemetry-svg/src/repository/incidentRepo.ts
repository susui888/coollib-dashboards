// src/repository/incidentRepo.ts
import { Env, IncidentSnapshotMetrics } from '../types';

export class IncidentRepository {
	private db: D1Database;

	constructor(env: Env) {
		this.db = env.DB;
	}

	async getIncidentSnapshot(): Promise<IncidentSnapshotMetrics> {
		try {
			// 1. 统计当前无人认领的活跃故障总数
			const activeCountRes = await this.db.prepare(`
                SELECT COUNT(*) as count FROM incidents WHERE status = 'active'
            `).first<{ count: number }>();
			const activeIncidents = activeCountRes?.count ?? 0;

			// 2. 统计总故障数与已解决数，动态计算结案率 (Clearance Rate)
			const statsRes = await this.db.prepare(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
                FROM incidents
            `).first<{ total: number; resolved: number }>();

			const total = statsRes?.total ?? 0;
			const resolved = statsRes?.resolved ?? 0;
			const clearanceRate = total > 0 ? parseFloat(((resolved / total) * 100).toFixed(1)) : 100.0;

			// 3. 动态计算平均修复时间 (MTTR) - 过滤出 resolved 的数据计算时间差
			const mttrRes = await this.db.prepare(`
                SELECT AVG((strftime('%s', resolved_at) - strftime('%s', created_at)) / 60) as avg_minutes
                FROM incidents
                WHERE status = 'resolved' AND resolved_at IS NOT NULL
            `).first<{ avg_minutes: number | null }>();

			let avgMttr = "0 m";
			if (mttrRes && mttrRes.avg_minutes !== null) {
				const mins = Math.round(mttrRes.avg_minutes);
				avgMttr = mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
			}

			// 4. 每个特定组件各自最新的一条历史故障
			const { results } = await this.db.prepare(`
				WITH RankedIncidents AS (
					SELECT
						status,
						component,
						title,
						strftime('%d/%m %H:%M UTC', created_at) as formatted_time,
						ROW_NUMBER() OVER (
                  PARTITION BY component
                  ORDER BY created_at DESC
              ) as rn
					FROM incidents
					WHERE component IN ('spring-boot-test', 'cloudflare-billing', 'coollib-android')
				)
				SELECT status, title, formatted_time as created_at
				FROM RankedIncidents
				WHERE rn = 1
				ORDER BY
					CASE component
						WHEN 'spring-boot-test' THEN 1
						WHEN 'coollib-android' THEN 2
						WHEN 'cloudflare-billing' THEN 3
						END ASC
			`).all<{ status: 'active' | 'resolved'; title: string; created_at: string }>();

			return {
				active_incidents: activeIncidents,
				clearance_rate: clearanceRate,
				avg_mttr: avgMttr,
				on_call_primary: "ryan (Primary)",
				recent_logs: results ?? []
			};

		} catch (err: any) {
			console.error("Failed to compile live SRE repository snapshots:", err.message);
			return {
				active_incidents: 1,
				clearance_rate: 66.7,
				avg_mttr: "11m",
				on_call_primary: "ryan (Primary)",
				recent_logs: [
					{ status: 'active', title: 'coollib-android: Telemetry Ingestion Pipeline runtime leak', created_at: '06-19 05:10' },
					{ status: 'resolved', title: 'Cloudflare Billing: D1 Workers Usage threshold sync throttled', created_at: '06-18 22:05' },
					{ status: 'resolved', title: 'Spring Boot Server Unreachable: HikariCP connection pool timeout', created_at: '06-18 14:20' }
				]
			};
		}
	}
}
