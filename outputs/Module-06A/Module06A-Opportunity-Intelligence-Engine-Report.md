# Module 06A — Opportunity Intelligence Engine Report

## 1. Completed features

- Added Opportunity Intelligence navigation and six workspaces: dashboard, customer import, customer list/detail, AI queue, outreach drafts, and sales handoff.
- Added manual, CSV paste, and pipe-delimited batch text import with source attribution and duplicate detection.
- Added deterministic provider-ready AI pipeline for normalization, data gaps, data quality, 100-point scoring, grade, next action, Product Intelligence matching, outreach draft, and handoff decision.
- Added editable/approvable outreach workflow with manual-send status only; no external sending integration.
- Added customer contacts, missing-data workflow, AI run snapshots, immutable activity history, sales assignment, and Accept Lead.
- Added dashboard and System Debug Center metrics.
- Added Admin/Owner, Sales, VA, and Designer access boundaries.

## 2. Modified files

- Database: `database/migrations/005_opportunity_intelligence_engine.sql`, `database/schema.sql`.
- Backend: `src/server.mjs`, `src/services/opportunity-engine.mjs`.
- Frontend: `public/app.js`, `public/styles.css`, `public/index.html`, `public/locales/en.js`, `public/locales/zh-CN.js`.
- Configuration: `.env.example`.
- Tests: `tests/integration.test.mjs`, `tests/cloud-deployment.test.mjs`.
- Documentation: `docs/OPPORTUNITY_INTELLIGENCE_ENGINE.md`, `docs/MODULES.md`, `docs/ROADMAP.md`, `docs/DEVELOPMENT.md`, `docs/BUGS.md`, `docs/README.md`.

## 3. New database tables

1. `customers`
2. `customer_contacts`
3. `customer_data_gaps`
4. `customer_ai_analysis_runs`
5. `customer_product_recommendations`
6. `customer_outreach_drafts`
7. `customer_activity_log`

Migration 005 is additive, non-destructive, indexed, and PostgreSQL compatible. The existing product tables were not rebuilt or duplicated.

## 4. Impact on Module 01–05.2

No accepted functionality was removed or rebuilt. Module 06A reads canonical products, product categories, normalized store-type knowledge, proposal readiness, and AI recommendation weight. It stores only product/category IDs and opportunity-specific rationale. Full Module 01–05.2 regression tests pass.

## 5. Opportunity Score rules

- Business Fit: 15.
- Years in Business: 15.
- Store Count: 15.
- Contactability: 20.
- Expansion / Renovation / Furniture signals: 20.
- Product Match: 10.
- Data Quality: 5.

Grades: A+ 90–100; A 75–89; B 60–74; C 40–59; D 0–39. A+/A plus at least one email, WhatsApp, website, or decision maker qualifies for Ready for Sales.

## 6. Product Matching rules

Business type selects relevant categories from Booth Seating, Dining Chair, Restaurant Table, Bar Stool, Outdoor Furniture, Counter / Service Bar, and Partition / Divider. Candidate ranking uses Product Intelligence store-type relationships, AI recommendation weight, and proposal readiness. Only IDs, match score, rationale, and sales angle are persisted in the opportunity relationship table.

## 7. Test results

- `npm test` equivalent (`node --test`): 23 passed, 0 failed, 0 skipped.
- `/api/health`: `{"status":"ok"}`.
- `/api/debug/db`: connected, migration verified as `005_opportunity_intelligence_engine`, no error.
- Manual, CSV, and batch text import: passed.
- Cleaning, scoring, gaps, product matching, outreach generation, queue, handoff, Sales acceptance, VA restrictions, Designer denial, draft edit/approve/manual-send, and activity history: passed.
- Browser acceptance: dashboard, import, list, detail, Run AI, recommendations, gaps, outreach, activity history, and Debug Center rendered correctly; no browser console errors.

## 8. Known issues

- CSV v1 does not parse quoted commas.
- Batch import is limited to 500 rows per request.
- Rules v1 does not perform external enrichment or LLM calls.
- No automated sending is implemented.
- Local SQLite is supported for development; production generated enrichment integrations still need compliance/rate-limit controls.

## 9. Deployment recommendation

Deploy after applying migration `005_opportunity_intelligence_engine.sql` with `RUN_MIGRATIONS=true`. `OPPORTUNITY_AI_PROVIDER=rules` is optional and safe as the default. Back up Supabase before migration, confirm seven new tables, then verify `/api/health`, `/api/debug/db`, `/api/opportunity/dashboard`, customer import, Run AI, and sales handoff. Existing secrets require no change.

## 10. Next-step recommendation

After product acceptance, add isolated enrichment/provider adapters for Google Maps, Apollo, Hunter, LinkedIn, OpenAI, Gemini, Claude, or Qwen. Every adapter should preserve source URL, confidence, consent/compliance checks, rate limits, human review, and the Product Intelligence single-source-of-truth rule. Automated outreach sending should remain a separately approved module.
