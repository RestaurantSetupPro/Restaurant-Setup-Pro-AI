# Module 07 Part 2 — Quote Builder & PI Builder Report

## Completed

- Four-section Quote Builder without new menus or workflow steps.
- Live Product Library fields and protected product facts.
- Quantity, unit price, line discount, and remark editing.
- Server-side totals, CBM/weight totals with TBC behavior.
- Payment term and freight management.
- PI preview and signature area.
- PDF and Excel-compatible export.
- WhatsApp and professional email wording.
- Immutable quote version history.
- Lossless quote-to-order snapshot and order items.
- Product Library and independent Custom Quote Item line types.
- Custom items included in preview, exports, messages, versions, calculations and order snapshots.

## Database

Additive migration `008_quote_pi_builder.sql` adds optional Product Library logistics fields, quote commercial fields, `sales_quote_versions`, `sales_order_items`, and an order snapshot. No existing table was rebuilt.

Acceptance migration `009_custom_quote_items.sql` adds `sales_quote_custom_items` and `sales_order_custom_items` without changing existing line-item data.

## Tests

- Full test result: 26 passed, 0 failed.
- Part 1 and Part 2 workflow tests pass.
- PDF signature, Excel content, calculations, versions, messages, TBC, and order copy are covered.

## Known Issues

- Direct WhatsApp/email delivery is intentionally excluded.
- Freight cost is manual until a future carrier integration.
- Excel export uses Excel-compatible SpreadsheetML (`.xls`) rather than `.xlsx`.

## Deployment

Run migration 008 before application startup. No new environment variables are required.

## Next Step

Stop after delivery and wait for product-manager acceptance. Do not continue another Module 07 part.
