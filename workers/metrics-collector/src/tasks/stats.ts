import { Env, StatsCountsResponse } from '../types';

export async function prepareStatsTasks(env: Env, batchStatements: D1PreparedStatement[]): Promise<void> {
	try {
		// Step 1: Poll the production CoolLeaf core system endpoint for lifetime business entity aggregates
		const resp = await fetch("https://coollib.ryansu.uk/api/stats/counts");

		if (resp.ok) {
			const data = await resp.json() as StatsCountsResponse;

			// Step 2: Assemble atomic transactional mutations for state history persistence
			batchStatements.push(
				// Statement A: Push a fresh micro-snapshot of cumulative system entries into the history table
				env.DB.prepare(
					"INSERT INTO stats_history (books, users, loans, reviews, review_images) VALUES (?, ?, ?, ?, ?)"
				).bind(data.books, data.users, data.loans, data.reviews, data.reviewImage),

				// Statement B: Execute cascading house-keeping cleanup to truncate historical footprints older than 30 days
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
