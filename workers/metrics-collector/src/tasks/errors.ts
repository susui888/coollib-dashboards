import { Env } from '../types';

export async function prepareErrorTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		// Prepare the SQL statement for daily crash and error telemetry aggregation
		const aggregateErrorsStmt = env.DB.prepare(`
			INSERT INTO summary_crash_errors (snapshot_date, os_platform, error_name, occurrence_count)
			SELECT
				-- Convert millisecond Unix timestamp to seconds, then parse into a YYYY-MM-DD date string
				DATE(timestamp / 1000, 'unixepoch') as snapshot_date,
				platform as os_platform,
				event_name as error_name,
				COUNT(*) as occurrence_count
			FROM mobile_telemetry_events

			-- Filter only for tracking events that denote system/network/operation failures
			WHERE event_name LIKE '%_FAILURE'

			-- Lookback window: Fetch logs starting from 00:00:00 of yesterday up until 00:00:00 of today
			  AND datetime(timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
			  AND datetime(timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day')
			GROUP BY snapshot_date, os_platform, error_name

			-- Idempotency rule: If a summary record already exists for this date, platform, and error name, update its count
			ON CONFLICT(snapshot_date, os_platform, error_name) DO UPDATE SET
				occurrence_count = excluded.occurrence_count;
		`);

		// Append the prepared statement to the global batch queue for atomic execution
		batchStatements.push(aggregateErrorsStmt);
		console.log("Crash & Error aggregation tasks successfully prepared.");
	} catch (err: any) {
		console.error("Failed to process error aggregation:", err.message);
	}
}
