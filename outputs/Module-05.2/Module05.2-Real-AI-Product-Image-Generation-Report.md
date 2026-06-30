# Module 05.2 — Real AI Product Image Generation Report

## 1. Completed Features

- Unified mock/OpenAI provider adapter with automatic no-key mock fallback.
- Editable product-aware prompts and negative prompts for 14 image types/scenes.
- Single, selected and capped Run All execution; default maximum three.
- Real generated-file persistence and `media_assets` output records.
- Running/generated/pending-review/approved/rejected/failed/applied lifecycle history.
- Retry, cancel, preview, approve, reject and Apply to Product controls.
- Applied output is linked as non-primary media and cannot overwrite the main image.
- Provider/task diagnostics and role-filtered UI/API behavior.

## 2. Modified Files

- Services: `src/services/ai-image-provider.mjs`, `mock-image-provider.mjs`, `openai-image-provider.mjs`, `generated-image-storage.mjs`
- Application: `src/server.mjs`, `public/app.js`, `public/styles.css`, locale files and `public/index.html`
- Database/config: `database/schema.sql`, migration 004, `.env.example`, `.gitignore`
- Tests: provider unit tests, deployment checks and full API integration regression
- Docs and delivery: Module 05.2 provider, deployment, development, roadmap, bug and architecture documents

## 3. New Database Fields

`ai_image_generation_tasks` adds `lifecycle_status`, `started_at`, `completed_at`, `error_message`, `provider_request_id`, `output_url`, `output_width`, `output_height`, `prompt_version`, `ai_confidence`, `reviewed_at`, `applied_at`, and `status_history`.

## 4. New Tables

None. Migration 004 extends the existing 05.1 task table and adds indexes only.

## 5. Impact on Module 01–05.1

No destructive impact. Products, content drafts, image tasks, released APIs and legacy status remain. `lifecycle_status` is the additive canonical bridge required to preserve existing SQLite/PostgreSQL constraints and data.

## 6. Provider Architecture

Business handlers call a common factory. Mock produces deterministic SVG previews. OpenAI calls the official image-generation endpoint when selected and keyed. Both return normalized bytes/metadata to one storage adapter. Missing keys select mock without startup failure or secret disclosure.

## 7. Test Results

- Automated: 22 passed / 0 failed / 0 skipped.
- The package `npm test` script maps to `node --test`; this acceptance runtime supplies Node without npm CLI, so the exact underlying command was executed.
- Health: HTTP 200 `{"status":"ok"}`.
- DB debug: connected/migration true, version `004_real_ai_image_generation`, error null.
- Verified fallback/config recognition, output file, batch cap, live running state, lifecycle history, failure/retry, review/apply, Sales denial, Designer success and Module 01–05.1 regression.

## 8. Known Issues

- Local `public/generated` storage is not durable on ephemeral production instances.
- Automated tests never call the paid OpenAI API; production key/account access requires a deployment smoke test.
- OpenAI adapter currently uses prompt-based generation; high-fidelity source image edit/mask support is future work.
- Execution is synchronous in the web process rather than a production queue.

## 9. Deployment Recommendations

Back up Supabase, apply migrations 001–004, deploy first with `AI_IMAGE_PROVIDER=mock`, verify diagnostics and review/Apply, then optionally enable OpenAI. Use Supabase Storage or R2 before production reliance. Never expose the API key.

## 10. Next Step

Stop development and wait for acceptance. A future approved module may add durable object storage, async workers, source-image editing, provider billing reconciliation and retries; it must preserve this review gate.
