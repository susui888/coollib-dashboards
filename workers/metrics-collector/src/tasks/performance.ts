import { Env } from '../types';

export async function preparePerformanceTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		// Step 1: Query raw telemetry and roll up latency fields into a string-concatenated JSON array string.
		// This delegates the initial filtering and heavy grouping to SQLite while keeping memory bounds manageable.
		const queryRaw = `
            SELECT
                -- Convert millisecond Unix timestamp to a YYYY-MM-DD date string
                DATE(timestamp / 1000, 'unixepoch') as snapshot_date,
                platform as os_platform,

                -- Aggregate all raw numeric latencies for the group into a standard stringified JSON array format
                '[' || group_concat(latency_ms) || ']' as latency_array_json,
                COUNT(*) as total_requests,

                -- Track high-level failures by filtering for non-200 HTTP statuses
                SUM(CASE WHEN status_code != 200 THEN 1 ELSE 0 END) as error_requests
            FROM mobile_telemetry_api_metrics

            -- Lookback window processing: fetch metrics from exactly 00:00:00 yesterday to 00:00:00 today
            WHERE datetime(timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
              AND datetime(timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day')
            GROUP BY snapshot_date, os_platform;
        `;

		const { results } = await env.DB.prepare(queryRaw).all();

		// Helper function to calculate exact percentile cutoffs using the Nearest-Rank method
		const getPercentile = (sortedArr: number[], percentile: number): number => {
			if (sortedArr.length === 0) return 0;
			const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
			return sortedArr[Math.max(0, index)]; // Clamping lower bounds to index 0
		};

		// Step 2: Extract string records and run high-percentile computations in V8 engine memory
		for (const row of results) {
			const date = row.snapshot_date as string;
			const platform = row.os_platform as string;
			const totalCalls = row.total_requests as number;
			const errorCalls = row.error_requests as number;

			// Parse the aggregated SQL string into an actual numeric array and sort it ascending
			const latencies = JSON.parse(row.latency_array_json as string) as number[];
			latencies.sort((a, b) => a - b);

			// Extract standard Service Level Objective (SLO) metrics
			const p50 = getPercentile(latencies, 50);
			const p95 = getPercentile(latencies, 95);
			const p99 = getPercentile(latencies, 99);

			// Step 3: Bind values into an atomic UPSERT prepared statement structure
			const insertPerfStmt = env.DB.prepare(`
				INSERT INTO summary_api_performance (snapshot_date, os_platform, p50_ms, p95_ms, p99_ms, total_requests, error_requests)
				VALUES (?, ?, ?, ?, ?, ?, ?)
				    -- Idempotency handler: overwrite existing percentiles if rerun for the same segment window
					ON CONFLICT(snapshot_date, os_platform) DO UPDATE SET
					p50_ms = excluded.p50_ms,
					p95_ms = excluded.p95_ms,
					p99_ms = excluded.p99_ms,
					total_requests = excluded.total_requests,
					error_requests = excluded.error_requests;
			`).bind(date, platform, p50, p95, p99, totalCalls, errorCalls);

			// Queue the statement into the main transaction pipeline batch array
			batchStatements.push(insertPerfStmt);
		}
		console.log("Telemetry performance (P50/P95/P99) tasks successfully prepared.");
	} catch (err: any) {
		console.error("Failed to process performance aggregation:", err.message);
	}
}
