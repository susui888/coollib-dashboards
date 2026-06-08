import { Bindings } from "../types";

export async function processTelemetryQueue(
    batch: MessageBatch<any>,
    env: Bindings,
    ctx: ExecutionContext
): Promise<void> {
    const statements: D1PreparedStatement[] = [];

    for (const message of batch.messages) {
        const { queueType, data } = message.body;

        if (queueType === "EVENT") {
            statements.push(
                env.DB.prepare(`
          INSERT INTO mobile_telemetry_events (id, timestamp, platform, event_type, event_name, error_message, app_version, attributes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
                    data.id,
                    data.timestamp,
                    data.platform,
                    data.eventType,
                    data.eventName,
                    data.errorMessage,
                    data.appVersion,
                    data.attributes
                )
            );
        }
        else if (queueType === "METRIC") {
            statements.push(
                env.DB.prepare(`
          INSERT INTO mobile_telemetry_api_metrics (id, timestamp, platform, endpoint, method, status_code, latency_ms)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
                    data.id,
                    data.timestamp,
                    data.platform,
                    data.endpoint,
                    data.method,
                    data.statusCode,
                    data.latencyMs
                )
            );
        }
    }

    // 不管桶里是事件还是指标，统统合并在一个事务里批量写入
    if (statements.length > 0) {
        try {
            await env.DB.batch(statements);
            console.log(`[Queue Consumer] Atomically flushed ${statements.length} mixed logs to D1.`);
        } catch (err) {
            console.error("[Queue Consumer] Batch D1 write failure:", err);
            throw err; // 抛出异常触发队列自动重试机制
        }
    }
}