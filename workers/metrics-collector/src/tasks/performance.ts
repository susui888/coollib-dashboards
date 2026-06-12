import { Env } from '../types';

export async function preparePerformanceTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		const queryRaw = `
            SELECT
                DATE(timestamp / 1000, 'unixepoch') as snapshot_date,
                platform as os_platform,
                '[' || group_concat(latency_ms) || ']' as latency_array_json,
                COUNT(*) as total_requests,
                SUM(CASE WHEN status_code != 200 THEN 1 ELSE 0 END) as error_requests
            FROM mobile_telemetry_api_metrics
            WHERE datetime(timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
              AND datetime(timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day')
            GROUP BY snapshot_date, os_platform;
        `;

		const { results } = await env.DB.prepare(queryRaw).all();

		const getPercentile = (sortedArr: number[], percentile: number): number => {
			if (sortedArr.length === 0) return 0;
			const index = Math.ceil((percentile / 100) * sortedArr.length) - 1;
			return sortedArr[Math.max(0, index)];
		};

		for (const row of results) {
			const date = row.snapshot_date as string;
			const platform = row.os_platform as string;
			const totalCalls = row.total_requests as number;
			const errorCalls = row.error_requests as number;

			const latencies = JSON.parse(row.latency_array_json as string) as number[];
			latencies.sort((a, b) => a - b);

			const p50 = getPercentile(latencies, 50);
			const p95 = getPercentile(latencies, 95);
			const p99 = getPercentile(latencies, 99);

			const insertPerfStmt = env.DB.prepare(`
                INSERT INTO summary_api_performance (snapshot_date, os_platform, p50_ms, p95_ms, p99_ms, total_requests, error_requests)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(snapshot_date, os_platform) DO UPDATE SET
                    p50_ms = excluded.p50_ms,
                    p95_ms = excluded.p95_ms,
                    p99_ms = excluded.p99_ms,
                    total_requests = excluded.total_requests,
                    error_requests = excluded.error_requests;
            `).bind(date, platform, p50, p95, p99, totalCalls, errorCalls);

			batchStatements.push(insertPerfStmt);
		}
		console.log("Telemetry performance (P50/P95/P99) tasks successfully prepared.");
	} catch (err: any) {
		console.error("Failed to process performance aggregation:", err.message);
	}
}
