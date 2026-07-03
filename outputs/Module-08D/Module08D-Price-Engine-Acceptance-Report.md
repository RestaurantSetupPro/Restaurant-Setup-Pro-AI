# Module08D — Price Engine Acceptance Report

## Completed features

- Owner-only Price Rule management with Supplier, Category, Supplier + Category, and Global matching.
- Rule priority, effective dates, currency, multiplier, fixed add-on, minimum-margin reservation, activation, notes, and rounding.
- RMB/CNY conversion using import-batch exchange rate.
- Import Draft reference pricing, applied-rule name, confidence, and Needs Pricing Review state.
- Variant-level cost conversion, reference price, rule link, pricing status, confidence, and override audit.
- Product reference display derived from active Variant minimum/maximum prices.
- Owner manual override and confirmed bulk-recalculation preview.
- Quote defaults from Variant reference price; Sales can edit Quote price without changing Product Library.
- Immutable Quote snapshots for reference price, final price, pricing source, and confidential internal cost.
- Server-side redaction of cost, exchange rate, rule internals, margin/profit, and cost snapshots for Sales/VA.

## Database changes

Additive migration: `017_product_price_engine.sql`.

Added `product_price_rules`, Variant pricing/audit columns, and Quote item pricing snapshot columns. Existing Product, Variant, Quote, PI, and import records were not rebuilt.

## APIs

- `GET/POST /api/price-rules`
- `PUT /api/price-rules/:id`
- `GET /api/pricing/recalculate/preview`
- `POST /api/pricing/recalculate/apply`
- `POST /api/products/:productId/variants/:variantId/price-override`

## Acceptance results

- UP Furniture / Table Base: RMB 156 ÷ 7.2 × 2.0 = USD 43 after nearest-1 rounding.
- Chair Factory / Dining Chair: RMB 153 ÷ 7.2 × 2.2 = USD 47 after nearest-1 rounding.
- Approved Table Base Variants stored reference price USD 43 and the applied rule.
- Quote default Unit Price was USD 43 and retained a Reference pricing snapshot.
- Sales Product/Quote API payloads contained no supplier cost, converted cost, rule ID, multiplier, margin, or cost snapshot.
- Owner override to USD 50 remained unchanged when normal recalculation was confirmed.

## Test result

`npm test`: **31 passed, 0 failed**.

## Screenshots

- `Screenshots/01-Price-Rule-Management.png`
- `Screenshots/02-Owner-Price-Rules.png`
- `Screenshots/03-Draft-Reference-Pricing.png`

## Known limitations

- Minimum margin is reserved for future profit reporting and is not added to the specified formula.
- Real supplier files still require the correct batch currency/exchange rate before analysis.
- Final customer pricing remains intentionally manual in Quote/PI.

## Scope confirmation

Module09 and Supplier Orders were not started.
