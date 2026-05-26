import { Env } from "./types";
import { fetchAnalyticsData } from "./repository";
import { renderDashboardHtml } from "./view";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);

			// 1. 边缘缓存识别 (对 Query 参数范围进行精确键切分)
			const cacheKey = new Request(url.toString(), request);
			const cache = caches.default;
			let response = await cache.match(cacheKey);

			if (response) {
				const cachedResponse = new Response(response.body, response);
				cachedResponse.headers.set("X-CoolLib-Cache", "HIT");
				return cachedResponse;
			}

			// 2. 缓存未命中：通过 Repository 调度远程云端 D1 数据库
			const range = url.searchParams.get("range") || "7";
			const results = await fetchAnalyticsData(env.DB, range);

			// 3. 通过 View 层组装经典的响应 HTML
			const html = renderDashboardHtml(results, range);

			// 4. 构建标准 Response 响应体与 CDN 精准强缓存控制
			response = new Response(html, {
				headers: {
					"Content-Type": "text/html;charset=UTF-8",
					// s-maxage=1800 告诉 Cloudflare 边缘节点缓存 30 分钟
					// max-age=0 确保用户的浏览器每次都向边缘发起请求检查，防止本地数据锁死
					"Cache-Control": "public, max-age=0, s-maxage=1800"
				}
			});

			// 5. 极客优化：使用 ctx.waitUntil 在后台静默写入边缘缓存，避免增加本次请求的 TTFB 延迟
			ctx.waitUntil(cache.put(cacheKey, response.clone()));

			return response;
		} catch (e: any) {
			return new Response(e.message || "Internal Server Error", { status: 500 });
		}
	}
};
