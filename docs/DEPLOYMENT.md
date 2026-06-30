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

## Module 05.1 Migration

Apply migrations 001, 002, then `003_ai_product_content_factory.sql`. Migration 003 adds only Factory workflow tables and indexes. With `RUN_MIGRATIONS=true`, startup applies and verifies all versions.

## Verification

1. `GET /api/health` → HTTP 200 and `{"status":"ok"}`.
2. `GET /api/debug/db` → connected, migrated, and version `003_ai_product_content_factory`.
3. Admin login and Product Intelligence workflows succeed.
4. `npm test` passes with zero failures.

## Rollback

Redeploy the last accepted Module 05 commit. Do not drop Module 05.1 draft/task tables during an application rollback; retaining them preserves review history and remains backward-compatible. Restore a verified pre-migration backup only with formal approval.
