import { Env } from "./types";
import { fetchStatsData } from "./repository";
import { renderDashboardHtml } from "./view";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);

			if (url.pathname !== "/") {
				return new Response("Not Found", { status: 404 });
			}

			// 1. 边缘缓存匹配 (精确匹配 Query 参数)
			const cacheKey = new Request(url.toString(), request);
			const cache = caches.default;
			let response = await cache.match(cacheKey);

			if (response) {
				const cachedResponse = new Response(response.body, response);
				cachedResponse.headers.set("X-CoolLib-Cache", "HIT");
				return cachedResponse;
			}

			// 2. 缓存未命中：通过 Model 调取 D1 数据库
			const range = url.searchParams.get("range") || "7";
			const results = await fetchStatsData(env.DB, range);

			if (!results || results.length === 0) {
				return new Response("No data available", { status: 200 });
			}

			// 按时间正序排序以供前端 Chart 渲染
			const sortedResults = results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

			// 3. 通过 View 层组装响应 HTML
			const html = renderDashboardHtml(sortedResults, range);

			// 4. 构建 Response 响应体与精准缓存策略 Header
			response = new Response(html, {
				headers: {
					"Content-Type": "text/html;charset=UTF-8",
					"Cache-Control": "public, max-age=0, s-maxage=1800"
				}
			});

			// 5. 后台静默写入 Cache
			ctx.waitUntil(cache.put(cacheKey, response.clone()));

			return response;
		} catch (err: any) {
			return new Response(err.stack || err.message, { status: 500 });
		}
	}
};
