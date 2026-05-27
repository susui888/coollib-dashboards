import { Env } from "./types";
import { fetchMiniMonitorData } from "./repository";
import { renderMonitorSvg } from "./view";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const url = new URL(request.url);

			if (url.pathname !== "/") {
				return new Response("Not Found", { status: 404 });
			}

			const cacheKey = new Request(url.toString(), request);
			const cache = caches.default;

			// 1. 尝试边缘缓存命中（拦截 ?refresh 以支持手动刷新）
			let response = await cache.match(cacheKey);
			if (response && !url.searchParams.has("refresh")) {
				const cachedResponse = new Response(response.body, response);
				cachedResponse.headers.set("X-MiniMonitor-Cache", "HIT");
				return cachedResponse;
			}

			// 2. 调度 Repository 进行双并发并行数据采集
			const { scale, runtimeResults } = await fetchMiniMonitorData(env.DB);

			// 3. 生成高像素 SVG 字符串
			const svg = renderMonitorSvg(scale, runtimeResults);

			// 4. 构建专门适用于 GitHub 缓存策略的图片响应头
			// - max-age=1800 驱使 GitHub Camo 代理和本地浏览器强制遵循 30 分钟生命周期
			response = new Response(svg, {
				headers: {
					"Content-Type": "image/svg+xml;charset=UTF-8",
					"Cache-Control": "public, max-age=1800",
					"X-MiniMonitor-Signature": Math.random().toString(36).substring(2, 7).toUpperCase()
				}
			});

			// 5. 异步写入持久缓存，绝不阻塞当前客户端图片下发
			ctx.waitUntil(cache.put(cacheKey, response.clone()));
			return response;

		} catch (err: any) {
			// 优雅降级：报错时渲染自带红字提示的红圈 SVG，防止在 Readme 挂载处显示破损图片
			const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260"><rect width="520" height="260" fill="#FFF5F5" stroke="#FEB2B2" stroke-width="2" rx="16"/><text x="30" y="50" font-family="monospace" font-size="14" fill="#C53030" font-weight="bold">🚨 MiniMonitor Cloudflare Exception</text><text x="30" y="90" font-family="monospace" font-size="12" fill="#742A2A">${err.message}</text></svg>`;
			return new Response(errorSvg, {
				headers: { "Content-Type": "image/svg+xml;charset=UTF-8" }
			});
		}
	}
};
