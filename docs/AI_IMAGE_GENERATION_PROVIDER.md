# AI Image Generation Provider

## Adapter Architecture

`ai-image-provider.mjs` resolves configuration and returns one provider implementing `generate(request)`. Business APIs never call OpenAI or mock classes directly. Provider output is normalized to bytes, MIME type, extension, dimensions, request ID, confidence and model.

## Mock Provider

Default and fallback provider. It creates a deterministic SVG preview in `public/generated`, supports forced failure testing with `[force-fail]`, uses no network and incurs no real cost.

## OpenAI Provider

When `AI_IMAGE_PROVIDER=openai` and `OPENAI_API_KEY` exists, the adapter posts the editable prompt to `POST /v1/images/generations`, using `AI_IMAGE_MODEL` and `AI_IMAGE_SIZE`. It accepts base64 or URL output and writes bytes to local generated storage. The implementation preserves the user-requested `gpt-image-1` default; the provider boundary permits later model changes without business-code changes. Official endpoint/model reference: [OpenAI GPT Image 1](https://developers.openai.com/api/docs/models/gpt-image-1).

## Environment Variables

`AI_IMAGE_PROVIDER`, `OPENAI_API_KEY`, `AI_IMAGE_MODEL`, `AI_IMAGE_SIZE`, `AI_IMAGE_MAX_PER_RUN`. The key is represented only as a boolean in diagnostics.

## Lifecycle

Canonical lifecycle is `draft → pending → running → generated → pending_review → approved/rejected → applied`; failures use `failed` and can retry. The additive `lifecycle_status` preserves the released 05.1 legacy status constraint. `status_history` records transitions.

## Permissions and Cost Control

Admin/Owner/Designer manage the lifecycle. Sales sees only Approved/Applied. VA cannot access. Every run requires confirmation. Selected batches exceeding the configured maximum fail; Run All processes one capped chunk.

## Media and Review

Provider output creates an unlinked AI Generated `media_assets` row. Reject marks it Rejected. Approve authorizes Apply. Apply marks it Approved and adds a non-primary `product_media_links` record, so it cannot replace a main image automatically.

## Production Storage

Local files are a temporary adapter. Production should upload bytes to a private Supabase Storage or Cloudflare R2 bucket, return a durable/signed URL, retain content type and dimensions, and add lifecycle/retention policies. Database records should store URLs and object keys, never large base64 payloads.
