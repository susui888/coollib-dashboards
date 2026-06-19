// src/types.ts
// Update your types file to sync with the new SQL schema

export interface LogEntry {
	status: 'active' | 'resolved';
	title: string;
	created_at: string; // 🚨 从 component 变更为 created_at
}

export interface IncidentSnapshotMetrics {
	active_incidents: number;
	clearance_rate: number;
	avg_mttr: string;
	on_call_primary: string;
	recent_logs: LogEntry[]; // 确保它使用的是更新后的 LogEntry
}

export interface Env {
	DB: D1Database;
}
