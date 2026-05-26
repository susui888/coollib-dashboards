export interface Env {
	DB: D1Database;
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
