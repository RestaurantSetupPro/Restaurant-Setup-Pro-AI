# Alpha Test Issue 004 — Global Proforma Invoice Template V1

## Status

Completed and verified locally. Module08 was not started.

## Delivered

- Unified English Global PI data model for Preview, PDF, and editable Excel export.
- Company identity is read from `organization_settings`; missing company fields remain blank.
- Optional receiving bank accounts are read from `organization_bank_accounts` and selectable per quote.
- Missing bank data displays “Bank information to be provided separately.”
- Buyer, project, reference, shipping, packing, production, remarks, and special-term fields are editable in Quote Builder.
- Product Library and Custom Quote Items use the same customer-facing product structure.
- Packing/logistics, commercial summary, payment terms, bank, shipping, remarks, terms, and signatures are included.
- WhatsApp and Email content reference the PI number and current grand total.
- PDF is multi-page A4 with wrapped English text and dark-green section headings.
- Excel uses the same Global PI sections and remains editable.

## Acceptance result

- Atlas Stone-Top Table: 15 × USD 180.00 = USD 2,700.00
- Harbor Ash Dining Chair: 50 × USD 95.00 = USD 4,750.00
- Custom Booth Seating: 1 × USD 320.00 = USD 320.00
- Product Subtotal: USD 7,770.00
- Grand Total: USD 7,770.00
- Deposit 50%: USD 3,885.00
- Balance: USD 3,885.00
- Trade Term: DDP
- Destination: Los Angeles, USA
- Unknown CBM and weights: TBC
- Bank data: fallback message displayed because no bank account is configured

## Database

- Additive migration: `010_global_pi_template.sql`
- Added manual PI fields to `sales_quotes`
- Added `organization_bank_accounts`
- No existing product or quote tables were rebuilt

## Tests and visual verification

- Automated tests: 26 passed, 0 failed
- Preview DOM acceptance: passed
- PDF rendered with Poppler and all three A4 pages were visually inspected
- Excel structure/content assertions: passed

## Acceptance files

- `Global-PI-V1-Preview.png`
- `Global-PI-V1-Acceptance.pdf`
- `Global-PI-V1-Acceptance.xls`
- `Global-PI-V1-PDF-Page-1.png`
- `Global-PI-V1-PDF-Page-2.png`
- `Global-PI-V1-PDF-Page-3.png`
