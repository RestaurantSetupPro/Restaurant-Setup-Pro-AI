# Product Intelligence Module

## Single Source of Truth

`products`, normalized product relations, `product_keywords`, and approved `product_media_links` remain the formal shared source for website, Proposal, sales, SEO/GEO, Q&A and future APIs.

## Incremental Layers

- Module 05: formal commercial, sales, SEO/GEO, image metadata and readiness fields.
- Module 05.1: reviewable content drafts and provider-neutral image tasks.
- Module 05.2: mock/OpenAI image execution, local generated-file storage, image review and Apply.

Generated media first enters `media_assets` with AI Generated status. Approval alone does not replace or link product imagery. Apply marks media Approved and adds a non-primary product link, preserving manual control over the main image.

## Product Readiness

Readiness remains five groups of 20 points: basic information, valid main image, price/MOQ/lead time, AI Tags and Sales Notes. Applying a generated image cannot automatically replace the main image.

## Future Consumers

All downstream modules must call Product Intelligence Center. Provider adapters, storage workers and generation queues may extend the workflow but may not create a second product source.
