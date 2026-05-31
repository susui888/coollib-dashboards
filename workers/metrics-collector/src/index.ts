import { Hono } from 'hono';

export interface Env {
	DB: D1Database;
}

interface StatsCountsResponse {
	books: number;
	users: number;
	loans: number;
	reviews: number;
	reviewImage: number;
}

interface ActuatorMetricResponse {
	measurements?: Array<{ statistic: string; value: number }>;
	availableTags?: Array<any>;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) =>
	c.text('Metrics Collector Worker is running.'));


export default {
	// 转发 HTTP 请求到 Hono 路由
	fetch: app.fetch,

	// 响应由 wrangler.jsonc 或网页端配置的 Cron 定时任务
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Cron trigger started at: ${new Date().toISOString()}`);

		// 初始化批量执行的语句队列，后续把所有操作合并为一个事务
		const batchStatements: D1PreparedStatement[] = [];

		// ==========================================
		// Part 1: Fetch and sync core business metrics (Stats Counts)
		// ==========================================
		try {
			const resp = await fetch("https://coollib.ryansu.uk/api/stats/counts");
			if (resp.ok) {
				const data = await resp.json() as StatsCountsResponse;

				// 压入 Stats 插入和清理语句
				batchStatements.push(
					env.DB.prepare(
						"INSERT INTO stats_history (books, users, loans, reviews, review_images) VALUES (?, ?, ?, ?, ?)"
					).bind(data.books, data.users, data.loans, data.reviews, data.reviewImage),
					env.DB.prepare(
						"DELETE FROM stats_history WHERE timestamp < datetime('now', '-30 days')"
					)
				);
				console.log("Stats statements prepared.");
			} else {
				console.error(`Failed to fetch stats counts: ${resp.status}`);
			}
		} catch (err: any) {
			console.error("Failed to process stats counts:", err.message);
		}

		// ==========================================
		// Part 2: Fetch and sync system telemetry metrics (Spring Actuator)
		// ==========================================
		const baseUrl = "https://coollib.ryansu.uk/actuator/metrics";
		const metricsToFetch = [
			"process.cpu.usage",
			"jvm.memory.used",
			"spring.security.http.secured.requests",
			"hikaricp.connections.active",
			"process.uptime"
		];

		try {
			// 并发请求所有 Actuator 指标
			const fetchPromises = metricsToFetch.map(async (name) => {
				try {
					const response = await fetch(`${baseUrl}/${name}`);
					if (!response.ok) {
						console.warn(`Metric ${name} returned status ${response.status}`);
						return { name, value: null };
					}

					const data = await response.json() as ActuatorMetricResponse;
					const measurements = data.measurements || [];

					let value = 0;
					if (name === "spring.security.http.secured.requests") {
						value = measurements.find(m => m.statistic === "COUNT")?.value || 0;
					} else {
						value = measurements[0]?.value || 0;
					}
					return { name, value };
				} catch (err: any) {
					console.error(`Fetch failed for ${name}:`, err.message);
					return { name, value: null };
				}
			});

			const fetchedResults = await Promise.all(fetchPromises);

			// 将数组结果转换为 Key-Value 字典对象方便宽表字段对齐
			const metricsMap: Record<string, number | null> = {};
			fetchedResults.forEach(item => {
				metricsMap[item.name] = item.value;
			});

			// 生成当前高精度 UTC 时间（YYYY-MM-DD HH:MM:SS）
			const currentTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

			// 准备宽表的单行 INSERT 和清理语句并压入队列
			const insertMetricsStmt = env.DB.prepare(`
                INSERT INTO app_metrics2 (
                    timestamp,
                    cpu_usage,
                    jvm_memory_used,
                    http_requests,
                    active_db_connections,
                    uptime
                ) VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
				currentTimestamp,
				metricsMap["process.cpu.usage"],
				metricsMap["jvm.memory.used"],
				metricsMap["spring.security.http.secured.requests"],
				metricsMap["hikaricp.connections.active"],
				metricsMap["process.uptime"]
			);

			const deleteMetricsStmt = env.DB.prepare(
				"DELETE FROM app_metrics2 WHERE timestamp < datetime('now', '-30 days')"
			);

			batchStatements.push(insertMetricsStmt, deleteMetricsStmt);

		} catch (err: any) {
			console.error("Failed to process system metrics:", err.message);
		}

		// ==========================================
		// Part 3: Atomically execute everything via a single D1 Batch
		// ==========================================
		if (batchStatements.length > 0) {
			try {
				await env.DB.batch(batchStatements);
				console.log(`🎉 [D1 Success] Batch transaction completed. Prepared operations executed: ${batchStatements.length}`);
			} catch (batchErr: any) {
				console.error("❌ D1 Batch execution failed:", batchErr.message);
			}
		} else {
			console.log("No data fetched from any sources. Batch skipped.");
		}
	}
};
