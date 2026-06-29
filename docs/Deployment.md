# Deployment

## Target Architecture

- Source control: GitHub `main`
- Application runtime: Node.js Web Service
- Database: Supabase PostgreSQL
- Health endpoint: `GET /api/health`
- Database diagnostics: `GET /api/debug/db`

## Commands

```text
Build: npm install
Start: npm start
```

The server must use `process.env.PORT` and listen on `0.0.0.0`.

## Required Environment Variables

- `NODE_ENV`
- `DATABASE_URL`
- `DATABASE_SSL`
- `RUN_MIGRATIONS`
- `SESSION_HOURS`
- `SEED_PASSWORD`

Never commit passwords, database URLs, tokens, or API keys.

## Verification

1. Confirm `/api/health` returns HTTP 200 with `{"status":"ok"}`.
2. Confirm `/api/debug/db` reports connection and migration state.
3. Confirm an authorized user can sign in.
4. Run the Module 01–04 smoke tests.

## Rollback

Redeploy the last accepted commit. Migration 001 is additive; do not drop production tables during an application rollback.
