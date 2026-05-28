export interface TotalStats {
	commits: number;
	pushes: number;
	repos: number;
	ciSuccess: string;
}

export interface D1PushRow {
	repository_name: string | null;
	sender_login: string | null;
	created_at: string | null;
	branch: string | null;
	language: string | null;
	changed_count: number | null;
}

export interface TelemetryData {
	commits: string;
	pushes: string;
	repos: string;
	lastPush: string;
	latestRepo: string;
	branch: string;
	language: string;
	actor: string;
	changed: string;
	ci: string;
}
