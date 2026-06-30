# Module 05 Architecture

## Principle

The existing `products` record remains the canonical product. Module 05 adds reusable intelligence without creating a parallel product model.

```text
Product Intelligence Center
├─ products: core, commercial, sales, SEO, GEO
├─ product_knowledge_links: store/style/features/customers
├─ product_relationships: matching and AI-related products
├─ product_related_category_links: related categories
├─ product_keywords: AI and search keywords
├─ product_media_links → media_assets: image role/status/source
└─ product_case_links: project evidence
          ↓
Future website / proposal / layout / sales / Q&A / content / API consumers
```

## Processing

- Mutations validate input and write to the shared source.
- Rule generation returns suggestions without automatic persistence.
- Human-edited data is saved through the existing product knowledge flow.
- Readiness is calculated server-side and synchronized after relevant changes.
- System Debug Center reports migration state and aggregate intelligence status.

## Compatibility

Migration 002 is additive and idempotent for PostgreSQL. Existing API paths, permissions, tables, records, and Module 01–04 workflows remain intact.
