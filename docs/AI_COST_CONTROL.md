# AI Cost Control Framework

## Goal

Module 06A Supplement 01 provides one budget, provider, logging, confirmation, and cache layer for every AI-capable module. The safe default is `mock` / `rules`; paid providers remain disabled until an Admin or Owner explicitly enables them.

## Data Model

- `ai_cost_settings`: daily, monthly, text, and image budgets plus provider and cache policy.
- `ai_cost_logs`: estimates, confirmations, executions, cache hits, blocks, and failures.
- `ai_cache_records`: expiring results keyed by module, action, entity, and input fingerprint.

Migration: `database/migrations/006_ai_cost_control.sql`. It is additive and PostgreSQL compatible.

## Default Policy

- Daily: $2
- Monthly: $50
- Text: $20
- Image: $30
- Provider: mock
- Paid provider: disabled
- Confirmation threshold: $0.01
- Cache TTL: 7 days

Paid execution requires all of the following: paid providers enabled, budget available, a configured provider key, and human confirmation. A rejected paid run is logged and safely falls back to `mock` or `rules`.

## APIs

- `GET /api/ai-cost/settings`
- `PUT /api/ai-cost/settings` — Admin / Owner only
- `POST /api/ai-cost/estimate`
- `POST /api/ai-cost/confirm`
- `GET /api/ai-cost/logs`
- `GET /api/ai-cost/dashboard`

Non-admin users can estimate costs and see their own logs. Only Admin / Owner can change budgets, enable paid providers, or approve runs at/above the configured threshold.

## Integrated Operations

- Product Intelligence: Product Info, SEO, GEO, FAQ, Buying Guide
- AI Product Content Factory: Generate Everything
- AI Image Generation: single, selected, all, and retry execution
- Opportunity Intelligence: single/batch Run AI, Product Matching, Outreach Draft generation

Mock and rules actions also create cost logs, even when actual cost is zero.

## Cache and Regeneration

Customer AI and product SEO/GEO/FAQ results use the configured TTL. Existing Outreach Drafts are updated rather than duplicated. Send `regenerate: true` to bypass cache and intentionally create a fresh result.

## Operations

System Debug Center exposes settings health, log count, remaining budget, provider mode, cache count, last blocked run, and last cost error. Production teams should review blocked runs and budget remaining before enabling any paid provider.
