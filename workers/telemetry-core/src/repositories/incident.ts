// src/repositories/incedent.ts


export async function fetchLatestIncidents(db: D1Database): Promise<any[]> {
	// 优先按活跃状态排序（active 在前），其次按发生时间倒序排列，限制展示最近 5 条
	const { results } = await db.prepare(`
        SELECT id, source, component, level, title, message, status, created_at, resolved_at
        FROM incidents
        ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 10
    `).all();

	return results || [];
}
