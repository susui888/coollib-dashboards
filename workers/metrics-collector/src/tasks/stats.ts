import { Env, StatsCountsResponse } from '../types';

export async function prepareStatsTasks(env: Env, batchStatements: D1PreparedStatement[]): Promise<void> {
	try {
		const resp = await fetch("https://coollib.ryansu.uk/api/stats/counts");
		if (resp.ok) {
			const data = await resp.json() as StatsCountsResponse;

			batchStatements.push(
				env.DB.prepare(
					"INSERT INTO stats_history (books, users, loans, reviews, review_images) VALUES (?, ?, ?, ?, ?)"
				).bind(data.books, data.users, data.loans, data.reviews, data.reviewImage),
				env.DB.prepare(
					"DELETE FROM stats_history WHERE timestamp < datetime('now', '-30 days')"
				)
			);
			console.log("Stats statements prepared.");
		} else {
			console.error(`Failed to fetch stats counts: ${resp.status}`);
		}
	} catch (err: any) {
		console.error("Failed to process stats counts:", err.message);
	}
}
