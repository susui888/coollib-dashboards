// src/repositories/incedent.ts


export async function fetchLatestIncidents(db: D1Database): Promise<any[]> {

	const { results } = await db.prepare(`
        SELECT id, source, component, level, title, message, status, created_at, resolved_at
        FROM incidents
        ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC
        LIMIT 50
    `).all();

	return results || [];
}
