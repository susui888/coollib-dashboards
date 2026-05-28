import { TelemetryData } from "./types";
import { MetricsRepository } from "./repository";
import { renderTelemetrySvg } from "./view";

export interface Env {
	DB: D1Database;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/svg/github-telemetry.svg") {
			try {
				const repo = new MetricsRepository(env.DB);

				const [totalStats, latestPush] = await Promise.all([
					repo.getTotalStats(),
					repo.getLatestPushMetric()
				]);

				let lastPushStr = "Just now";
				if (latestPush && latestPush.created_at) {
					const diffMs = Date.now() - new Date(latestPush.created_at + "Z").getTime();
					const diffMins = Math.floor(diffMs / 60000);
					if (diffMins > 0) {
						lastPushStr = diffMins >= 60
							? `${Math.floor(diffMins / 60)}h ago`
							: `${diffMins}m ago`;
					}
				}

				const telemetry: TelemetryData = {
					commits: totalStats.commits.toString(),
					pushes: totalStats.pushes.toString(),
					repos: totalStats.repos.toString(),
					lastPush: lastPushStr,
					latestRepo: latestPush?.repository_name ? latestPush.repository_name.replace("coollib-", "") : "dash",
					branch: latestPush?.branch || "main",
					language: latestPush?.language === "TypeScript" ? "TypeScript" : (latestPush?.language || "JavaScript"),
					actor: latestPush?.sender_login === "susui888" ? "Ryan Su" : (latestPush?.sender_login || "Ryan Su"),
					changed: latestPush?.changed_count?.toString() || "0",
					ci: totalStats.ciSuccess
				};

				return new Response(renderTelemetrySvg(telemetry), {
					headers: {
						"Content-Type": "image/svg+xml",
						"Cache-Control": "public, max-age=1800, must-revalidate",
						"Expires": new Date(Date.now() + 1800000).toUTCString()
					}
				});

			} catch (err) {
				return new Response("Internal Server Error", { status: 500 });
			}
		}

		return new Response("Not Found", { status: 404 });
	}
};
