export interface Env {
	DB: D1Database;
}

export interface StatsEntry {
	day: string;
	books: number;
	users: number;
	loans: number;
	reviews: number;
	review_images: number;
	timestamp: string;
}

export interface MetricQueryResult {
	time_label: string;
	cpu: number | null;
	memory: number | null;
	requests: number | null;
	db_conn: number | null;
	uptime: number | null;
	raw_time: string;
}

export interface GithubMetricResult {
	dataset_type: 'commit_activity' | 'code_growth' | 'repo_activity' | 'language_dist';
	metric_key: string;
	metric_value: number;
}

export interface PerformanceSummary {
	snapshot_date: string;
	os_platform: string;
	p50_ms: number;
	p95_ms: number;
	p99_ms: number;
	total_calls: number;
	error_rate: number;
}

export interface KeywordItem {
	keyword: string;
	count: number;
}

export interface FunnelSummary {
	os_platform: string;
	total_scan_open: number;
	total_scan_success: number;
	total_scan_miss: number;
	total_cart_view: number;
	total_rent_success: number;
	top_searched_keywords: KeywordItem[];
}

export interface ErrorSummary {
	error_name: string;
	os_platform: string;
	total_occurrences: number;
}

export interface ScreenVisitSummary {
	screen_name: string;
	os_platform: string;
	total_views: number;
}

export interface SlowEndpointSummary {
	endpoint: string;
	method: string;
	latency_ms: number;
	total_calls: number;
}
