// src/index.ts
import { Hono } from 'hono';
import { Env } from './types';

// Route 1 (System Telemetry Dashboard)
import { fetchMiniMonitorData } from "./repository/springReop";
import { renderMonitorSvg } from "./views/springSvg";

// Route 2 & 3 (Incident Monitor & GitHub Activity Dashboard)
import { IncidentRepository } from './repository/incidentRepo';
import { renderIncidentSvg } from './views/incidentSvg';
import { GithubRepository } from './repository/githubRepo';
import { GithubSvg } from './views/githubSvg';

import { LogRepository } from './repository/logRepo';
import { renderLogSvg } from './views/logsvg';

const app = new Hono<{ Bindings: Env }>();

// Global SRE telemetry error interceptor - Handles failover gracefully for all routes
app.onError((error, c) => {
	const errorMessage = error instanceof Error ? error.message : "Unknown telemetry failure";
	console.error(`Telemetry Panic: ${errorMessage}`);

	// Consistent fallback SVG asset canvas generation on exception
	const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260"><rect width="520" height="260" fill="#FFF5F5" stroke="#FEB2B2" stroke-width="2" rx="6"/><text x="30" y="50" font-family="monospace" font-size="14" fill="#C53030" font-weight="bold">🚨 Telemetry Pipeline Exception</text><text x="30" y="90" font-family="monospace" font-size="12" fill="#742A2A">${errorMessage}</text></svg>`;

	return c.text(errorSvg, 500, { 'Content-Type': 'image/svg+xml;charset=UTF-8' });
});

/**
 * Route 1: System Telemetry MiniMonitor (Clean 30-Min Edge Cached Layer)
 */
app.get('/api/telemetry-spring.svg', async (c) => {
	const { scale, runtimeResults } = await fetchMiniMonitorData(c.env.DB);
	const svgContent = renderMonitorSvg(scale, runtimeResults);

	return c.text(svgContent, 200, {
		"Content-Type": "image/svg+xml;charset=UTF-8",
		"Cache-Control": "public, max-age=1800, must-revalidate",
		"X-MiniMonitor-Signature": Math.random().toString(36).substring(2, 7).toUpperCase()
	});
});


/**
 * Route 2: GitHub Commits & Activity Dashboard
 */
app.get('/api/telemetry-github.svg', async (c) => {
	const metricsRepo = new GithubRepository(c.env.DB);

	const [totalStats, latestPush] = await Promise.all([
		metricsRepo.getTotalStats(),
		metricsRepo.getLatestPushMetric()
	]);

	const svgContent = GithubSvg.renderSvg(totalStats, latestPush);

	return c.text(svgContent, 200, {
		'Content-Type': 'image/svg+xml;charset=UTF-8',
		'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
		'Pragma': 'no-cache',
		'Expires': '0'
	});
});


/**
 * Route 3: Live Incident & SRE Alert Monitor Canvas
 */
app.get('/api/telemetry-alerts.svg', async (c) => {
	const incidentRepo = new IncidentRepository(c.env);
	const snapshot = await incidentRepo.getIncidentSnapshot();
	const svgContent = renderIncidentSvg(snapshot);

	return c.text(svgContent, 200, {
		'Content-Type': 'image/svg+xml;charset=UTF-8',
		'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
		'Pragma': 'no-cache',
		'Expires': '0'
	});
});


app.get('/api/telemetry-logs.svg', async (c) => {
	const logRepo = new LogRepository(c.env);

	try {
		const snapshot = await logRepo.getLogSnapshot();
		const svgContent = renderLogSvg(snapshot);

		// Crucial headers to bypass GitHub Camo aggressive image caching
		return c.text(svgContent, 200, {
			'Content-Type': 'image/svg+xml;charset=UTF-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0',
			'Pragma': 'no-cache',
			'Expires': '0',
			'Surrogate-Control': 'no-store'
		});
	} catch (error: any) {
		// Fallback minimal SVG error rendering could go here
		return c.text(`SVG Generation Error: ${error.message}`, 500);
	}
});


// export default {
// 	fetch: app.fetch,
// 	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
// 	}
// };

export default {
	fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
	}
};
