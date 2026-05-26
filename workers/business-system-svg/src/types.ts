export interface Env {
	DB: D1Database;
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
