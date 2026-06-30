# Module 05.1 Architecture

```text
Product + approved source media
        ↓
Rules / future provider adapter
        ↓
ai_product_content_drafts ── review states
        │ approved + Apply
        └────────────────────→ products + product_keywords

ai_image_generation_tasks ── future worker/provider
        │ generated output
        └────────────────────→ media_assets → product_media_links
```

`products` remains the single formal source. Drafts are review snapshots; tasks are provider-neutral work orders. Provider integration cannot write directly to products and must preserve review, cost and failure data.
