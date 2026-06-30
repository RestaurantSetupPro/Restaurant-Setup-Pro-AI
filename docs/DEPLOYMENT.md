# Deployment

## Runtime

Node.js 24 Web Service, Supabase PostgreSQL, `npm install`, `npm start`, platform `PORT`, bind `0.0.0.0`.

## Migrations

Apply migrations 001, 002, 003, then `004_real_ai_image_generation.sql`. Migration 004 adds execution metadata and indexes without deleting products, drafts, tasks or historical records.

## Environment

Required existing variables remain unchanged. Optional image variables:

- `AI_IMAGE_PROVIDER=mock|openai`
- `OPENAI_API_KEY`
- `AI_IMAGE_MODEL` (default `gpt-image-1`)
- `AI_IMAGE_SIZE` (default `1024x1024`)
- `AI_IMAGE_MAX_PER_RUN` (default `3`, capped at `10`)

Without a key, an openai request falls back to mock. Never expose the key in logs, diagnostics or delivery artifacts.

## Storage Warning

`public/generated` is suitable for local acceptance only. Many cloud web-service filesystems are ephemeral. Production must mount persistent storage or replace the storage adapter with Supabase Storage/Cloudflare R2 before relying on generated images across deployments.

## Verification and Rollback

Verify `/api/health`, `/api/debug/db` version `004_real_ai_image_generation`, provider status, mock run/review/apply and tests. Application rollback may redeploy Module 05.1 while retaining additive 004 columns. Do not delete generated media history without a reviewed retention plan.
