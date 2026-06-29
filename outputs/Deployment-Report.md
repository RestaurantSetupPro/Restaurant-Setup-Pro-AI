# Restaurant Setup Pro AI Platform — Cloud Deployment Acceptance Report

Date: **June 29, 2026**

Scope: **Accepted Modules 01–04**

Deployment: **GitHub + Supabase PostgreSQL + Render**

Module 05: **Not started**

## 1. Deployment Report

Cloud deployment has been reported as completed. The repository contains the PostgreSQL migration, Supabase-compatible runtime, Render Blueprint, environment template, database-backed health endpoint, rollback instructions, and automated acceptance tests.

Local verification completed on June 29, 2026. Production verification could not be independently completed because the Render production URL is not recorded in the workspace and outbound browser access to the private deployment was unavailable.

## 2. Render Production URL

**Not recorded in the repository or deployment artifacts.**

The configured Render service name is `restaurant-setup-pro-ai`. The exact production URL must be copied from the Render service dashboard before formal acceptance; no URL has been inferred or guessed.

## 3. GitHub Repository URL

<https://github.com/RestaurantSetupPro/Restaurant-Setup-Pro-AI>

Repository visibility: **Private**

Deployment commit message: `feat: Version 0.4 Initial Cloud Deployment`

## 4. Supabase Migration Summary

Migration file: `database/migrations/001_initial_schema.sql`

- Migration version: `001_initial_schema`
- PostgreSQL tables: 27, including the migration ledger
- Includes Module 01–04 users, sessions, product, configuration, tags, media, knowledge, relationship, case, keyword, and audit structures
- Adds foreign keys, checks, lookup indexes, and case-insensitive uniqueness indexes
- Uses `CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and `ON CONFLICT DO NOTHING`
- Contains no `DROP` or `TRUNCATE` operations
- Existing rows are not replaced

Remote Supabase execution status: **Reported complete; not independently verified because no production connection was supplied to this acceptance environment.**

## 5. Environment Variables Checklist

Only variable names are listed:

- [ ] `NODE_ENV`
- [ ] `HOST`
- [ ] `PORT`
- [ ] `DATABASE_URL`
- [ ] `DATABASE_SSL`
- [ ] `DATABASE_POOL_SIZE`
- [ ] `RUN_MIGRATIONS`
- [ ] `SESSION_HOURS`
- [ ] `SEED_PASSWORD`

`DATABASE_PATH` is only required for local SQLite fallback and is not required for the Render/Supabase production path.

## 6. Health Check Result

Endpoint: `GET /api/health`

Expected response: `{"status":"ok"}`

- Automated route test: **Passed**
- Database connectivity is checked before the response is returned
- Render health-check path: **Configured**
- Live production result: **Pending exact Render Production URL**

## 7. Login Test Result

- Admin authentication: **Passed**
- Session creation: **Passed**
- Admin full-access authorization: **Passed**
- Sales restricted access: **Passed**
- Designer restricted access: **Passed**
- Live production login: **Pending exact Render Production URL and authorized acceptance credentials**

No password or session token is included in this report.

## 8. Module 01–04 Core Function Test Result

Result: **Passed locally**

- Application shell and bilingual resources
- Authentication, sessions, and role restrictions
- Foundation data and system configuration
- Product create/edit and unique automatic/manual SKU validation
- Categorized multi-tag binding, search, and filtering
- Media and AI production-use warning
- Product Knowledge Engine relationships and normalized knowledge data
- Knowledge Score and combined product search filters
- Prompt administration and read-only role behavior

Production smoke testing remains pending the exact Render URL.

## 9. npm test Result

Package test script: `node --test`

- Tests: **17**
- Passed: **17**
- Failed: **0**
- Skipped: **0**
- Result: **Passed**

The acceptance workstation did not expose an `npm` executable, so `npm test` itself could not launch there. Its exact configured test target, `node --test`, was executed successfully. Render build/start configuration still uses `npm install` and `npm start`.

## 10. Known Issues

- Exact Render Production URL is absent from the repository and cannot yet be listed or live-tested.
- Live Supabase migration status was not independently queried from this environment.
- Production login was not performed because the production URL and acceptance credentials were unavailable.
- The current synchronous PostgreSQL worker bridge should be replaced with fully asynchronous database access before high-concurrency scaling.
- Standard `.git` metadata was protected in the original workspace; the deployment commit was created with isolated local Git metadata.
- No Module 05 work was performed.

## 11. Rollback Steps

### Application

1. Open the Render service deployment history.
2. Select the last accepted Module 01–04 deployment.
3. Roll back or redeploy that commit.
4. Keep the existing production environment variables unchanged.
5. Confirm `GET /api/health` returns `{"status":"ok"}`.
6. Repeat admin login and core product smoke tests.

### Database

1. Take a Supabase backup before any future migration.
2. Leave Migration 001 additive tables and columns in place during an application rollback.
3. Restore the pre-migration backup only if data integrity is affected.
4. Do not manually drop production tables without an approved recovery plan.

## Acceptance Status

**Conditionally ready for product-manager acceptance.** Local tests and deployment artifacts pass. Final production acceptance requires the exact Render URL, a successful live `/api/health` response, and an authorized production login smoke test.
