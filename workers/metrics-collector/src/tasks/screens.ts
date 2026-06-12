import { Env } from '../types';

export async function prepareScreenVisitTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		const aggregateScreensStmt = env.DB.prepare(`
            INSERT INTO summary_screen_visits (snapshot_date, os_platform, screen_name, visit_count)
            SELECT
                DATE(timestamp / 1000, 'unixepoch') as snapshot_date,
                platform as os_platform,
                event_name as screen_name,
                COUNT(*) as visit_count
            FROM mobile_telemetry_events
            WHERE event_name LIKE '%_SCREEN'
              AND datetime(timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
              AND datetime(timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day')
            GROUP BY snapshot_date, os_platform, screen_name
            ON CONFLICT(snapshot_date, os_platform, screen_name) DO UPDATE SET
                visit_count = excluded.visit_count;
        `);

		batchStatements.push(aggregateScreensStmt);
		console.log("Screen visit ranking tasks successfully prepared.");
	} catch (err: any) {
		console.error("Failed to process screen visit aggregation:", err.message);
	}
}
