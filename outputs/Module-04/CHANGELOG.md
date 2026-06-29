# Module 04

## Added

- Product Knowledge Engine V2.
- Knowledge Dashboard and main-dashboard knowledge completion.
- Normalized store type, style, feature, and target-customer terms.
- Recommended Products and AI Related Products relationships.
- Product-to-case and product-to-media relationships.
- Knowledge Completeness Score.
- Product Knowledge Detail with four tabs.
- AI Summary, AI Keywords, AI Search Keywords, AI Recommendation Weight, AI Notes, Internal Notes, and Knowledge Prompt.
- Combined product search API and UI filters.
- Knowledge Top 100 and Knowledge Incomplete lists.
- Module 04 integration tests and bilingual resources.

## Changed

- Product list now displays Knowledge Score, store types, and styles.
- Main Dashboard readiness now uses live product knowledge metrics.
- Product reads now include structured knowledge metadata.
- Role permissions add access to Knowledge Dashboard for roles already authorized for products.

## Fixed

- Multi-value product knowledge no longer depends on comma-separated text fields.
- Composite keys prevent duplicate product relationships.
- Knowledge Score updates immediately when related knowledge changes.

## Removed

None.
