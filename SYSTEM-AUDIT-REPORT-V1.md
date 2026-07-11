# Restaurant Setup Pro AI Platform — System Audit v1.0

Audit date: 2026-07-08  
Scope: Current repository after Issue018 completion  
Audit rule: No system redesign. No code changes. Only repository analysis and report generation.

---

## 1. Git Status

| Item | Result |
| --- | --- |
| Current branch | `main` |
| Latest commit | `2d3eaade19d534fdee6b40f698580064647857b0` |
| Latest commit short hash | `2d3eaad` |
| Latest commit message | `Complete Issue017-B Excel Parser Fix and Issue018 Product Library Integration` |
| Remote | `origin https://github.com/RestaurantSetupPro/Restaurant-Setup-Pro-AI.git` |
| Remote synchronization | `main...origin/main`; no ahead/behind marker at audit start |
| Working tree at audit start | Clean |
| Working tree after audit | Only this audit report is newly generated |

Note: `npm test` was run during this audit. It passed. Temporary runtime import cache files were restored so the repository stayed clean before this report file was generated.

---

## 2. Module Inventory

| Module | Status | Main Files | Completed Functions | Missing / Future Functions | Test Status |
| --- | --- | --- | --- | --- | --- |
| Module 01 — Foundation / App Shell | Completed | `src/server.mjs`, `public/index.html`, `public/app.js`, `database/migrations/001_initial_schema.sql` | Login, sessions, roles, dashboard shell, core tables, seed data, health/debug endpoints | Production-grade user administration and audit UI can be expanded | Covered by integration and cloud tests |
| Module 02 — Core Foundation Data | Completed | `src/server.mjs`, `public/app.js`, `database/schema.sql` | System configs, tags, media, prompts, master data seed | More granular permission matrix and admin UX | Covered |
| Module 03 — Product SKU + Tags | Completed | `src/server.mjs`, `public/app.js`, `outputs/Module-03/*` | SKU rules, unique SKU validation, product tags, search/filter basics | Larger-scale indexing/search engine not yet present | Covered |
| Module 04 — Product Knowledge Engine V2 | Completed | `database/migrations/001_initial_schema.sql`, `src/server.mjs`, `public/app.js` | Product knowledge relationships, suitable store types/styles/features, related products/cases, Knowledge Score, Knowledge Dashboard | Public website/API consumption layer not built | Covered |
| Module 05 — Product Intelligence Upgrade | Completed | `database/migrations/002_product_intelligence.sql`, `docs/PRODUCT_INTELLIGENCE_MODULE.md` | AI/SEO/GEO fields, readiness score, product image types, AI content rule generation, filters | Real LLM text provider not connected; website publishing not built | Covered |
| Module 05.1 — AI Product Content Factory | Completed | `database/migrations/003_ai_product_content_factory.sql`, `docs/AI_PRODUCT_CONTENT_FACTORY.md` | Generate Everything workflow, draft review, image generation task creation, Apply to Product | Real text/image generation providers mostly future; human review remains required | Covered |
| Module 05.2 — Real AI Product Image Generation | Implemented / acceptance-ready | `database/migrations/004_real_ai_image_generation.sql`, `src/services/ai-image-provider.mjs`, `src/services/mock-image-provider.mjs`, `src/services/openai-image-provider.mjs`, `src/services/generated-image-storage.mjs` | Mock/OpenAI provider adapter, image task lifecycle, run/retry/cancel/approve/reject/apply, provider debug | Production object storage not connected; OpenAI image key optional; batch generation is controlled | Covered |
| Module 06A — Opportunity Intelligence Engine | Completed | `database/migrations/005_opportunity_intelligence_engine.sql`, `src/services/opportunity-engine.mjs`, `docs/OPPORTUNITY_INTELLIGENCE_ENGINE.md` | Customers, contacts, gaps, AI scoring, product matching, outreach drafts, opportunity queue, sales handoff | No external Google Maps/Apollo/LinkedIn/email integration; no automatic sending | Covered |
| Module 06A Supplement 01 — AI Cost Control | Completed | `database/migrations/006_ai_cost_control.sql`, `src/services/ai-cost-control.mjs`, `docs/AI_COST_CONTROL.md` | Budgets, settings, logs, cache, provider gating, cost dashboard | Fine-grained cost attribution can be expanded as real providers grow | Covered |
| Module 07 Part 1 — Sales Intelligence Workflow | Completed | `database/migrations/007_sales_intelligence_part1.sql`, `src/services/sales-intelligence.mjs`, `public/app.js`, `docs/SALES_INTELLIGENCE_PART1.md` | New Inquiry, AI analysis, product recommendation, sales workspace, customer creation during inquiry | External message sending and live CRM integrations not built | Covered |
| Module 07 Part 2 — Quote Builder & PI Builder | Completed | `database/migrations/008_quote_pi_builder.sql`, `database/migrations/009_custom_quote_items.sql`, `database/migrations/010_global_pi_template.sql`, `database/migrations/011_professional_pi_optimization.sql`, `docs/QUOTE_PI_BUILDER.md` | Quote Builder, custom quote items, version history, PI preview, PDF/Excel export, WhatsApp/email copy text, Convert to Order, professional PI polishing | Live email/WhatsApp sending, freight API, payment/order execution are future | Covered |
| Module 08A — Product Foundation / PIM Foundation | Completed | `database/migrations/012_product_foundation.sql`, `013_product_master_data.sql`, `014_pim_foundation_upgrade.sql`, `docs/PRODUCT_FOUNDATION_MODULE.md` | Product Library UI, categories, attributes, variants, images/documents, related products, FBT, supplier fields, protected snapshots | Deeper bulk edit and advanced PIM workflows can be added later | Covered |
| Module 08B Part 1 — Excel Smart Import + Draft Review | Completed | `database/migrations/015_ai_product_import.sql`, `src/services/smart-product-import.mjs`, `docs/AI_PRODUCT_IMPORT.md` | XLSX/XLS/CSV parse, bilingual/multi-row headers, merged cells, embedded images, product/variant grouping, draft review, approve to Product Library | PDF/Word catalog import, website scraping, supplier order workflow not built | Covered |
| Module 08C — Product Library Business Readiness | Completed | `database/migrations/016_product_library_business_readiness.sql`, `src/server.mjs`, `outputs/Module-08C/*` | Sensitive supplier data redaction, import source traceability, clear demo data, import statistics, error report, duplicate detection, status workflow | More advanced duplicate resolution UI and audit exports can be improved | Covered |
| Module 08D — Product Price Engine | Completed | `database/migrations/017_product_price_engine.sql`, `docs/PRODUCT_PRICE_ENGINE.md` | Price rules, supplier cost conversion, reference price calculation, manual override, quote cost snapshots, protected cost data | Customer-specific price lists, contract pricing, freight landed-cost pricing not built | Covered |
| Issue010–018 Alpha Fixes | Completed through Issue018 | `src/server.mjs`, `src/services/smart-product-import.mjs`, `public/app.js`, `tests/*`, `outputs/Module-08D/*` | Clear demo data, supplier XLSX parser hardening, DUBA grouping, PI structure, Issue018 Product Library integration | Future supplier spreadsheet edge cases will need continuous sample coverage | Covered |

---

## 3. Current Architecture Map

### Frontend

Primary frontend is a single browser application:

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/i18n.js`
- `public/locales/en.js`
- `public/locales/zh-CN.js`

Main page/routes found in the current navigation:

- Sales workspace:
  - New Inquiry
  - Customers
  - Quotes
  - Orders
  - Tasks
- Product Library:
  - Products
  - Categories
  - Tags
  - Attributes
  - Variants
- Product Intelligence:
  - Dashboard
  - Knowledge Dashboard
  - Product detail tabs
  - AI Content Factory
  - AI Image Generation Tasks
- Opportunity Intelligence:
  - Opportunity Dashboard / customer intelligence workspace
  - Import Customers
  - Customer List / Detail
  - Opportunity Queue
  - Outreach Drafts
  - Sales Handoff
- Import Center:
  - Upload / settings
  - Smart Analysis Result
  - Draft Review
  - Import Result
  - Price Rules / recalculation tools
- System:
  - Core Foundation
  - System Debug Center
  - Settings

Frontend component pattern:

- No separate frontend framework is used.
- Components are mostly JavaScript render functions in `public/app.js`.
- UI state is kept in a shared `state` object.
- API calls are made through local helper functions.

### Backend

Primary backend:

- `src/server.mjs`

Backend architecture is currently monolithic but modularized by helper functions and service imports.

Service files:

- `src/services/smart-product-import.mjs`
- `src/services/sales-intelligence.mjs`
- `src/services/opportunity-engine.mjs`
- `src/services/ai-cost-control.mjs`
- `src/services/ai-image-provider.mjs`
- `src/services/mock-image-provider.mjs`
- `src/services/openai-image-provider.mjs`
- `src/services/generated-image-storage.mjs`
- `src/postgres-worker.mjs`
- `src/postgres-sync.mjs`

Major API groups:

- Auth / health / debug:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/health`
  - `GET /api/ready`
  - `GET /api/debug/db`
  - `GET /api/debug/system`
- Product and Product Library:
  - `GET /api/products`
  - `POST /api/products`
  - `GET /api/products/:id`
  - `PUT /api/products/:id`
  - `DELETE /api/products/:id`
  - `GET/POST/PUT/DELETE /api/product-categories`
  - `GET/POST/PUT/DELETE /api/product-tags`
  - `GET/POST/PUT/DELETE /api/product-attributes`
  - `POST/PUT/DELETE /api/products/:id/variants`
  - `PUT /api/products/:id/foundation`
- Knowledge / Product Intelligence:
  - `GET /api/knowledge/dashboard`
  - `GET /api/products/search`
  - `PUT /api/products/:id/knowledge`
  - `POST /api/products/:id/generate`
  - `POST /api/products/:id/ai-content/generate`
  - AI draft review/apply APIs under `/api/products/:id/ai-content`
- AI image generation:
  - `GET /api/system/ai-image-provider/status`
  - image task APIs under `/api/products/:id/image-generation-tasks`
- Opportunity Intelligence:
  - `GET/POST/PUT /api/customers`
  - `POST /api/customers/import`
  - `POST /api/customers/:id/run-ai`
  - `POST /api/customers/run-ai-selected`
  - contacts, gaps, drafts, opportunity queue and sales handoff APIs
- Sales Intelligence:
  - `GET /api/sales-workspace`
  - `POST /api/sales-inquiries`
  - `POST /api/sales-inquiries/:id/analyze`
  - `PUT /api/sales-inquiries/:id/products`
  - `POST /api/sales-inquiries/:id/quote`
  - `POST /api/sales-inquiries/:id/convert-order`
  - quote detail/export/message/version/item APIs under `/api/sales-quotes`
- Product import / supplier Excel:
  - `GET /api/imports`
  - `POST /api/imports/analyze`
  - `PUT /api/imports/drafts/:id`
  - `POST /api/imports/drafts/:id/approve`
  - `POST /api/imports/drafts/:id/reject`
  - `POST /api/imports/approve-selected`
  - `POST /api/imports/merge`
  - `POST /api/imports/drafts/:id/split`
  - `GET /api/imports/:batchId/errors.xlsx`
- Pricing:
  - price rules APIs
  - `GET /api/pricing/recalculate/preview`
  - `POST /api/pricing/recalculate/apply`
- AI cost control:
  - `GET /api/ai-cost/settings`
  - `PUT /api/ai-cost/settings`
  - `POST /api/ai-cost/estimate`
  - `POST /api/ai-cost/confirm`
  - `GET /api/ai-cost/logs`
  - `GET /api/ai-cost/dashboard`

### Database

Migration chain:

- `001_initial_schema.sql`
- `002_product_intelligence.sql`
- `003_ai_product_content_factory.sql`
- `004_real_ai_image_generation.sql`
- `005_opportunity_intelligence_engine.sql`
- `006_ai_cost_control.sql`
- `007_sales_intelligence_part1.sql`
- `008_quote_pi_builder.sql`
- `009_custom_quote_items.sql`
- `010_global_pi_template.sql`
- `011_professional_pi_optimization.sql`
- `012_product_foundation.sql`
- `013_product_master_data.sql`
- `014_pim_foundation_upgrade.sql`
- `015_ai_product_import.sql`
- `016_product_library_business_readiness.sql`
- `017_product_price_engine.sql`

Current schema is additive and PostgreSQL-compatible in migrations, with local SQLite compatibility helpers in `src/server.mjs`.

### AI Capabilities

Existing AI/rules capabilities:

- Product AI content simulation:
  - SEO
  - GEO
  - FAQ
  - Buying Guide
  - Sales talking points
  - Proposal notes
- AI Product Content Factory:
  - Generate Everything
  - Draft review and Apply to Product
- AI image generation:
  - Provider adapter architecture
  - Mock provider default
  - OpenAI provider detection/config support
  - Run/retry/review/apply image task lifecycle
- Opportunity AI:
  - Rules-based customer cleaning, scoring, gap detection, product matching, outreach drafting
- Sales AI:
  - Inquiry analysis
  - Product recommendations
  - Quantity/freight extraction
  - Quote generation assistance
- AI Cost Control:
  - Budget settings
  - logs
  - cache
  - provider gating
  - paid provider guardrails

Current AI limitation:

- Most text intelligence is rules/mock-generated.
- Real LLM text provider integration is not yet implemented.
- Real image provider is architected, but production usage depends on API key and storage decisions.

---

## 4. Functional Capability Audit

### A. Product System

| Area | Current Capability | Audit Result |
| --- | --- | --- |
| Product Library | Products CRUD, product detail, status, visibility, reference price, images | Strong foundation complete |
| Categories | CRUD and active/sort support | Complete |
| Attributes | Attribute definitions, category links, options, values, variant-level values | Complete foundation |
| Variants | Create/edit/delete, SKU, dimensions, prices, supplier fields, logistics fields | Complete foundation |
| Supplier Import | Excel/CSV Smart Import, Draft Review, approval into Product Library | Complete v1 |
| XLSX parsing | Merged cells, embedded images, bilingual/multi-row headers, grouping, raw debug | Recently hardened; passes tests |
| Image extraction | Extracted XLSX images saved to `/public/imports` and linked as Product main image on approval | Works; storage strategy is a risk |
| Source traceability | Source supplier/file/sheet/row/batch/imported by | Implemented |
| Product protection | Sales/VA supplier cost redaction server-side | Implemented |

Gaps:

- Product import image mapping is good enough for supplier spreadsheets but not a full visual matching system.
- No PDF/Word catalog import.
- No website scraping/import.
- No production object storage; local/public file storage is used.
- No advanced bulk edit UI for large catalogs.

### B. Pricing System

| Area | Current Capability | Audit Result |
| --- | --- | --- |
| Supplier cost | Product and variant supplier cost fields | Implemented and protected |
| Price rules | Supplier/category/currency rules, multiplier, fixed addon, rounding | Implemented |
| Margin/reference calculation | Converted cost and reference price calculation | Implemented |
| Manual override | Variant reference price manual override | Implemented |
| Quote snapshot | Quote items store reference price and protected cost snapshot | Implemented |
| Customer pricing | Quote unit price editable by sales | Implemented |

Gaps:

- No customer-specific price lists.
- No volume discount rules.
- No landed-cost / freight / tariff pricing engine.
- No approval workflow for price overrides beyond Owner access.

### C. Sales System

| Area | Current Capability | Audit Result |
| --- | --- | --- |
| Customer management | Customers, contacts, gaps, activities | Implemented |
| Leads/opportunities | Opportunity scoring, grades, queue, handoff | Implemented |
| New Inquiry | Create new customer inline, analyze inquiry | Implemented |
| Product recommendation | Rules-based recommendation from product library | Implemented |
| Quotes | Quote Builder with library/custom items, versions, live totals | Implemented |
| PI | Professional PI preview, PDF/Excel export, WhatsApp/email message copy | Implemented |
| Orders | Convert quote/inquiry to order with snapshots | Basic implemented |

Gaps:

- No automatic WhatsApp/email sending.
- No CRM pipeline depth beyond current lead/opportunity workflow.
- No payment collection/tracking.
- No supplier PO / purchase order workflow.
- No delivery/installation/after-sales system.

### D. AI System

| Area | Current Capability | Audit Result |
| --- | --- | --- |
| AI recommendation | Product recommendations for products/customers/inquiries | Rules-based complete |
| AI Agent foundation | Docs include AI agent spec and execution contract | Foundation documented |
| Knowledge base | Product Knowledge Center, Product Intelligence fields, searchable metadata | Strong product-side foundation |
| Cost governance | AI Cost Control Framework across modules | Implemented |
| Provider architecture | Image provider adapter supports mock/OpenAI | Implemented for image tasks |

Gaps:

- No production text LLM adapter for OpenAI/Gemini/Claude/Qwen.
- No vector database / semantic search index.
- No autonomous agent execution engine connected to business workflows.
- No retrieval pipeline for website/CRM/proposal from a unified API yet.

### E. Operation System

| Area | Current Capability | Audit Result |
| --- | --- | --- |
| Orders | Basic order records from quote conversion | Basic |
| Supplier workflow | Supplier/import data exists, but no purchasing workflow | Missing |
| Delivery | Shipping fields in quote/PI only | Missing operational module |
| After-sales | Not present | Missing |
| Warehouse | Not present | Missing |
| Supplier orders | Not present | Missing |

---

## 5. Database Audit

### Migration Status

Migration chain is present from `001_initial_schema` through `017_product_price_engine`. Runtime health tests verify latest migration version as `017_product_price_engine`.

### Existing Tables and Purpose

| Table Group | Tables | Purpose |
| --- | --- | --- |
| System/Auth | `users`, `sessions`, `organization_settings`, `system_configs`, `audit_log` | Login, roles, settings, config, event audit |
| Product Core | `product_categories`, `products`, `product_documents`, `product_tag_links`, `system_tags`, `media_assets`, `product_media_links` | Product catalog, categories, tags, documents, media |
| Product Knowledge | `product_knowledge_terms`, `product_knowledge_links`, `product_relationships`, `product_case_links`, `product_related_category_links`, `product_keywords`, `project_cases` | Product knowledge graph, cases, related products/categories, keywords |
| Product Intelligence | Product intelligence columns on `products`, `ai_product_content_drafts`, `ai_image_generation_tasks` | AI-ready fields, content drafts, image tasks |
| Product Foundation / PIM | `product_variants`, `product_attribute_definitions`, `product_attribute_values`, `product_attribute_category_links`, `product_attribute_options`, `product_foundation_relationships` | Variants, attributes, configurable PIM structure, related/FBT |
| Product Import | `product_import_batches`, `product_import_drafts`, `product_import_assets`, `product_import_errors`, `import_jobs` | Supplier spreadsheet import, draft review, source traceability, error reports |
| Pricing | `product_price_rules` plus pricing columns on `product_variants` and `sales_quote_items` | Reference price calculation and quote snapshots |
| Opportunity | `customers`, `customer_contacts`, `customer_data_gaps`, `customer_ai_analysis_runs`, `customer_product_recommendations`, `customer_outreach_drafts`, `customer_activity_log`, legacy `opportunities`, `opportunity_activities` | Opportunity intelligence, lead scoring, outreach drafts, activity |
| Sales | `sales_inquiries`, `sales_inquiry_analyses`, `sales_inquiry_products`, `sales_quotes`, `sales_quote_items`, `sales_quote_versions`, `sales_quote_custom_items`, `sales_orders`, `sales_order_items`, `sales_order_custom_items`, `sales_tasks`, `customer_sales_timeline` | Sales workflow, quotes, PI, order conversion, tasks |
| AI Cost | `ai_cost_settings`, `ai_cost_logs`, `ai_cache_records` | AI budgets, logging, confirmation, cache |
| PI/Finance | `organization_bank_accounts` | Bank account selection for PI |
| Legacy/Content | `ai_images`, `proposals`, `proposal_items`, `content_assets` | Earlier proposal/content/image placeholders |

### Database Risks

- Current backend supports local SQLite and PostgreSQL-style migrations. This is useful, but dual behavior increases test responsibility.
- `src/server.mjs` contains many SQLite compatibility `ensure*` functions in addition to migrations; this can create divergence if not controlled.
- Product media currently uses local/public paths for generated/imported assets. Production should move to Supabase Storage or Cloudflare R2.
- Some legacy tables remain (`proposals`, `ai_images`, `opportunities`) and may need cleanup or formal ownership before SaaS architecture.

---

## 6. Test Audit

Command run:

```bash
npm.cmd test
```

Result:

- Total tests: 39
- Passed: 39
- Failed: 0
- Cancelled: 0
- Skipped: 0
- Duration: about 9.6 seconds

### Test Files

| Test File | Coverage |
| --- | --- |
| `tests/integration.test.mjs` | End-to-end core app, auth, product, intelligence, opportunity, sales, quote/PI, imports, pricing |
| `tests/smart-product-import.test.mjs` | XLSX parser, merged cells, multi-row headers, embedded images, grouping, debug output, unreadable file errors |
| `tests/cloud-deployment.test.mjs` | Deployment files, env safety, health payload |
| `tests/i18n.test.mjs` | English/Chinese key coverage and language switcher |
| `tests/ai-image-provider.test.mjs` | Mock/OpenAI image provider configuration |

### Missing / Weak Coverage

- Browser visual regression is not automated.
- PDF/Excel export layout is tested indirectly; no pixel/PDF structural regression suite.
- Real external providers are not tested with live keys.
- No load/performance tests for large catalogs or large supplier files.
- No security penetration tests for role redaction beyond selected API assertions.
- No database migration test against a real Supabase/PostgreSQL instance in this local test run.

---

## 7. Completed Modules

Completed and reusable foundations:

1. Core app shell, auth, roles, dashboard.
2. Product Library base and Product Intelligence Center.
3. Product Knowledge graph and readiness scoring.
4. AI Product Content Factory and AI Image task lifecycle.
5. AI Cost Control Framework.
6. Opportunity Intelligence Engine.
7. Sales Intelligence workflow.
8. Quote Builder and professional PI output.
9. Product Foundation / PIM.
10. Excel Smart Import with Product Library approval.
11. Product Library Business Readiness.
12. Product Price Engine.
13. Issue018 real supplier Excel import to Product Library.

---

## 8. Partially Completed Modules

| Area | Current State | What Makes It Partial |
| --- | --- | --- |
| AI Provider Layer | Image adapter exists; mock/OpenAI supported | Text LLM providers not connected |
| Proposal System | Legacy `proposals` tables and product proposal-ready fields exist | Full AI Proposal Generator not implemented |
| CRM | Opportunity Intelligence exists | Full CRM pipeline, campaigns, communication sync missing |
| Orders | Convert quote to order works | Supplier PO, production tracking, delivery, after-sales missing |
| Import Center | Excel/CSV import works | PDF catalog, Word import, website import missing |
| Media Storage | Local/public generated/imported assets work | Production storage/CDN not finalized |
| SaaS Readiness | Good single-tenant internal foundation | Multi-tenant accounts, billing, tenant isolation not implemented |

---

## 9. Missing Modules

Business roadmap modules not yet implemented:

1. Supplier Orders / Purchase Orders.
2. Supplier management and supplier portal.
3. Warehouse / inventory.
4. Delivery / logistics tracking.
5. After-sales / warranty / service tickets.
6. Full AI Proposal Generator.
7. Website publishing / public product pages.
8. Real text LLM provider adapter and prompt execution layer.
9. Semantic search / vector knowledge retrieval.
10. Customer communication integrations:
    - WhatsApp
    - Email provider
    - LinkedIn/Facebook
11. External lead enrichment:
    - Google Maps
    - Apollo
    - Hunter
    - LinkedIn
12. SaaS architecture:
    - Tenant model
    - Billing
    - Tenant-level permissions
    - Tenant data isolation
    - Admin console

---

## 10. Technical Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| Monolithic backend file | High | `src/server.mjs` contains routing, database, business logic, exports, permissions, and debug logic. It is productive now but will become harder to maintain for SaaS. |
| Monolithic frontend file | High | `public/app.js` contains most UI rendering and workflow logic. Future modules may become harder to test visually. |
| Local/public asset storage | High | Imported/generated images are stored in public paths. Production should use Supabase Storage or Cloudflare R2 with durable URLs and retention rules. |
| Dual SQLite/PostgreSQL compatibility | Medium | Helpful for local development, but migration/runtime compatibility needs continuous testing against real PostgreSQL. |
| Runtime schema ensure functions | Medium | `ensure*` functions can drift from formal migrations. Migration should remain the source of truth. |
| AI currently mostly rules/mock | Medium | Good cost-safe foundation, but business value of AI Sales OS V5.3 Lite will require real LLM provider integration. |
| Large supplier import performance | Medium | XLSX parser now handles real DUBA file, but very large catalogs need performance/load testing. |
| Role naming mismatch | Medium | Code uses `Admin`, `Owner`, `Sales`, `VA`, and business-facing `Sales Admin` via email mapping. Future role model should be normalized. |
| Legacy tables and placeholders | Low/Medium | `proposals`, `ai_images`, legacy opportunities/content tables need ownership before future architecture. |
| Export quality regression | Medium | PDF/Excel/PI layout is business-critical but lacks automated visual regression. |

---

## 11. Reuse Potential for AI Sales OS V5.3 Lite

Strongly reusable:

- Product Intelligence Center as product knowledge source of truth.
- Product Library PIM schema.
- Variant and attribute system.
- Supplier Excel import engine.
- Price rule/reference pricing engine.
- Quote/PI builder and order snapshot logic.
- Opportunity scoring and product matching framework.
- AI Cost Control framework.
- Debug Center pattern.

Needs upgrade before AI Sales OS:

- Split backend modules from `src/server.mjs`.
- Split frontend routes/components from `public/app.js`.
- Add real LLM provider adapter for text workflows.
- Add semantic product/customer retrieval.
- Add durable object storage.
- Add background jobs for long-running AI/import/export tasks.
- Add more formal permission/role model.

---

## 12. Recommended Development Order

Recommended order from current foundation toward AI Sales OS V5.3 Lite:

1. Stabilization Sprint
   - Preserve current working behavior.
   - Add visual acceptance checks for Product Import, Product Library, Quote Builder, PI export.
   - Move runtime import/generated assets out of tracked/public source folders.

2. Module09 — Supplier Order / Purchase Workflow
   - Convert approved Orders into Supplier Purchase Orders.
   - Supplier cost snapshots.
   - Production status.
   - Supplier communication notes.

3. Storage Upgrade
   - Supabase Storage or Cloudflare R2.
   - Product/import/generated media migration plan.
   - Signed/admin URLs for sensitive supplier images if needed.

4. AI Provider Upgrade
   - Text LLM provider adapter.
   - Prompt execution logs.
   - Cost Control integration mandatory.
   - Human review remains required.

5. AI Proposal Generator
   - Reuse Product Intelligence Center, Quote Builder, customer/opportunity data.
   - Generate proposal drafts only.
   - Do not duplicate product data.

6. CRM / Communication Integrations
   - Email draft/send integration.
   - WhatsApp manual/send integration.
   - Outreach audit log.

7. Operations Layer
   - Delivery tracking.
   - Installation/after-sales tasks.
   - Warranty/support.

8. SaaS Architecture Preparation
   - Tenant schema.
   - tenant_id migration strategy.
   - Role/permission normalization.
   - Billing plan and feature flags.
   - Background workers and queue design.

---

## 13. Final Audit Conclusion

Restaurant Setup Pro is no longer just a prototype. It has a working internal business platform foundation with:

- Product Intelligence
- Product Library / PIM
- Supplier Excel import
- Price engine
- Sales inquiry → recommendation → quote → PI → order workflow
- Opportunity intelligence
- AI cost governance
- Debug and deployment foundations

The best reuse path is to treat the Product Intelligence Center and Quote/PI system as the stable core, then build AI Sales OS V5.3 Lite around them rather than replacing them.

The main engineering concern is not missing features inside the current scope; it is architectural scale. Before Future SaaS Architecture, the system should be modularized, storage should move out of local/public folders, and real AI provider execution should be introduced behind the existing Cost Control and human review framework.

