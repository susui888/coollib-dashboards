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

export interface Env {
	DB: D1Database;
}
