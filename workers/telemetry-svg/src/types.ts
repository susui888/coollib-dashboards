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
