# Module 07 Part 2 — Quote Builder & PI Builder

## Module07 V1.1 usability polish

- AI recommendations select the top three matching Product Library items by default.
- Quote Builder keeps only sales-critical columns visible; operational specifications are expandable.
- Product Library and Custom Quote items support duplication.
- Deposit and balance percentages remain linked to 100%, with live amount and payment-note updates.
- EXW, FOB, CIF, and DDP use quick-select buttons.
- PI Preview uses larger product media and emphasizes customer details, totals, payment terms, and TBC values.
- Demo role login buttons are disabled in production mode unless `DEMO_MODE=true` is explicitly configured.

## Alpha Test Issue 001

New Inquiry supports both existing customers and inline creation of a new customer. A new lead can be captured and analyzed without leaving the inquiry page. Customer and optional primary contact records are created with the inquiry, while existing-customer behavior is preserved.

## Objective

Replace spreadsheet quotation preparation with a four-section modern Quote Builder that produces a complete Proforma Invoice in under three minutes.

## Four Sections

1. Customer Information: customer, company, country, currency, salesperson, quote date, validity.
2. Product Table: immutable Product Library facts plus editable quantity, unit price, discount, and remark.
3. Payment Terms & Freight: deposit/balance percentages, payment wording, trade term, shipping method, destination, freight and transit data.
4. Summary: automatically calculated product total, discounts, freight, other charges, grand total, deposit and balance.

CBM, gross weight, and net weight are optional Product Library fields. A missing value renders as `TBC`, never zero.

## Two Line Item Types

- Product Library Item retains `product_id`; product facts remain read-only and are joined from Product Intelligence.
- Custom Quote Item has no `product_id`. Sales may enter a reference image, name, category, specification, material, color/finish, dimensions, quantity, price, optional CBM/weights and remark without creating a product record.

Quote Builder exposes only `Add Product from Library` and `Add Custom Item`. Both types participate in preview, exports, messages, totals, versions and order conversion. Orders preserve custom items in normalized snapshots.

## Calculation Rules

- Line total = quantity × unit price × (1 − line discount %).
- Product total includes line and quote discounts.
- Grand total = product total + confirmed freight + other charges.
- Deposit and balance are percentages of grand total.
- AI never calculates or determines price.

## Version History

Each Generate PI/save creates an immutable snapshot in `sales_quote_versions`. Previous versions can be reopened without data loss.

## Preview and Export

- PI preview includes company/customer information, products, payment terms, summary, remarks, and signature.
- PDF is generated as a downloadable PI.
- Excel uses SpreadsheetML for Excel-compatible download.
- WhatsApp and Email endpoints generate professional customer messages; no message is sent automatically.

## Convert to Order

Conversion creates an order snapshot and normalized order items, copying customer, products, quantities, prices, payment terms, freight, remarks, currency, and totals. Sales does not re-enter data.

## APIs

- `GET/PUT /api/sales-quotes/:id`
- `GET /api/sales-quotes/:id/versions/:version`
- `GET /api/sales-quotes/:id/export/pdf`
- `GET /api/sales-quotes/:id/export/excel`
- `GET /api/sales-quotes/:id/whatsapp`
- `GET /api/sales-quotes/:id/email`
- `POST /api/sales-quotes/:id/items/library`
- `POST /api/sales-quotes/:id/items/custom`

## Boundaries

Part 2 generates messages and files but does not automatically send WhatsApp or email. Freight provider integrations and electronic signatures remain future work.
