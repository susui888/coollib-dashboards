export interface Env {
	PAGERDUTY_INTEGRATION_KEY: string;
	DB: D1Database;
}

export interface StatsCountsResponse {
	books: number;
	users: number;
	loans: number;
	reviews: number;
	reviewImage: number;
}

export interface ActuatorMetricResponse {
	measurements?: Array<{ statistic: string; value: number }>;
	availableTags?: Array<any>;
}
