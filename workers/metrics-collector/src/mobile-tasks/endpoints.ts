import { Env } from '../types';

export async function prepareEndpointTasks(env: Env, batchStatements: any[]): Promise<void> {
	try {
		// Step 1: Fetch raw, unsanitized endpoint performance telemetry from yesterday
		const queryRaw = `
			SELECT
				-- Normalize millisecond Unix timestamp to a YYYY-MM-DD date string
				DATE(timestamp / 1000, 'unixepoch') as snapshot_date,
				endpoint,
				method,
				latency_ms
			FROM mobile_telemetry_api_metrics
			-- Lookback window filtering: fetch metrics from exactly 00:00:00 yesterday to 00:00:00 today
			WHERE datetime(timestamp / 1000, 'unixepoch') >= DATETIME('now', '-1 day', 'start of day')
			  AND datetime(timestamp / 1000, 'unixepoch') < DATETIME('now', 'start of day');
		`;

		const { results } = await env.DB.prepare(queryRaw).all();

		// Short-circuit execution if there are no tracking records for the day
		if (!results || results.length === 0) {
			console.log("No endpoint metrics found for yesterday.");
			return;
		}

		// Step 2: In-memory pipeline normalization and aggregation using an optimized HashMap
		// Compound Key composite structure: snapshot_date | normalized_endpoint | method
		const aggregationMap = new Map<string, {
			snapshot_date: string;
			endpoint: string;
			method: string;
			total_latency: number;
			call_count: number;
		}>();

		for (const row of results) {
			const date = row.snapshot_date as string;
			const originalEndpoint = (row.endpoint as string).trim();
			const method = row.method as string;
			const latency = row.latency_ms as number;

			// 🔄 V8 Regex Normalization Phase: Avoids High Cardinality issues in DB indexing
			// Pass 1: Collapse pure numeric route segments into generic path variables (e.g., /users/9 -> /users/:id)
			let normalizedEndpoint = originalEndpoint.replace(/\/\d+/g, '/:id');

			// Pass 2: Detect and flatten dynamic UGC/static assets (e.g., UUID-based filenames) into a :filename placeholder
			// Supports common asset formats (.webp, .jpg, etc.) with case-insensitivity (/i)
			//normalizedEndpoint = normalizedEndpoint.replace(/\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png|gif)$/i, '/:filename');
			normalizedEndpoint = normalizedEndpoint.replace(/\/[^/]+\.(webp|jpg|jpeg|png|gif)$/i, '/:filename');

			// Generate unique compound cache identifier for aggregation
			const aggKey = `${date}|${normalizedEndpoint}|${method}`;

			// Lazy-initialize bucket within map if it's the first encounter
			if (!aggregationMap.has(aggKey)) {
				aggregationMap.set(aggKey, {
					snapshot_date: date,
					endpoint: normalizedEndpoint,
					method: method,
					total_latency: 0,
					call_count: 0
				});
			}

			// Accumulate raw values for mathematical computing down the line
			const current = aggregationMap.get(aggKey)!;
			current.total_latency += latency;
			current.call_count += 1;
		}

		// Step 3: Iterate through consolidated records to generate parameterized D1 UPSERT statements
		for (const [_, item] of aggregationMap) {
			// Compute average latency rounded precisely to 2 decimal places
			const avgLatency = parseFloat((item.total_latency / item.call_count).toFixed(2));

			// Bind processed metrics safely using Cloudflare binding to mitigate SQL Injection vectors
			const insertEndpointStmt = env.DB.prepare(`
				INSERT INTO summary_api_endpoints (snapshot_date, endpoint, method, avg_latency_ms, call_count)
				VALUES (?, ?, ?, ?, ?)
				       -- Idempotency handler: updates latencies and call totals on collision
					ON CONFLICT(snapshot_date, endpoint, method) DO UPDATE SET
					avg_latency_ms = excluded.avg_latency_ms,
																		call_count = excluded.call_count;
			`).bind(item.snapshot_date, item.endpoint, item.method, avgLatency, item.call_count);

			// Append statements to the atomic transaction stack
			batchStatements.push(insertEndpointStmt);
		}

		console.log(`API endpoint tasks successfully prepared in memory. Rows to upsert: ${aggregationMap.size}`);
	} catch (err: any) {
		console.error("Failed to process endpoint aggregation in worker memory:", err.message);
	}
}
