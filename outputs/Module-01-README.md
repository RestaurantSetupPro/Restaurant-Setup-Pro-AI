# Restaurant Setup Pro AI Platform — Module 01

Module 01 is the foundational release of an internal restaurant furniture export workspace. It provides authentication, role-based access, navigation, representative module pages, a relational data model, and a deployable Node.js service.

It is not an e-commerce storefront. Shopping cart, payment, and customer-facing account features are intentionally excluded.

## Requirements

- Node.js 24 or newer
- No third-party runtime dependencies

## Start locally

```bash
npm start
```

Open `http://localhost:3000`.

Development mode:

```bash
npm run dev
```

Custom port in PowerShell:

```powershell
$env:PORT = "4173"
npm start
```

## Demo accounts

| Role | Email |
| --- | --- |
| Admin | `admin@rspro.ai` |
| Owner | `owner@rspro.ai` |
| Sales | `sales@rspro.ai` |
| Designer | `designer@rspro.ai` |
| VA | `va@rspro.ai` |

Initial password for all seeded accounts: `Welcome123!`

Set `SEED_PASSWORD` before the database is created to provide another initial password. Disable or replace demo accounts before production use.

## Commands

```bash
npm start      # Start the production-style server
npm run dev    # Start with automatic restart
npm test       # Run automated tests
```

## Environment variables

```text
PORT=3000
HOST=0.0.0.0
DATABASE_PATH=./data/restaurant-setup-pro.db
SESSION_HOURS=12
SEED_PASSWORD=replace-with-a-strong-password
```

## Docker

```bash
docker build -t restaurant-setup-pro .
docker run --rm -p 8080:8080 \
  -e SEED_PASSWORD='replace-with-a-strong-password' \
  -v rspro-data:/app/data \
  restaurant-setup-pro
```

Health check: `GET /api/health`

Persist `/app/data` so the SQLite database survives container replacement. For multi-instance production deployment, migrate the schema to managed PostgreSQL and use a shared session store.

## Main folders

```text
database/schema.sql   Database model
public/               Browser interface and assets
src/server.mjs        Authentication, RBAC, APIs, and static hosting
tests/                Automated integration and locale tests
Dockerfile            Container deployment definition
```

## Module 01 status

Completed: authenticated application shell, RBAC, all requested navigation entries, foundational pages, database schema, seeded demo data, Docker configuration, and automated access tests.

Pending: production CRUD workflows, uploads/import parsing, AI provider connections, full proposal/PDF generation, email integrations, managed cloud infrastructure, and production security hardening.

