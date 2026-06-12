import { Env, ActuatorMetricResponse } from '../types';

export async function prepareActuatorTasks(env: Env, batchStatements: D1PreparedStatement[]): Promise<void> {
	// Target base URL pointing to the production Spring Boot Actuator metrics subsystem
	const baseUrl = "https://coollib.ryansu.uk/actuator/metrics";

	// Explicit metric keys exposed by the Spring context registry to be polled
	const metricsToFetch = [
		"process.cpu.usage",
		"jvm.memory.used",
		"spring.security.http.secured.requests",
		"hikaricp.connections.active",
		"process.uptime"
	];

	try {
		// Step 1: Map each metric profile to an asynchronous HTTP fetch promise
		const fetchPromises = metricsToFetch.map(async (name) => {
			try {
				const response = await fetch(`${baseUrl}/${name}`);

				// Gracefully catch down-stream service disruptions without crashing the entire poll worker
				if (!response.ok) {
					console.warn(`Metric ${name} returned status ${response.status}`);
					return { name, value: null };
				}

				const data = await response.json() as ActuatorMetricResponse;
				const measurements = data.measurements || [];

				let value = 0;
				// Actuator extraction strategy: Request totalizer uses 'COUNT', whereas resources utilize raw snapshot indices
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

		// Step 2: Execute network I/O operations concurrently in parallel to maximize throughput
		const fetchedResults = await Promise.all(fetchPromises);

		// Consolidate the returned collection array into an associative key-value map for quick positional lookups
		const metricsMap: Record<string, number | null> = {};
		fetchedResults.forEach(item => {
			metricsMap[item.name] = item.value;
		});

		// Step 3: Format the precise current generation window into a SQLite-compatible datetime string (YYYY-MM-DD HH:MM:SS)
		const currentTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

		// Step 4: Construct a parameterized INSERT entry statement for state persistence
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

		// Step 5: Construct an automatic house-keeping eviction statement to drop stale indices (data retention period: 30 days)
		const deleteMetricsStmt = env.DB.prepare(
			"DELETE FROM app_metrics2 WHERE timestamp < datetime('now', '-30 days')"
		);

		// Push both entries onto the shared execution array to run inside a unified D1 database transaction block
		batchStatements.push(insertMetricsStmt, deleteMetricsStmt);
		console.log("Actuator statements prepared.");
	} catch (err: any) {
		console.error("Failed to process system metrics:", err.message);
	}
}
