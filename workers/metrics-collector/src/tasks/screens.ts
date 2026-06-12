import { Env } from '../types';

export async function prepareScreenVisitTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		// Prepare the SQL statement for daily screen visit aggregation
		const aggregateScreensStmt = env.DB.prepare(`
			INSERT INTO summary_screen_visits (snapshot_date, os_platform, screen_name, visit_count)
			SELECT
				-- Convert millisecond Unix timestamp (JS/Kotlin/Swift) to seconds,
				-- then parse it using the 'unixepoch' modifier into a YYYY-MM-DD date string.
				DATE(timestamp / 1000, 'unixepoch') as snapshot_date,
				platform as os_platform,
				event_name as screen_name,
				COUNT(*) as visit_count
			FROM mobile_telemetry_events

			-- Filter only for screen navigation telemetry events
			WHERE event_name LIKE '%_SCREEN'

			-- Lookback window: Fetch logs starting exactly from 00:00:00 of yesterday up until 00:00:00 of today
			  AND datetime(timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
			  AND datetime(timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day')
			GROUP BY snapshot_date, os_platform, screen_name

			-- Idempotency rule: If a summary record already exists for this date, platform, and screen, update the count
			ON CONFLICT(snapshot_date, os_platform, screen_name) DO UPDATE SET
				visit_count = excluded.visit_count;
		`);

		// Append the prepared statement to the global batch queue for atomic execution
		batchStatements.push(aggregateScreensStmt);
		console.log("Screen visit ranking tasks successfully prepared.");
	} catch (err: any) {
		console.error("Failed to process screen visit aggregation:", err.message);
	}
}
