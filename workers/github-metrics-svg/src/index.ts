import { Env } from "./types";
import { MetricsRepository } from "./repository";
import { MetricsView } from "./view";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);

			// 严格匹配特定的请求方法与路由路径
			if (request.method === "GET" && url.pathname === "/svg/github-telemetry.svg") {
				const repository = new MetricsRepository(env.DB);

				// 并行抓取 D1 汇总数据与最新的一条 Push 度量
				const [totalStats, latestPush] = await Promise.all([
					repository.getTotalStats(),
					repository.getLatestPushMetric()
				]);

				// 编译 10 指标 SVG 仪表盘
				const svgContent = MetricsView.renderSvg(totalStats, latestPush);

				return new Response(svgContent, {
					status: 200,
					headers: {
						"Content-Type": "image/svg+xml",
						"Cache-Control": "no-cache, no-store, must-revalidate",
						"Pragma": "no-cache",
						"Expires": "0"
					}
				});
			}

			// 路由未匹配时的降级响应
			return new Response("Not Found", { status: 404 });

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown telemetry failure";
			return new Response(`Error loading metrics dashboard: ${errorMessage}`, {
				status: 500,
				headers: { "Content-Type": "text/plain" }
			});
		}
	}
};
