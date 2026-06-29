# Restaurant Setup Pro AI Platform

An internal, English-language workspace for restaurant furniture export teams. The first release includes a polished application shell, secure login sessions, role-based navigation and API enforcement, representative business modules, and a foundational SQLite schema.

This is not a storefront. It intentionally has no shopping cart, online payment flow, or customer-facing accounts.

## What is included

- Responsive B2B workspace with the ten requested navigation modules
- Extensible i18n architecture with persisted English / Chinese switching across navigation, fields, roles, statuses, dates, and module interfaces
- Password hashing with `scrypt`, HTTP-only session cookies, session expiry, and audit logging
- Roles: Admin, Owner, Sales, Designer, and VA
- Server-enforced module permissions; Sales opportunity and proposal data is also scoped to the signed-in salesperson
- Dashboard, product knowledge, imports, AI image workflow, proposals, case library, CRM, sales AI, content AI, and settings screens
- SQLite schema covering users, sessions, products, documents, import jobs, AI images, proposals, cases, opportunities, content, settings, and audit logs
- Docker configuration for cloud deployment
- No third-party runtime dependencies

## Languages

The top-right language menu switches the internal workspace between English and Chinese immediately. The preference is stored in the browser. Interface strings live in `public/locales/`, with English as the fallback, so additional languages can be added without rewriting page components. Business data such as product and client names is not automatically translated. Customer-facing proposal output remains English by default.

## Run locally

Node.js 24 or newer is required.

```bash
npm start
```

Open `http://localhost:3000`.

For development with automatic restart:

```bash
npm run dev
```

## Demo accounts

All seeded accounts initially use `Welcome123!`.

| Role | Email |
| --- | --- |
| Admin | `admin@rspro.ai` |
| Owner | `owner@rspro.ai` |
| Sales | `sales@rspro.ai` |
| Designer | `designer@rspro.ai` |
| VA | `va@rspro.ai` |

Set `SEED_PASSWORD` before the database is created to use a different initial password. Remove or disable demo users before exposing a production deployment.

## Role access

| Module | Admin | Owner | Sales | Designer | VA |
| --- | :---: | :---: | :---: | :---: | :---: |
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Product Knowledge Center | ✓ | ✓ | ✓ | ✓ | ✓ |
| Product Import Center | ✓ | ✓ | — | — | ✓ |
| AI Image Center | ✓ | ✓ | ✓ | ✓ | — |
| Proposal Builder | ✓ | ✓ | ✓ | ✓ | — |
| Project Case Library | ✓ | ✓ | ✓ | ✓ | ✓ |
| Opportunity CRM | ✓ | ✓ | ✓ | — | ✓ |
| AI Sales Center | ✓ | ✓ | ✓ | — | — |
| AI Content Center | ✓ | ✓ | ✓ | ✓ | ✓ |
| Settings | ✓ | ✓ | — | — | — |

## Test

```bash
npm test
```

The integration suite verifies application availability, authentication, session access, Sales record scoping, and restricted endpoints.

## Docker deployment

```bash
docker build -t restaurant-setup-pro .
docker run --rm -p 8080:8080 \
  -e SEED_PASSWORD='replace-this-with-a-strong-password' \
  -v rspro-data:/app/data \
  restaurant-setup-pro
```

The service exposes `/api/health` for cloud health checks. Persist `/app/data` as a volume so the SQLite database survives releases. For a multi-instance production deployment, migrate the same schema to a managed PostgreSQL database and use a shared session store.

## Project structure

```text
database/schema.sql   Foundational relational data model
public/               Responsive application interface
src/server.mjs        HTTP service, authentication, RBAC, API, and database seeding
tests/                Integration coverage
Dockerfile            Cloud-ready container
```
