import { Env } from '../types';

export async function prepareFunnelTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		const aggregateFunnelStmt = env.DB.prepare(`
            INSERT INTO summary_business_funnel (snapshot_date, os_platform, scan_opened_count, scan_success_count, scan_miss_count, cart_viewed_count, rent_success_count, top_searched_keywords)
            SELECT
                DATE(e.timestamp / 1000, 'unixepoch') as snapshot_date,
                e.platform as os_platform,
                SUM(CASE WHEN e.event_name = 'SCANNER_SCREEN' THEN 1 ELSE 0 END) as scan_opened_count,
                SUM(CASE WHEN e.event_name = 'BOOK_ADD_CART' AND json_extract(e.attributes, '$.trigger_source') = 'BARCODE_SCANNER' THEN 1 ELSE 0 END) as scan_success_count,
                SUM(CASE WHEN e.event_name IN ('HOME_DATA_LOAD_FAILURE', 'BOOK_DETAIL_LOAD_FAILURE') AND json_extract(e.attributes, '$.message') LIKE '%ISBN%' THEN 1 ELSE 0 END) as scan_miss_count,
                SUM(CASE WHEN e.event_name = 'CART_SCREEN' THEN 1 ELSE 0 END) as cart_viewed_count,
                SUM(CASE WHEN e.event_name = 'BOOK_RENT_ACTION' THEN 1 ELSE 0 END) as rent_success_count,
                (
                    SELECT json_group_array(json_object('keyword', sub.kw, 'count', sub.cnt))
                    FROM (
                        SELECT
                            json_extract(attributes, '$.query_text') as kw,
                            COUNT(*) as cnt
                        FROM mobile_telemetry_events
                        WHERE event_name = 'BOOK_SEARCH'
                          AND DATE(timestamp / 1000, 'unixepoch') = DATE(e.timestamp / 1000, 'unixepoch')
                          AND platform = e.platform
                        GROUP BY kw
                        ORDER BY cnt DESC
                        LIMIT 5
                    ) sub
                ) as top_searched_keywords
            FROM mobile_telemetry_events e
            WHERE datetime(e.timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
              AND datetime(e.timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day')
            GROUP BY snapshot_date, os_platform
            ON CONFLICT(snapshot_date, os_platform) DO UPDATE SET
                scan_opened_count = excluded.scan_opened_count,
                scan_success_count = excluded.scan_success_count,
                scan_miss_count = excluded.scan_miss_count,
                cart_viewed_count = excluded.cart_viewed_count,
                rent_success_count = excluded.rent_success_count,
                top_searched_keywords = excluded.top_searched_keywords;
        `);

		batchStatements.push(aggregateFunnelStmt);
		console.log("Telemetry funnel tasks successfully prepared.");
	} catch (err: any) {
		console.error("Failed to process funnel aggregation:", err.message);
	}
}
