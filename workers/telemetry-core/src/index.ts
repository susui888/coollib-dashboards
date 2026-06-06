import { Hono } from 'hono';
import { cors } from 'hono/cors'; // 导入 cors 中间件
import { fetchStatsData, fetchAnalyticsData,fetchGithubMetricsData } from './repository';
import { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({
	origin: '*',
	allowMethods: ['GET', 'POST', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization'],
}));

// 业务统计接口
app.get('/api/stats', async (c) => {
	const range = c.req.query('range') || '7';
	try {
		const data = await fetchStatsData(c.env.DB, range);
		return c.json(data);
	} catch (e) {
		return c.json({ error: 'Failed to fetch stats' }, 500);
	}
});

// 系统监控分析接口
app.get('/api/analytics', async (c) => {
	const range = c.req.query('range') || '7';
	try {
		const data = await fetchAnalyticsData(c.env.DB, range);
		return c.json(data);
	} catch (e) {
		return c.json({ error: 'Failed to fetch analytics' }, 500);
	}
});

// GitHub 复合指标接口
app.get('/api/github-metrics', async (c) => {
	const range = c.req.query('range') || '30d';
	try {
		const data = await fetchGithubMetricsData(c.env.DB, range);
		return c.json(data);
	} catch (e) {
		return c.json({ error: 'Failed to fetch github metrics' }, 500);
	}
});

export default app;
