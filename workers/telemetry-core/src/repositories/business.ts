import { StatsEntry } from "../types";

export async function fetchStatsData(db: any, range: string): Promise<StatsEntry[]> {
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
	const { results } = await db.prepare(query).bind(...params).all();
	return (results ?? []) as unknown as StatsEntry[];
}
