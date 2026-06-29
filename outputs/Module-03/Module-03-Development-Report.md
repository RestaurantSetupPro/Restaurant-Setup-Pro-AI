# Module 03 Development Report

Project: **Restaurant Setup Pro AI Platform**  
Module: **Module 03 — Product SKU Rules and Product Tags**  
Report date: **June 28, 2026**  
Deployment target: **Local**

## Module Overview

Module 03 turns the existing Product Knowledge Center into a working product-maintenance workflow. It introduces structured SKU generation, case-insensitive SKU uniqueness, manual SKU editing, categorized multi-tag assignment, and product search/filter controls. The module reuses the category and tag foundations delivered in Module 02 and preserves the existing authentication, RBAC, navigation, i18n, and audit foundations.

The implemented SKU format is:

```text
<Category Code>-<Style Code>-<Three-Digit Sequence>
```

Example: `BS-JP-001`.

Category codes:

| Category | Code |
| --- | --- |
| Booth Seating | BS |
| Dining Chair | CH |
| Restaurant Table | TB |
| Bar Stool | ST |
| Outdoor Furniture | OD |
| Partition / Divider | PT |
| Counter / Service Bar | CT |

Style codes:

| Style | Code |
| --- | --- |
| California | CA |
| Japandi | JP |
| Industrial | IN |
| Luxury | LX |
| Modern | MD |
| Minimalist | MN |

## Completed Features

- Automatic SKU generation for new products from product category, SKU style, and the next available sequence.
- Server-side, case-insensitive SKU uniqueness enforcement.
- Manual SKU entry and editing with duplicate rejection.
- Product create workflow with name, category, style, SKU, summary, material, size, price range, lead time, MOQ, status, and tags.
- Product edit workflow using the same validated form.
- Many-to-many product tag binding.
- Product tag scope restricted to:
  - Store Type Tags
  - Style Tags
  - Business Tags
- Multi-select tag chips in the product form.
- Tag chips displayed in the product table.
- Product keyword search across visible product data, including name, SKU, and tags.
- Category, status, and tag filters; filters can be combined.
- Canonical seven-category product taxonomy aligned with SKU rules.
- Product create/update audit events.
- English and Simplified Chinese UI resources for all new product controls and validation messages.

## UI Pages

| UI surface | Module 03 status |
| --- | --- |
| Dashboard | Existing page retained; included as an acceptance-context screenshot. |
| Product List | Enhanced with SKU, tag chips, keyword search, category/status/tag filters, and edit actions. |
| Product Detail | Product data is presented through the Product Edit modal; no separate read-only route exists. |
| Product Create/Edit | New modal workflow with automatic/manual SKU controls and categorized multi-tag selector. |
| Search | Existing global command search retained; product-list search now searches product rows, SKUs, and tags. |
| Filter | New combinable category, status, and tag filters on the Product List. |
| Tag | New product tag selector and product-list tag display/filter behavior. Tag dictionary management remains in Module 02 Tag Center. |
| Media | Existing Module 02 Media Center retained and included for dependency/context verification. Module 03 does not add product media binding. |

Acceptance screenshots are stored in `Screenshots/` at 1920×1080:

- `01-Dashboard.png`
- `02-Product-List.png`
- `03-Product-Detail.png`
- `04-Product-Create-Edit.png`
- `05-Search.png`
- `06-Filter.png`
- `07-Tag.png`
- `08-Media.png`

## Database Changes

Yes.

- Added `product_tag_links` as a normalized many-to-many relationship between `products` and `system_tags`.
- Added composite primary key `(product_id, tag_id)` to prevent duplicate tag links.
- Added cascading foreign keys so product/tag link rows do not become orphaned.
- Added `idx_product_tag_links_tag` for tag-to-product lookup.
- Added case-insensitive unique index `idx_products_sku_nocase` on `products.sku`.
- Canonicalized the seeded product categories used by the SKU rules.
- Existing legacy `products.tags` text data is retained for backward compatibility; Module 03 writes structured tag links.

Exported schema: `Database/schema.sql`.

## New APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/products` | Returns products with category, `tag_ids`, `tag_names`, categories, active product tags, and SKU rule metadata. |
| POST | `/api/products` | Creates a product, automatically generates SKU when omitted, validates uniqueness/tags, binds tags, and records an audit event. |
| PUT | `/api/products/:id` | Updates product data, supports manual SKU changes, validates uniqueness/tags, replaces tag links, and records an audit event. |

All endpoints require authentication and the existing `products` module permission.

## New Components

### Server

- `skuCategoryCodes` and `skuStyleCodes`: authoritative SKU code maps.
- `productTagTypes`: allowed tag families for product assignment.
- `nextSku()`: calculates the next SKU sequence for a category/style prefix.
- `normalizeSku()`: trims and normalizes SKU values to uppercase.
- `validateProductTags()`: validates active tag IDs and allowed product tag families.
- `productWithTags()`: assembles product records with normalized tag IDs and names.
- `mutateProduct()`: shared create/update transaction handler.

### Client

- `openProductModal()`: renders create/edit product form.
- `saveProductForm()`: submits create/update payloads and handles duplicate-SKU feedback.
- `productSkuPreview()`: previews the next SKU in the form.
- `applyProductFilters()`: combines keyword, category, status, and tag filtering.
- Product tag chips, tag selector fieldsets, SKU generator control, and responsive modal styles.

## Test Results

Command:

```bash
npm test
```

Final result on June 28, 2026:

```text
Tests: 14
Passed: 14
Failed: 0
Skipped: 0
```

Module 03 integration coverage verifies:

- Automatic `BS-CA-001` generation.
- Multi-category tag assignment and retrieval.
- Case-insensitive duplicate SKU rejection (`BS-CA-001` versus `bs-ca-001`).
- Manual SKU update to a unique value.
- Existing authentication, RBAC, Module 02 foundations, and i18n key parity remain green.

Browser acceptance verified the create/save/edit workflow, generated `BS-JP-001`, tag display, keyword search, combined filters, tag filtering, and all requested screenshot surfaces.

## Known Issues

- Product Detail currently reuses the Product Edit modal; there is no standalone read-only product detail route.
- When category or SKU style is changed after the create form opens, the client preview is refreshed by pressing **Generate**. The server still generates the correct next SKU whenever SKU is omitted.
- Existing legacy seed products retain their historical SKU formats and legacy `products.tags` text. New and edited products use normalized product-tag links.
- Global command search currently searches accessible pages only; product record search is provided inside Product Knowledge Center.
- Product media attachment is not part of Module 03. Media Center remains metadata-only from Module 02.
- No product delete/archive management workflow beyond selecting the existing `archived` status in the edit form.

## Future Improvements

- Add a dedicated read-only Product Detail route with documents, media, audit history, and related proposals.
- Refresh the SKU preview immediately when category or SKU style changes.
- Migrate legacy text tags and historical SKUs through a reviewed data-migration tool.
- Add pagination and server-side query parameters for large product libraries.
- Extend global search to product records and opportunities.
- Add product media/document assignment after storage integration is approved.
- Add SKU reservation/counter records if the deployment moves to concurrent multi-instance writes.

## Next Module Dependencies

- Module 04 must consume product IDs and normalized `product_tag_links`; it must not parse the legacy `products.tags` field.
- Any proposal, recommendation, case-study, or AI workflow should use `GET /api/products` and the returned `tag_ids`/`tag_names`.
- Product selection interfaces should treat SKU as case-insensitively unique.
- Category/style selectors must use the authoritative Module 03 SKU code maps or a future database-backed replacement.
- Product media work depends on a production storage/upload decision; the current `media_assets` table stores metadata only.
- No Module 04 development has been started as part of this delivery.
