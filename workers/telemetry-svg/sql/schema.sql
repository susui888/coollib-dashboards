--npx wrangler d1 execute coollib --local --file=./sql/schema.sql
CREATE TABLE IF NOT EXISTS incidents
(
	id          TEXT PRIMARY KEY,                  -- 故障唯一 ID
	source      TEXT NOT NULL,                     -- 故障来源 (INFRA, PAGERDUTY)
	component   TEXT NOT NULL,                     -- 受影响的组件 (如 spring-boot-test)
	level       TEXT NOT NULL,                     -- 严重评级 (CRITICAL)
	title       TEXT NOT NULL,                     -- 故障简短标题
	message     TEXT,                              -- 详细堆栈日志
	status      TEXT NOT NULL DEFAULT 'active',    -- 状态: active 或 resolved
	created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP, -- 触发时间
	resolved_at DATETIME                           -- 恢复时间
);

INSERT OR REPLACE INTO incidents (id, source, component, level, title, message, status, created_at, resolved_at)
VALUES (
    'af96829e-17e2-4b67-8ff6-1c67200481a8',
    'INFRA',
    'spring-boot-test',
    'CRITICAL',
    'Spring Boot Server Unreachable',
    'Connection timeout (5s)',
    'resolved',
    '2026-06-16 06:09:01',
    '2026-06-16 06:12:57'
);

INSERT OR REPLACE INTO incidents (id, source, component, level, title, message, status, created_at, resolved_at)
VALUES (
    'billing-breach-WARNING-2026-06-17',
    'INFRA',
    'cloudflare-billing', -- 完美命中你的 Hono 路由白名单
    'WARNING',
    'D1 Quota Consumption Alert [Level: WARNING]',
    'Cloudflare GraphQL audit logged 104.6K rows read within the tracking cycle, breaching the WARNING marker.',
    'resolved',
    '2026-06-17 06:04:59',
    '2026-06-17 06:19:59' -- 👈 补充恢复时间戳（此处模拟耗时 15 分钟），使 MTTR 计算生效
);
