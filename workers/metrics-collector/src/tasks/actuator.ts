import { Env, ActuatorMetricResponse } from '../types';

export async function prepareActuatorTasks(env: Env, batchStatements: D1PreparedStatement[]): Promise<void> {
	const baseUrl = "https://coollib.ryansu.uk/actuator/metrics";
	const metricsToFetch = [
		"process.cpu.usage",
		"jvm.memory.used",
		"spring.security.http.secured.requests",
		"hikaricp.connections.active",
		"process.uptime"
	];

	try {
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

		const metricsMap: Record<string, number | null> = {};
		fetchedResults.forEach(item => {
			metricsMap[item.name] = item.value;
		});

		const currentTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

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
		console.log("Actuator statements prepared.");
	} catch (err: any) {
		console.error("Failed to process system metrics:", err.message);
	}
}
