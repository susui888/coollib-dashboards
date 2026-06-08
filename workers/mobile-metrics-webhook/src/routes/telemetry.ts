import { Hono } from "hono";
import { Bindings } from "../types";

// Create a sub-router specifically for telemetry ingestion
const telemetryApp = new Hono<{ Bindings: Bindings }>();

/**
 * POST: Ingest Mobile App Events (Single Mode)
 */
telemetryApp.post("/events", async (c) => {
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
 * POST: Ingest Mobile App Events (Batch Mode)
 */
telemetryApp.post("/events/batch", async (c) => {
    try {
        const events = await c.req.json();
        if (!Array.isArray(events) || events.length === 0) {
            return c.json({ error: "Invalid payload, expected a non-empty array" }, 400);
        }

        const statements = events.map((body: any) => {
            const id = body.id || crypto.randomUUID();
            const timestamp = body.timestamp || Date.now();
            const attributes = body.attributes ? JSON.stringify(body.attributes) : null;

            return c.env.DB.prepare(`
        INSERT INTO mobile_telemetry_events (id, timestamp, platform, event_type, event_name, error_message, app_version, attributes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, timestamp, body.platform, body.eventType, body.eventName, body.errorMessage || null, body.appVersion || "1.0.0", attributes);
        });

        await c.env.DB.batch(statements);
        return c.json({ success: true, processedCount: events.length }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * POST: Ingest Mobile Network Performance Metrics (Single Mode)
 */
telemetryApp.post("/metrics", async (c) => {
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
 * POST: Ingest Mobile Network Performance Metrics (Batch Mode)
 */
telemetryApp.post("/metrics/batch", async (c) => {
    try {
        const metrics = await c.req.json();
        if (!Array.isArray(metrics) || metrics.length === 0) {
            return c.json({ error: "Invalid payload, expected a non-empty array" }, 400);
        }

        const statements = metrics.map((body: any) => {
            const id = body.id || crypto.randomUUID();
            const timestamp = body.timestamp || Date.now();

            return c.env.DB.prepare(`
        INSERT INTO mobile_telemetry_api_metrics (id, timestamp, platform, endpoint, method, status_code, latency_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, timestamp, body.platform, body.endpoint, body.method, body.statusCode, body.latencyMs);
        });

        await c.env.DB.batch(statements);
        return c.json({ success: true, processedCount: metrics.length }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default telemetryApp;