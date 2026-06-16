import { Hono } from "hono";
import { Bindings } from "../types";

// Create a sub-router specifically for frontend dashboard data fetching
const dashboardApp = new Hono<{ Bindings: Bindings }>();

/**
 * GET: Fetch Dashboard Aggregated Statistics, not in use
 */
dashboardApp.get("/dashboard", async (c) => {
    try {
        const timeAgo = Date.now() - 24 * 60 * 60 * 1000;

        const topScreens = await c.env.DB.prepare(`
      SELECT event_name as screenName, COUNT(*) as count 
      FROM mobile_telemetry_events 
      WHERE event_type = 'SCREEN_VIEW' AND timestamp >= ?
      GROUP BY event_name 
      ORDER BY count DESC 
      LIMIT 5
    `).bind(timeAgo).all();

        const topEvents = await c.env.DB.prepare(`
      SELECT event_name as eventName, COUNT(*) as count 
      FROM mobile_telemetry_events 
      WHERE event_type = 'CUSTOM_EVENT' AND timestamp >= ?
      GROUP BY event_name 
      ORDER BY count DESC 
      LIMIT 5
    `).bind(timeAgo).all();

        const errorEvents = await c.env.DB.prepare(`
      SELECT event_name as errorType, error_message as message, COUNT(*) as count 
      FROM mobile_telemetry_events 
      WHERE event_type = 'ERROR' AND timestamp >= ?
      GROUP BY event_name, error_message 
      ORDER BY count DESC 
      LIMIT 5
    `).bind(timeAgo).all();

        const apiLatency = await c.env.DB.prepare(`
      SELECT 
        endpoint, 
        AVG(latency_ms) as avgLatencyMs, 
        COUNT(*) as totalRequests,
        SUM(CASE WHEN status_code >= 200 AND status_code < 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as successRate
      FROM mobile_telemetry_api_metrics 
      WHERE timestamp >= ?
      GROUP BY endpoint
      ORDER BY avgLatencyMs DESC
    `).bind(timeAgo).all();

        return c.json({
            success: true,
            data: {
                topScreens: topScreens.results,
                topEvents: topEvents.results,
                errorEvents: errorEvents.results,
                apiLatency: apiLatency.results
            }
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * GET: Fetch Live Event Stream, not in use
 */
dashboardApp.get("/stream", async (c) => {
    try {
        const liveStream = await c.env.DB.prepare(`
      SELECT id, timestamp, platform, event_type as eventType, event_name as eventName, error_message as errorMessage, app_version as appVersion, attributes
      FROM mobile_telemetry_events 
      ORDER BY timestamp DESC 
      LIMIT 50
    `).all();

        const formattedStream = liveStream.results.map((row: any) => ({
            ...row,
            attributes: row.attributes ? JSON.parse(row.attributes) : null
        }));

        return c.json({
            success: true,
            data: formattedStream
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default dashboardApp;