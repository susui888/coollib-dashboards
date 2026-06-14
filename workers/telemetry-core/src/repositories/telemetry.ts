import {
	PerformanceSummary,
	FunnelSummary,
	ErrorSummary,
	ScreenVisitSummary,
	SlowEndpointSummary,
	KeywordItem
} from "../types";

export async function fetchPerformanceData(db: any, range: string): Promise<PerformanceSummary[]> {
	const days = parseInt(range, 10) || 7;
	const { results } = await db.prepare(`
		SELECT snapshot_date, os_platform, p50_ms, p95_ms, p99_ms, total_requests as total_calls,
		       ROUND(CAST(error_requests AS REAL) / total_requests * 100, 2) as error_rate
		FROM summary_api_performance WHERE DATE(snapshot_date) >= DATE('now', ? || ' days') ORDER BY snapshot_date ASC
	`).bind(`-${days}`).all();
	return results as unknown as PerformanceSummary[];
}

// 定义一个内部专用的 D1 原始查询返回结构
interface FunnelRawRow {
	os_platform: string;
	total_scan_open: number;
	total_scan_success: number;
	total_scan_miss: number;
	total_cart_view: number;
	total_rent_success: number;
	raw_keywords: string;
}

export async function fetchFunnelData(db: any, range: string): Promise<FunnelSummary[]> {
	const days = parseInt(range, 10) || 7;
	const { results } = await db.prepare(`
		SELECT os_platform, SUM(scan_opened_count) as total_scan_open, SUM(scan_success_count) as total_scan_success,
		       SUM(scan_miss_count) as total_scan_miss, SUM(cart_viewed_count) as total_cart_view,
		       SUM(rent_success_count) as total_rent_success, json_group_array(top_searched_keywords) as raw_keywords
		FROM summary_business_funnel WHERE DATE(snapshot_date) >= DATE('now', ? || ' days') GROUP BY os_platform
	`).bind(`-${days}`).all();

	// 显式断言 results 的原始类型，让 map 中的 row 获得完美强类型约束
	const rows = results as unknown as FunnelRawRow[];

	return rows.map((row: FunnelRawRow) => {
		let mergedKeywords: KeywordItem[] = [];
		try {
			const parsedArrays = JSON.parse(row.raw_keywords) as string[];
			const kwMap = new Map<string, number>();
			for (const arrStr of parsedArrays) {
				if (!arrStr) continue;
				const items = typeof arrStr === 'string' ? JSON.parse(arrStr) : arrStr;
				for (const item of items) { kwMap.set(item.keyword, (kwMap.get(item.keyword) || 0) + item.count); }
			}
			mergedKeywords = Array.from(kwMap.entries()).map(([keyword, count]) => ({ keyword, count })).sort((a, b) => b.count - a.count).slice(0, 5);
		} catch (_) {}
		return {
			os_platform: row.os_platform,
			total_scan_open: row.total_scan_open,
			total_scan_success: row.total_scan_success,
			total_scan_miss: row.total_scan_miss,
			total_cart_view: row.total_cart_view,
			total_rent_success: row.total_rent_success,
			top_searched_keywords: mergedKeywords
		};
	});
}
export async function fetchErrorMetricsData(db: any, range: string): Promise<ErrorSummary[]> {
	const days = parseInt(range, 10) || 7;
	const { results } = await db.prepare(`
		SELECT error_name, os_platform, SUM(occurrence_count) as total_occurrences
		FROM summary_crash_errors WHERE DATE(snapshot_date) >= DATE('now', ? || ' days') GROUP BY error_name, os_platform ORDER BY total_occurrences DESC LIMIT 10
	`).bind(`-${days}`).all();
	return results as unknown as ErrorSummary[];
}

export async function fetchScreenVisitData(db: any, range: string): Promise<ScreenVisitSummary[]> {
	const days = parseInt(range, 10) || 7;
	const { results } = await db.prepare(`
		SELECT screen_name, os_platform, SUM(visit_count) as total_views
		FROM summary_screen_visits WHERE DATE(snapshot_date) >= DATE('now', ? || ' days') GROUP BY screen_name, os_platform ORDER BY total_views DESC LIMIT 12
	`).bind(`-${days}`).all();
	return results as unknown as ScreenVisitSummary[];
}

export async function fetchSlowEndpointsData(db: any, range: string): Promise<SlowEndpointSummary[]> {
	const days = parseInt(range, 10) || 7;
	const { results } = await db.prepare(`
		SELECT endpoint, method, ROUND(AVG(avg_latency_ms), 2) as latency_ms, SUM(call_count) as total_calls
		FROM summary_api_endpoints WHERE DATE(snapshot_date) >= DATE('now', ? || ' days') GROUP BY endpoint, method ORDER BY latency_ms DESC LIMIT 6
	`).bind(`-${days}`).all();
	return results as unknown as SlowEndpointSummary[];
}
