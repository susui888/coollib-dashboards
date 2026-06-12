import { Env } from '../types';

export async function prepareErrorTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		const aggregateErrorsStmt = env.DB.prepare(`
            INSERT INTO summary_crash_errors (snapshot_date, os_platform, error_name, occurrence_count)
            SELECT
                DATE(timestamp / 1000, 'unixepoch') as snapshot_date,
                platform as os_platform,
                event_name as error_name,
                COUNT(*) as occurrence_count
            FROM mobile_telemetry_events
            WHERE event_name LIKE '%_FAILURE'
              AND datetime(timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
              AND datetime(timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day')
            GROUP BY snapshot_date, os_platform, error_name
            ON CONFLICT(snapshot_date, os_platform, error_name) DO UPDATE SET
                occurrence_count = excluded.occurrence_count;
        `);

		batchStatements.push(aggregateErrorsStmt);
		console.log("Crash & Error aggregation tasks successfully prepared.");
	} catch (err: any) {
		console.error("Failed to process error aggregation:", err.message);
	}
}
