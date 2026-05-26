// workers/business-dash/src/types.ts

export interface StatsEntry {
	day: string;
	books: number;
	users: number;
	loans: number;
	reviews: number;
	review_images: number;
	timestamp: string;
}

export interface Env {
	DB: D1Database;
}
