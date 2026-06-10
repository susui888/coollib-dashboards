import { Hono } from "hono";
import { Bindings } from "../types";

const telemetryApp = new Hono<{ Bindings: Bindings }>();

/**
 * POST: Ingest Single App Event
 * 🌟 已兼容 Android (snake_case) 与 iOS (camelCase)
 */
telemetryApp.post("/events", async (c) => {
    try {
        const body = await c.req.json();

        // 🌟 双向提取：优先拿驼峰，没有就拿蛇形
        const platform = body.platform;
        const eventType = body.eventType ?? body.event_type;
        const eventName = body.eventName ?? body.event_name;
        const errorMessage = body.errorMessage ?? body.error_message ?? null;
        const appVersion = body.appVersion ?? body.app_version ?? "1.0.0";
        const attributes = body.attributes ?? null;

        // 强校验：确保三个核心字段只要有一方提供了值即可放行
        if (!platform || !eventType || !eventName) {
            return c.json({ error: "Missing required fields" }, 400);
        }

        const eventPayload = {
            id: body.id || crypto.randomUUID(),
            timestamp: body.timestamp || Date.now(),
            platform: platform,
            eventType: eventType,
            eventName: eventName,
            errorMessage: errorMessage,
            appVersion: appVersion,
            attributes: attributes ? JSON.stringify(attributes) : null,
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
 * 🌟 已兼容 Android (snake_case) 与 iOS (camelCase)
 */
telemetryApp.post("/metrics", async (c) => {
    try {
        const body = await c.req.json();

        // 🌟 双向提取字段
        const platform = body.platform;
        const endpoint = body.endpoint;
        const method = body.method;
        const statusCode = body.statusCode ?? body.status_code;
        const latencyMs = body.latencyMs ?? body.latency_ms;

        // 强校验
        if (!platform || !endpoint || !method || statusCode === undefined || latencyMs === undefined) {
            return c.json({ error: "Missing required fields" }, 400);
        }

        const metricPayload = {
            id: body.id || crypto.randomUUID(),
            timestamp: body.timestamp || Date.now(),
            platform: platform,
            endpoint: endpoint,
            method: method,
            statusCode: statusCode,
            latencyMs: latencyMs,
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