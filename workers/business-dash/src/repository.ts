// workers/business-dash/src/repository.ts
import { StatsEntry } from "./types";

export async function fetchStatsData(db: D1Database, range: string): Promise<StatsEntry[]> {
	let query = "";
	let params: any[] = [];

	if (range === "24h") {
		// 精准切出小格式。例如 "2026-05-25 21:17:34" -> substr(timestamp, 12, 2) 拿到 "21"
		query = `
      SELECT
        (substr(timestamp, 12, 2) || ':00') as day,
        MAX(books) as books,
        MAX(users) as users,
        MAX(loans) as loans,
        MAX(reviews) as reviews,
        MAX(review_images) as review_images,
        MAX(timestamp) as timestamp
      FROM stats_history
      WHERE timestamp > datetime('now', '-24 hours')
      GROUP BY day
      ORDER BY timestamp DESC
      LIMIT 24
    `;
	} else {
		const limitDays = parseInt(range, 10) || 7;

		// 精准切出天数。例如 "2026-05-25 21:17:34" -> substr(timestamp, 1, 10) 拿到 "2026-05-25"
		query = `
      SELECT
        substr(timestamp, 1, 10) as day,
        MAX(books) as books,
        MAX(users) as users,
        MAX(loans) as loans,
        MAX(reviews) as reviews,
        MAX(review_images) as review_images,
        MAX(timestamp) as timestamp
      FROM stats_history
      GROUP BY day
      ORDER BY day DESC
      LIMIT ?
    `;
		params = [limitDays];
	}

	const { results } = await db.prepare(query).bind(...params).all<StatsEntry>();
	return results || [];
}
