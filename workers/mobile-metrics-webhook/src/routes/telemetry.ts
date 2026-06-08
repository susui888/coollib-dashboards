import { Hono } from "hono";
import { Bindings } from "../types";

const telemetryApp = new Hono<{ Bindings: Bindings }>();

/**
 * POST: Ingest Single App Event
 */
telemetryApp.post("/events", async (c) => {
    try {
        const body = await c.req.json();
        if (!body.platform || !body.eventType || !body.eventName) {
            return c.json({ error: "Missing required fields" }, 400);
        }

        const eventPayload = {
            id: body.id || crypto.randomUUID(),
            timestamp: body.timestamp || Date.now(),
            platform: body.platform,
            eventType: body.eventType,
            eventName: body.eventName,
            errorMessage: body.errorMessage || null,
            appVersion: body.appVersion || "1.0.0",
            attributes: body.attributes ? JSON.stringify(body.attributes) : null,
        };

        // 打上 EVENT 标签，送入统一队列
        await c.env.TELEMETRY_QUEUE.send({
            queueType: "EVENT",
            data: eventPayload
        });

        return c.json({ success: true, status: "queued", id: eventPayload.id }, 202);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

/**
 * POST: Ingest Single API Metric
 */
telemetryApp.post("/metrics", async (c) => {
    try {
        const body = await c.req.json();
        if (!body.platform || !body.endpoint || !body.method || body.statusCode === undefined || body.latencyMs === undefined) {
            return c.json({ error: "Missing required fields" }, 400);
        }

        const metricPayload = {
            id: body.id || crypto.randomUUID(),
            timestamp: body.timestamp || Date.now(),
            platform: body.platform,
            endpoint: body.endpoint,
            method: body.method,
            statusCode: body.statusCode,
            latencyMs: body.latencyMs,
        };

        // 打上 METRIC 标签，送入同一个队列
        await c.env.TELEMETRY_QUEUE.send({
            queueType: "METRIC",
            data: metricPayload
        });

        return c.json({ success: true, status: "queued", id: metricPayload.id }, 202);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default telemetryApp;