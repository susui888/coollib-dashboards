-- wrangler d1 execute coollib --remote --file=./inject_spring_down.sql

INSERT INTO incidents (id, source, component, level, title, message, status, created_at)
VALUES (lower(hex(randomblob(4))) || '-' ||
        lower(hex(randomblob(2))) || '-' ||
        '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
        substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
        lower(hex(randomblob(6))),
        'INFRA',
        'spring-boot-test',
        'CRITICAL',
        'Spring Boot Server Unreachable',
        'Connection timeout (5s) - test',
        'active',
        datetime('now'));