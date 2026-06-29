# Bug Log

## Open

### Production database initialization

- Symptom: authenticated API requests may return `Database is not ready.`
- Diagnostics: inspect `GET /api/debug/db` and deployment logs.
- Expected state: `connected=true`, `migration=true`, `error=null`.
- Relevant code: `src/server.mjs`, `src/postgres-sync.mjs`, and `src/postgres-worker.mjs`.

## Resolved

### Cloud port detection

- The server uses the platform-provided `PORT`.
- The HTTP listener binds to `0.0.0.0`.
- `/api/health` returns HTTP 200.

## Bug Template

- Date:
- Environment:
- Severity:
- Steps to reproduce:
- Expected result:
- Actual result:
- Logs:
- Owner:
- Status:
