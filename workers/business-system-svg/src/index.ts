import { Env } from "./types";
import { fetchMiniMonitorData } from "./repository";
import { renderMonitorSvg } from "./view";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/svg/system-telemetry.svg") {
			try {
				const cacheKey = new Request(url.toString(), request);
				const cache = typeof caches !== "undefined" ? caches.default : null;

				if (cache && !url.searchParams.has("refresh")) {
					const cachedResponse = await cache.match(cacheKey);
					if (cachedResponse) {
						const response = new Response(cachedResponse.body, cachedResponse);
						response.headers.set("X-MiniMonitor-Cache", "HIT");
						return response;
					}
				}

				const { scale, runtimeResults } = await fetchMiniMonitorData(env.DB);
				const svg = renderMonitorSvg(scale, runtimeResults);

				const response = new Response(svg, {
					headers: {
						"Content-Type": "image/svg+xml;charset=UTF-8",
						"Cache-Control": "public, max-age=1800, must-revalidate",
						"X-MiniMonitor-Signature": Math.random().toString(36).substring(2, 7).toUpperCase(),
						"X-MiniMonitor-Cache": "MISS"
					}
				});

				if (cache) {
					ctx.waitUntil(cache.put(cacheKey, response.clone()));
				}

				return response;

			} catch (err: any) {
				const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="260"><rect width="520" height="260" fill="#FFF5F5" stroke="#FEB2B2" stroke-width="2" rx="6"/><text x="30" y="50" font-family="monospace" font-size="14" fill="#C53030" font-weight="bold">🚨 MiniMonitor Cloudflare Exception</text><text x="30" y="90" font-family="monospace" font-size="12" fill="#742A2A">${err?.message || "Unknown Error"}</text></svg>`;
				return new Response(errorSvg, {
					headers: { "Content-Type": "image/svg+xml;charset=UTF-8" }
				});
			}
		}

		return new Response("Not Found", { status: 404 });
	}
};
