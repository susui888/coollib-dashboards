-- wrangler d1 execute coollib --remote --file=./recover_spring_down.sql
UPDATE incidents
SET
    status = 'resolved',
    resolved_at = datetime('now')
WHERE
    component = 'spring-boot-test'
  AND status = 'active';