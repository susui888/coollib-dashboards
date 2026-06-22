import { Env, LogEvent, LogMetrics } from '../types';

export class LogRepository {
	private apiUrl = "https://coollib.ryansu.uk/api/telemetry/logs";

	constructor(private env: Env) {}

	async getLogSnapshot(): Promise<LogMetrics> {
		// Fetch the latest 50 logs from the Spring Boot backend
		const targetUrl = `${this.apiUrl}?size=50&sort=timestamp,desc`;

		const response = await fetch(targetUrl, {
			method: 'GET',
			headers: {
				'User-Agent': 'Cloudflare-Worker-SVG-Generator',
				'Accept': 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`Backend fetch failed: ${response.status}`);
		}

		// Parse the Spring Data JPA Pageable response
		const data = await response.json() as { content: LogEvent[], totalElements: number };
		const logs: LogEvent[] = data.content || [];

		// Compute edge-side analytics for the dashboard
		const errorCount = logs.filter(log => log.level === 'ERROR' || log.level === 'FATAL').length;
		const uniqueTraces = new Set(logs.map(log => log.traceId).filter(Boolean));

		return {
			total_logs: data.totalElements || logs.length,
			error_count: errorCount,
			active_traces: uniqueTraces.size,
			recent_logs: logs.slice(0, 5) // Extract the 4 most recent events for the SVG pipeline
		};
	}
}
