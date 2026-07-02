# Module 07 Acceptance Adjustment — Custom Quote Items

## Completed

- Product Library Items remain linked to `product_id` with protected product facts.
- Custom Quote Items have no `product_id` and do not require Product Library creation.
- Two simple Quote Builder buttons: Add Product from Library and Add Custom Item.
- Custom fields cover image/reference, name, category, specification, material, finish, dimensions, quantity, price, discount, optional CBM/weights and remark.
- Custom items participate in totals, payment/freight calculation, preview, PDF, Excel, WhatsApp, Email and version history.
- Convert to Order preserves custom item snapshots in `sales_order_custom_items` and the order snapshot.

## Database

Additive migration: `009_custom_quote_items.sql`.

## Tests

26 passed, 0 failed. Custom item TBC, messages, exports, versions and order snapshots are covered.

## Product Acceptance Verification

- Local UI verified with `Custom Channel-Back Booth` as a custom item without `product_id`.
- Quote Builder automatically updated total quantity to 76 and grand total to USD 13,200.
- Missing CBM, gross weight and net weight display `TBC`.
- PI Preview contains the custom item and updated totals.
- Updated Quote Builder and PI Preview screenshots are included in `UI-Review/Screenshots/`.

## Known Limitation

Reference images are URL/reference fields until production object storage upload is connected.
