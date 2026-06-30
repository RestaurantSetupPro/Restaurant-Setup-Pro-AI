# Deployment

## Runtime

- Source: GitHub `main`
- Runtime: Node.js 24 Web Service
- Production database: Supabase PostgreSQL
- Local database: SQLite when `DATABASE_URL` is absent
- Build: `npm install`
- Start: `npm start`

The server reads `process.env.PORT` and binds to `0.0.0.0`.

## Environment Variables

`NODE_ENV`, `DATABASE_URL`, `DATABASE_SSL`, `RUN_MIGRATIONS`, `SESSION_HOURS`, and `SEED_PASSWORD` are configured outside Git. Never commit secrets.

## Module 05 Migration

Apply `001_initial_schema.sql`, then `002_product_intelligence.sql`. Migration 002 is additive and preserves existing product records. With `RUN_MIGRATIONS=true`, startup applies and verifies both versions.

## Verification

1. `GET /api/health` → HTTP 200 and `{"status":"ok"}`.
2. `GET /api/debug/db` → connected, migrated, and version `002_product_intelligence`.
3. Admin login and Product Intelligence workflows succeed.
4. `npm test` passes with zero failures.

## Rollback

Redeploy the last accepted Module 04 commit. Do not drop Module 05 columns or relation tables during application rollback; they are backward-compatible and retain data. Restore a verified pre-migration backup only with formal approval.
