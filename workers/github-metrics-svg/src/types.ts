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

export interface Env {
	DB: D1Database;
}
