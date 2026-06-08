import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
    "/api/*",
    cors({
      origin: "*",
      allowMethods: ["POST", "GET", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    })
);

/**
 * 1. POST: Ingest Mobile App Events
 */
app.post("/api/mobile-telemetry/events", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.platform || !body.eventType || !body.eventName) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    const id = body.id || crypto.randomUUID();
    const timestamp = body.timestamp || Date.now();
    const attributes = body.attributes ? JSON.stringify(body.attributes) : null;

    await c.env.DB.prepare(`
      INSERT INTO mobile_telemetry_events (id, timestamp, platform, event_type, event_name, error_message, app_version, attributes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(id, timestamp, body.platform, body.eventType, body.eventName, body.errorMessage || null, body.appVersion || "1.0.0", attributes)
        .run();

    return c.json({ success: true, id }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * 2. POST: Ingest Mobile Network Performance Metrics
 */
app.post("/api/mobile-telemetry/metrics", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.platform || !body.endpoint || !body.method || body.statusCode === undefined || body.latencyMs === undefined) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    const id = body.id || crypto.randomUUID();
    const timestamp = body.timestamp || Date.now();

    await c.env.DB.prepare(`
      INSERT INTO mobile_telemetry_api_metrics (id, timestamp, platform, endpoint, method, status_code, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
        .bind(id, timestamp, body.platform, body.endpoint, body.method, body.statusCode, body.latencyMs)
        .run();

    return c.json({ success: true, id }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * 3. GET: Fetch Dashboard Aggregated Statistics (Top Screens, Top Events, API Latency, Error Events)
 * This endpoint aggregates data for charts. Default time range is the last 24 hours.
 */
app.get("/api/mobile-telemetry/dashboard", async (c) => {
  try {
    const timeAgo = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago in milliseconds

    // Query Top 5 Screens
    const topScreens = await c.env.DB.prepare(`
      SELECT event_name as screenName, COUNT(*) as count 
      FROM mobile_telemetry_events 
      WHERE event_type = 'SCREEN_VIEW' AND timestamp >= ?
      GROUP BY event_name 
      ORDER BY count DESC 
      LIMIT 5
    `).bind(timeAgo).all();

    // Query Top 5 Custom Events
    const topEvents = await c.env.DB.prepare(`
      SELECT event_name as eventName, COUNT(*) as count 
      FROM mobile_telemetry_events 
      WHERE event_type = 'CUSTOM_EVENT' AND timestamp >= ?
      GROUP BY event_name 
      ORDER BY count DESC 
      LIMIT 5
    `).bind(timeAgo).all();

    // Query Top Error Types/Messages
    const errorEvents = await c.env.DB.prepare(`
      SELECT event_name as errorType, error_message as message, COUNT(*) as count 
      FROM mobile_telemetry_events 
      WHERE event_type = 'ERROR' AND timestamp >= ?
      GROUP BY event_name, error_message 
      ORDER BY count DESC 
      LIMIT 5
    `).bind(timeAgo).all();

    // Query API Avg Latency & Success Rates
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
 * 4. GET: Fetch Live Event Stream
 * Returns the 50 most recent telemetry events for real-time tracking.
 */
app.get("/api/mobile-telemetry/stream", async (c) => {
  try {
    const liveStream = await c.env.DB.prepare(`
      SELECT id, timestamp, platform, event_type as eventType, event_name as eventName, error_message as errorMessage, app_version as appVersion, attributes
      FROM mobile_telemetry_events 
      ORDER BY timestamp DESC 
      LIMIT 50
    `).all();

    // Parse attributes JSON string back to object for frontend convenience
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

export default app;