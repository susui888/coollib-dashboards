import { Hono } from 'hono';
import { Env } from './types';

import { IncidentRepository } from './repository/incidentRepo';
import { renderIncidentSvg } from './views/incidentSvg';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/telemetry-alerts.svg', async (c) => {
	const incidentRepo = new IncidentRepository(c.env);
	const snapshot = await incidentRepo.getIncidentSnapshot();

	const svgContent = renderIncidentSvg(snapshot);

	c.header('Content-Type', 'image/svg+xml');
	c.header('Cache-Control', 'public, max-age=60, s-maxage=60');			// 设置 1 分钟缓存

	return c.body(svgContent);
});

export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
	}
};
