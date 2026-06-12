import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { fetchStatsData } from './repositories/business';
import { fetchAnalyticsData } from './repositories/system';
import { fetchGithubMetricsData, fetchGithubLatestData } from './repositories/github';
import {
	fetchPerformanceData,
	fetchFunnelData,
	fetchErrorMetricsData,
	fetchScreenVisitData,
	fetchSlowEndpointsData
} from './repositories/telemetry';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({
	origin: '*',
	allowMethods: ['GET', 'POST', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/api/stats', async (c) => {
	try {
		return c.json(await fetchStatsData(c.env.DB, c.req.query('range') || '7'));
	} catch (e) {
		return c.json({ error: 'Failed to fetch stats' }, 500);
	}
});

app.get('/api/analytics', async (c) => {
	try {
		return c.json(await fetchAnalyticsData(c.env.DB, c.req.query('range') || '7'));
	} catch (e) {
		return c.json({ error: 'Failed to fetch analytics' }, 500);
	}
});

app.get('/api/github-metrics', async (c) => {
	try {
		return c.json(await fetchGithubMetricsData(c.env.DB, c.req.query('range') || '30d'));
	} catch (e) {
		return c.json({ error: 'Failed to fetch github metrics' }, 500);
	}
});

app.get('/api/github-latest', async (c) => {
	try {
		return c.json(await fetchGithubLatestData(c.env.DB));
	} catch (e) {
		return c.json({ error: 'Failed to fetch github latest data' }, 500);
	}
});

app.get('/api/portfolio/performance', async (c) => {
	try {
		return c.json({ success: true, data: await fetchPerformanceData(c.env.DB, c.req.query('range') || '7') });
	} catch (e: any) {
		return c.json({ success: false, error: e.message }, 500);
	}
});

app.get('/api/portfolio/funnel', async (c) => {
	try {
		return c.json({ success: true, data: await fetchFunnelData(c.env.DB, c.req.query('range') || '7') });
	} catch (e: any) {
		return c.json({ success: false, error: e.message }, 500);
	}
});

app.get('/api/portfolio/errors', async (c) => {
	try {
		return c.json({ success: true, data: await fetchErrorMetricsData(c.env.DB, c.req.query('range') || '7') });
	} catch (e: any) {
		return c.json({ success: false, error: e.message }, 500);
	}
});

app.get('/api/portfolio/screens', async (c) => {
	try {
		return c.json({ success: true, data: await fetchScreenVisitData(c.env.DB, c.req.query('range') || '7') });
	} catch (e: any) {
		return c.json({ success: false, error: e.message }, 500);
	}
});

app.get('/api/portfolio/slow-endpoints', async (c) => {
	try {
		return c.json({ success: true, data: await fetchSlowEndpointsData(c.env.DB, c.req.query('range') || '7') });
	} catch (e: any) {
		return c.json({ success: false, error: e.message }, 500);
	}
});

export default app;
