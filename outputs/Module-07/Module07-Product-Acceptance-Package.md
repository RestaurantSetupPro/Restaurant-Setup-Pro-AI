# Module 07 Product Acceptance Package

## 1. Local Preview

- Frontend: `http://localhost:3000`
- Backend/API: `http://localhost:3000/api`
- Health check: `http://localhost:3000/api/health`

Frontend and API use the same Node web service and origin.

## 2. Login Information

All demo accounts use password: `Welcome123!`

| Role | Account | Acceptance scope |
|---|---|---|
| Owner | `owner@rspro.ai` | Full workspace, Sales Intelligence, products, customers, settings, Debug Center and AI cost controls. |
| Sales | `sales@rspro.ai` | Focused five-menu UI: + New Inquiry, Customers, Quotes, Orders, Tasks. Can analyze, select products, build/export PI and convert orders. Cannot administer settings. |
| VA | `va@rspro.ai` | Customer import, basic data enrichment and missing-data research. Cannot run Sales quotation/approval/order workflows. |

## 3. Click Paths

- Sales Home: sign in as Sales → the focused Sales workspace opens automatically on `+ New Inquiry`.
- New Inquiry: left menu → `+ New Inquiry`.
- AI Analysis: complete New Inquiry → `Create Inquiry` → `Analyze Inquiry`.
- Product Recommendation: after analysis → scroll to `Possible Products`.
- Quote Builder: select product cards → adjust Quantity/Unit Price → `Generate Quote`. Reopen via `Quotes` → click quote row.
- Add library item: Quote Builder → `Add Product from Library`.
- Add project-specific item: Quote Builder → `Add Custom Item`; no Product Library record is required.
- PI Preview: Quote Builder bottom action bar → `Preview PI`.
- PDF export: Quote Builder bottom action bar → `Export PDF`.
- Excel export: Quote Builder bottom action bar → `Export Excel`.
- WhatsApp message: Quote Builder bottom action bar → `WhatsApp`; message is copied for manual sending.
- Email message: Quote Builder bottom action bar → `Email`; subject/body are copied for manual sending.
- Convert to Order: Quote Builder bottom action bar → `Convert to Order`.
- Orders page: left menu → `Orders`.

## 4. Screenshots

Located in `outputs/Module-07/UI-Review/Screenshots/`:

- `02-Sales-Home.png`
- `03-New-Inquiry.png`
- `04-AI-Analysis-Result.png`
- `05-Product-Recommendation.png`
- `06-Quote-Builder.png`
- `07-PI-Preview.png`
- `08-Orders.png`

## 5. Complete Demo Case

- Customer: California Coffee Lab, Los Angeles, United States
- Inquiry type: Mixed Inquiry
- Message: “We are opening a California-style coffee shop and need 60 dining chairs and 15 restaurant tables with DDP delivery to Los Angeles.”
- AI result: Opening or renovating Coffee Shop; Large opportunity
- Missing information: restaurant layout or dimensions
- Suggested question: “Could you share the restaurant layout or space dimensions?”
- Recommended products:
  - Atlas Stone-Top Table (`TBL-2086`) × 15 at $180 = $2,700
  - Harbor Ash Dining Chair (`CHR-1042`) × 60 at $95 = $5,700
- Generated PI: `PI-2026-435947`
- Product/grand total: $8,400
- Deposit: $2,520 (30%)
- Balance: $5,880 (70%)
- Freight: Freight To Be Quoted
- Converted order: `SO-2026-472888`, total $8,400, status Confirmed

## 6. Known Limitations

### Working

- Sales-only focused navigation and complete inquiry-to-order workflow.
- Rules-based analysis, missing information and suggested questions.
- Live Product Library recommendation and immutable product facts in quotes.
- Independent custom PI items with editable reference image, specification, material, finish, size, pricing and optional logistics values.
- Deterministic quantities, prices, discounts, totals, deposit and balance.
- TBC handling for missing CBM/gross/net weight.
- Quote versions, PI preview, PDF download, Excel-compatible download and order snapshots.
- WhatsApp and email wording generation.

### Mock / Demo Data

- Customer and product records in the review database are demo records.
- AI analysis uses the local rules provider; no paid LLM is called.
- Product images and commercial values are demonstration Product Library data.

### Not Ready Yet

- WhatsApp and email are not sent automatically; generated text is copied for human review/sending.
- PDF is not automatically attached to an email provider.
- No live freight/carrier rate API; freight is entered after external confirmation.
- Attachment input stores references/URLs, not binary uploads to production object storage.
- Excel export is SpreadsheetML `.xls`, not native `.xlsx`.
- Inventory status is product workflow status, not a live warehouse stock count.
- Detailed production/order tracking, electronic signature and payment gateway are not included.

## Review Video

`outputs/Module-07/UI-Review/Module07-Sales-Workflow-Demo.avi` — 63 seconds.
