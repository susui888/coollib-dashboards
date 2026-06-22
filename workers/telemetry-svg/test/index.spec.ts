import {beforeEach, describe, expect, it} from "vitest";
import {env, SELF} from "cloudflare:test";
import {Env} from "../src/types";

declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {
	}
}

describe("Mobile Analytics & SRE Telemetry Integration Endpoints", () => {

	beforeEach(async () => {
		// 初始化本地 D1 内存数据库的表结构，确保每个测试用例相互隔离
		await env.DB.batch([
			env.DB.prepare(`DROP TABLE IF EXISTS incidents;`),
			env.DB.prepare(`
				CREATE TABLE incidents
				(
					id          INTEGER PRIMARY KEY AUTOINCREMENT,
					status      TEXT NOT NULL,
					component   TEXT NOT NULL,
					title       TEXT NOT NULL,
					created_at  TEXT NOT NULL,
					resolved_at TEXT
				);
			`)
		]);
	});

	it("should gracefully handle 404 Routing for undefined root paths", async () => {
		// Hono 路由中未定义根路径，预期返回 404
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(404);
	});

	it("should compile and return live SRE Alert Monitor Canvas SVG via Route 3", async () => {
		// 1. 注入正常流转的模拟故障数据
		await env.DB.batch([
			env.DB.prepare(`
				INSERT INTO incidents (status, component, title, created_at, resolved_at)
				VALUES ('active', 'coollib-android', 'Telemetry Ingestion Pipeline runtime leak', '2026-06-20 05:10:00',
				        NULL);
			`),
			env.DB.prepare(`
				INSERT INTO incidents (status, component, title, created_at, resolved_at)
				VALUES ('resolved', 'cloudflare-billing', 'Workers Usage threshold sync throttled',
				        '2026-06-19 22:05:00', '2026-06-19 22:15:00');
			`)
		]);

		// 2. 真实请求 Hono 路由的 SVG 渲染端点
		const response = await SELF.fetch("https://example.com/api/telemetry-alerts.svg");

		// 3. 断言正常的 HTTP 核心指标
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("image/svg+xml");
		expect(response.headers.get("Cache-Control")).toContain("no-store");

		const svgText = await response.text();
		expect(svgText).toContain("<svg");
		expect(svgText).toContain("ryan (Primary)");
		expect(svgText).toContain("Telemetry Ingestion Pipeline runtime leak");
	});

	it("should failover gracefully inside repo and return 200 with fallback dataset on database panic", async () => {
		// 1. 故意删除 incidents 表，制造严重的 D1_ERROR 崩溃环境
		await env.DB.prepare(`DROP TABLE IF EXISTS incidents;`).run();

		// 2. 依然请求 Route 3 端点
		const response = await SELF.fetch("https://example.com/api/telemetry-alerts.svg");

		// 🎯 核心断言对齐：状态码必须是 200。因为仓储层的 catch 块吞掉了错误并返回了硬编码的自愈数据集，
		// 使得 Hono 能够继续正常渲染页面，从而确保了大盘挂载到 GitHub Readme 时不会变成裂开的图片。
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("image/svg+xml");

		const svgText = await response.text();

		// 3. 验证产出的 SVG 画布内容中是否包含你在 incidentRepo.ts 的 catch 分支中设定的经典 hardcoded 保底字段
		expect(svgText).toContain("66.7");
		expect(svgText).toContain("%");
	});
});
