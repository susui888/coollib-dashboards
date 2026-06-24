// src/types.ts

export interface LogEntry {
	status: 'active' | 'resolved';
	title: string;
	created_at: string;
}

export interface IncidentSnapshotMetrics {
	active_incidents: number;
	clearance_rate: number;
	avg_mttr: string;
	on_call_primary: string;
	recent_logs: LogEntry[];
}

export interface TotalStats {
	commits: number;
	pushes: number;
	repos: number;
	ciSuccess: string;
}

export interface D1PushRow {
	repository_name: string;
	sender_login: string;
	created_at: string;
	branch: string;
	language: string | null;
	changed_count: number;
}

export interface ScaleMetrics {
	books: number;
	users: number;
	loans: number;
	reviews: number;
	review_images: number;
	timestamp: string | Date;
}

export interface RuntimeRawRow {
	metric_name: string;
	metric_value: number;
}

export interface Env {
	DB: D1Database;
}

export interface LogEvent {
	id: number;
	timestamp: string; // ISO 8601 string from Instant
	environment: string;
	platform: string;
	level: string;
	traceId: string | null;
	tag: string | null;
	message: string;
	stackTrace: string | null;
}

export interface LogMetrics {
	total_logs: number;
	error_count: number;
	active_traces: number;
	recent_logs: LogEvent[];
}


export interface MobileAnalyticsMetrics {
	/** Total HTTP request volume intercepted from summary_api_performance */
	total_requests: number;

	/** Computed network failure percentage: (error_requests / total_requests) * 100 */
	error_rate: number;

	/** Rounded 95th percentile network latency in milliseconds */
	p95_latency_ms: number;

	/** Computed business conversion percentage: (rent_success / scan_opened) * 100 */
	funnel_conversion_rate: number;

	/** Highly trending single search term extracted from funnel metadata */
	top_keyword: string;

	/** Name/Signature of the most frequent Android runtime exception */
	top_crash_name: string;

	/** Total occurrence counter for the primary runtime exception */
	top_crash_count: number;
}

export interface DateSpanResult {
	targetDate: string;   // "YYYY-MM-DD" for SQL telemetry queries
	displaySpan: string;  // "YYYY.MM.DD - YYYY.MM.DD" for SVG panel header
}
