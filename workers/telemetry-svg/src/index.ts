// src/index.ts
import { Hono } from 'hono';
import { DateSpanResult, Env } from './types';
import { fetchMiniMonitorData } from "./repository/springReop";
import { renderMonitorSvg } from "./views/springSvg";
import { IncidentRepository } from './repository/incidentRepo';
import { renderIncidentSvg } from './views/incidentSvg';
import { GithubRepository } from './repository/githubRepo';
import { GithubSvg } from './views/githubSvg';
import { LogRepository } from './repository/logRepo';
import { renderLogSvg } from './views/logsvg';
import { AndroidRepository } from "./repository/androidRepo";
import { AndroidAnalyticsSvg } from "./views/AndroidAnalyticsSvg";
import {iOSRepository} from "./repository/iOSRepo";
import {iOSAnalyticsSvg} from "./views/iOSAnalyticsSvg";

const app = new Hono<{ Bindings: Env }>();

const TELEMETRY_NO_CACHE_HEADERS = {
	'Content-Type': 'image/svg+xml;charset=UTF-8',
	'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
	'Pragma': 'no-cache',
	'Expires': '0'
} as const;

export function getRollingSevenDaySpan(now: Date = new Date()): DateSpanResult {
	const pad = (n: number) => String(n).padStart(2, '0');

	// Helper to format as SQL date standard: YYYY-MM-DD
	const toSqlFormat = (d: Date) =>
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

	// Helper to format as Display standard: YYYY.MM.DD
	const toDisplayFormat = (d: Date) =>
		`${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;

	const targetDate = toSqlFormat(now);

	// Roll backward exactly 6 days to safely capture a closed 7-day analytics matrix
	const startDate = new Date(now);
	startDate.setDate(now.getDate() - 6);

	const displaySpan = `${toDisplayFormat(startDate)} - ${toDisplayFormat(now)}`;

	return { targetDate, displaySpan };
}

// Global SRE telemetry error interceptor - Handles failover gracefully for all routes
app.onError((error, c) => {
	const errorMessage = error instanceof Error ? error.message : "Unknown telemetry failure";
	console.error(`Telemetry Panic: ${errorMessage}`);

	// Consistent fallback SVG asset canvas generation on exception
	const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260"><rect width="520" height="260" fill="#FFF5F5" stroke="#FEB2B2" stroke-width="2" rx="6"/><text x="30" y="50" font-family="monospace" font-size="14" fill="#C53030" font-weight="bold">🚨 Telemetry Pipeline Exception</text><text x="30" y="90" font-family="monospace" font-size="12" fill="#742A2A">${errorMessage}</text></svg>`;

	return c.text(errorSvg, 500, { 'Content-Type': 'image/svg+xml;charset=UTF-8' });
});

app.get('/api/telemetry-spring.svg', async (c) => {
	const { scale, runtimeResults } = await fetchMiniMonitorData(c.env.DB);
	const svgContent = renderMonitorSvg(scale, runtimeResults);

	return c.text(svgContent, 200, {
		"Content-Type": "image/svg+xml;charset=UTF-8",
		"Cache-Control": "public, max-age=1800, must-revalidate",
		"X-MiniMonitor-Signature": Math.random().toString(36).substring(2, 7).toUpperCase()
	});
});

app.get('/api/telemetry-github.svg', async (c) => {
	const metricsRepo = new GithubRepository(c.env.DB);
	const [totalStats, latestPush] = await Promise.all([
		metricsRepo.getTotalStats(),
		metricsRepo.getLatestPushMetric()
	]);

	const svgContent = GithubSvg.renderSvg(totalStats, latestPush);
	return c.body(svgContent, 200, TELEMETRY_NO_CACHE_HEADERS);
});

app.get('/api/telemetry-alerts.svg', async (c) => {
	const incidentRepo = new IncidentRepository(c.env);
	const snapshot = await incidentRepo.getIncidentSnapshot();
	const svgContent = renderIncidentSvg(snapshot);

	return c.body(svgContent, 200, TELEMETRY_NO_CACHE_HEADERS);
});

app.get('/api/telemetry-logs.svg', async (c) => {
	const logRepo = new LogRepository(c.env);

	try {
		const snapshot = await logRepo.getLogSnapshot();
		const svgContent = renderLogSvg(snapshot);

		return c.text(svgContent, 200, {
			'Content-Type': 'image/svg+xml;charset=UTF-8',
			// 缓存 2 分钟（120秒）
			'Cache-Control': 'public, max-age=120, s-maxage=120, must-revalidate',
		});
	} catch (error: any) {
		// 当数据库挂掉时，不缓存错误结果，设置不缓存
		return c.text(`SVG Generation Error: ${error.message}`, 500, {
			'Cache-Control': 'no-store, no-cache, max-age=0'
		});
	}
});


app.get('/api/telemetry-android.svg', async (c) => {
	const { targetDate, displaySpan } = getRollingSevenDaySpan();
	const repo = new AndroidRepository(c.env.DB);
	const metrics = await repo.fetchAndroidMetrics(targetDate);

	const svgContent = AndroidAnalyticsSvg.renderSvg(metrics, displaySpan);
	return c.body(svgContent, 200, TELEMETRY_NO_CACHE_HEADERS);
});

app.get('/api/telemetry-ios.svg', async (c) => {
	const { targetDate, displaySpan } = getRollingSevenDaySpan();
	const repo = new iOSRepository(c.env.DB);
	const metrics = await repo.fetchiOSMetrics(targetDate);

	const svgContent = iOSAnalyticsSvg.renderSvg(metrics, displaySpan);
	return c.body(svgContent, 200, TELEMETRY_NO_CACHE_HEADERS);
});

export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
	}
};


