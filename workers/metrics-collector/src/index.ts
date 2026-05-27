/**
 * Metrics Collector Worker
 * Responsibility: Periodically fetch data from Spring Boot Actuator and persist it into the D1 database.
 */

// 1. Define environment variables type so env.DB can be properly recognized
export interface Env {
	DB: D1Database;
}

// 2. Define the response structure returned from ryansu.uk/api/stats/counts
interface StatsCountsResponse {
	books: number;
	users: number;
	loans: number;
	reviews: number;
	review_images: number; // Ensure this matches your actual API response key
}

// 3. Define the response structure for Spring Actuator Metrics
interface ActuatorMetricResponse {
	measurements?: Array<{ statistic: string; value: number }>;
	availableTags?: Array<any>;
}

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Cron trigger started at: ${new Date().toISOString()}`);

		// ==========================================
		// Part 1: Fetch and sync core business metrics (Stats Counts)
		// ==========================================
		try {
			const resp = await fetch("https://ryansu.uk/api/stats/counts");
			if (resp.ok) {
				const data = await resp.json() as StatsCountsResponse;

				// Prepare insert and retention/cleanup statements
				const insertStatsStmt = env.DB.prepare(
					"INSERT INTO stats_history (books, users, loans, reviews, review_images) VALUES (?, ?, ?, ?, ?)"
				).bind(data.books, data.users, data.loans, data.reviews, data.review_images);

				const deleteStatsStmt = env.DB.prepare(
					"DELETE FROM stats_history WHERE timestamp < datetime('now', '-30 days')"
				);

				// Execute as a batch transaction
				await env.DB.batch([insertStatsStmt, deleteStatsStmt]);
				console.log("Stats updated and old data purged.");
			} else {
				console.error(`Failed to fetch stats counts: ${resp.status}`);
			}
		} catch (err: any) {
			console.error("Failed to process stats counts:", err.message);
		}

		// ==========================================
		// Part 2: Fetch and sync system telemetry metrics (Spring Actuator)
		// ==========================================
		const baseUrl = "https://ryansu.uk/actuator/metrics";
		const metricsToFetch = [
			"process.uptime",
			"process.cpu.usage",
			"jvm.memory.used",
			"hikaricp.connections.active",
			"spring.security.http.secured.requests"
		];

		// 1. Fetch all metrics concurrently
		const fetchPromises = metricsToFetch.map(async (name) => {
			try {
				const response = await fetch(`${baseUrl}/${name}`);
				if (!response.ok) {
					console.warn(`Metric ${name} returned status ${response.status}`);
					return null;
				}

				const data = await response.json() as ActuatorMetricResponse;
				const measurements = data.measurements || [];

				let mainValue = 0;
				let extra: Record<string, any> = {};

				// Special parsing logic for Secured Requests count
				if (name === "spring.security.http.secured.requests") {
					const count = measurements.find(m => m.statistic === "COUNT")?.value || 0;
					mainValue = count;
					extra = {
						count,
						totalTime: measurements.find(m => m.statistic === "TOTAL_TIME")?.value || 0
					};
				} else {
					// Standard single-value parsing
					mainValue = measurements[0]?.value || 0;
					if (data.availableTags) extra = { tags: data.availableTags };
				}

				// Return the prepared D1PreparedStatement object
				return env.DB.prepare(
					"INSERT INTO app_metrics (metric_name, metric_value, extra_data) VALUES (?, ?, ?)"
				).bind(name, mainValue, JSON.stringify(extra));

			} catch (err: any) {
				console.error(`Fetch failed for ${name}:`, err.message);
				return null;
			}
		});

		// 2. Wait for all requests to finish and filter out failed ones
		const results = await Promise.all(fetchPromises);
		const insertStmts = results.filter((stmt): stmt is D1PreparedStatement => stmt !== null);

		// 3. Prepare data retention cleanup statement
		const deleteMetricsStmt = env.DB.prepare(
			"DELETE FROM app_metrics WHERE timestamp < datetime('now', '-30 days')"
		);

		// 4. Use batching to commit everything atomically
		try {
			if (insertStmts.length > 0) {
				await env.DB.batch([...insertStmts, deleteMetricsStmt]);
				console.log(`Metrics synced: ${insertStmts.length} inserted, old data purged.`);
			} else {
				// If all metrics failed to fetch, at least attempt data retention cleanup
				await deleteMetricsStmt.run();
				console.log("No new metrics inserted, but old data purged.");
			}
		} catch (batchErr: any) {
			console.error("D1 Batch execution failed:", batchErr.message);
		}
	}
};
