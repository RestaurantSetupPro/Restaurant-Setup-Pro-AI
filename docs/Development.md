# Development

## Prerequisites

- Node.js 24 or newer
- npm

## Start

```bash
npm install
npm start
```

Local SQLite is used when `DATABASE_URL` is absent. PostgreSQL is used when `DATABASE_URL` is configured.

## Test

```bash
npm test
```

## Important Paths

- `src/server.mjs`: HTTP server and application API
- `src/postgres-sync.mjs`: synchronous PostgreSQL bridge
- `src/postgres-worker.mjs`: PostgreSQL worker
- `public/`: browser application
- `database/`: schemas and migrations
- `tests/`: automated tests
- `outputs/`: module delivery artifacts

## Change Rules

Preserve accepted Module 01–04 behavior, avoid unrelated changes, run tests before committing, and never commit local databases or secret environment files.
