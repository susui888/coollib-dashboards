import { Env } from '../types';

export async function prepareFunnelTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		// Prepare the SQL statement for conversion funnel and search keywords aggregation
		const aggregateFunnelStmt = env.DB.prepare(`
			INSERT INTO summary_business_funnel (snapshot_date, os_platform, scan_opened_count, scan_success_count, scan_miss_count, cart_viewed_count, rent_success_count, top_searched_keywords)
			SELECT
				-- Convert millisecond Unix timestamp to a YYYY-MM-DD date string
				DATE(e.timestamp / 1000, 'unixepoch') as snapshot_date,
				e.platform as os_platform,

				-- Step 1 of Funnel: Count total camera scanner access attempts
				SUM(CASE WHEN e.event_name = 'SCANNER_SCREEN' THEN 1 ELSE 0 END) as scan_opened_count,

				-- Step 2a of Funnel: Successful item discovery resulting in a cart add event triggered explicitly by a barcode scan
				SUM(CASE WHEN e.event_name = 'BOOK_ADD_CART' AND json_extract(e.attributes, '$.trigger_source') = 'BARCODE_SCANNER' THEN 1 ELSE 0 END) as scan_success_count,

				-- Step 2b of Funnel: Unsuccessful scans resulting in error blocks containing 'ISBN' references in error messages
				SUM(CASE WHEN e.event_name IN ('HOME_DATA_LOAD_FAILURE', 'BOOK_DETAIL_LOAD_FAILURE') AND json_extract(e.attributes, '$.message') LIKE '%ISBN%' THEN 1 ELSE 0 END) as scan_miss_count,

				-- Step 3 of Funnel: Total checkouts/cart overview navigation instances
				SUM(CASE WHEN e.event_name = 'CART_SCREEN' THEN 1 ELSE 0 END) as cart_viewed_count,

				-- Step 4 of Funnel: Finalized transactional order actions (Core Conversion)
				SUM(CASE WHEN e.event_name = 'BOOK_RENT_ACTION' THEN 1 ELSE 0 END) as rent_success_count,

				-- Correlated Subquery: Collect top 5 trending search queries into an immutable JSON array block
				(
				SELECT json_group_array(json_object('keyword', sub.kw, 'count', sub.cnt))
				FROM (
				SELECT
				json_extract(attributes, '$.query_text') as kw,
				COUNT(*) as cnt
				FROM mobile_telemetry_events
				WHERE event_name = 'BOOK_SEARCH'

				-- Bind search events to the exact contextual outer date scope and OS platform
				AND DATE(timestamp / 1000, 'unixepoch') = DATE(e.timestamp / 1000, 'unixepoch')
				AND platform = e.platform
				GROUP BY kw
				ORDER BY cnt DESC
				LIMIT 5
				) sub
				) as top_searched_keywords
			FROM mobile_telemetry_events e

			-- Lookback window processing: scope to data logged between 00:00:00 yesterday and 00:00:00 today
			WHERE datetime(e.timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
			  AND datetime(e.timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day')
			GROUP BY snapshot_date, os_platform

			-- Conflict handling logic: refresh existing indices with freshly aggregated tracking arrays
			ON CONFLICT(snapshot_date, os_platform) DO UPDATE SET
				scan_opened_count = excluded.scan_opened_count,
				scan_success_count = excluded.scan_success_count,
				scan_miss_count = excluded.scan_miss_count,
				cart_viewed_count = excluded.cart_viewed_count,
				rent_success_count = excluded.rent_success_count,
				top_searched_keywords = excluded.top_searched_keywords;
		`);

		// Append the completed statement to the global batch container for execution
		batchStatements.push(aggregateFunnelStmt);
		console.log("Telemetry funnel tasks successfully prepared.");
	} catch (err: any) {
		console.error("Failed to process funnel aggregation:", err.message);
	}
}
