# Module08B Part 1 - AI Product Import

## Module08D price calculation

Detected supplier cost, batch currency, and exchange rate now pass through the Product Price Engine. Draft Review displays the reference price, rule, confidence, and Needs Pricing Review status. Sensitive cost details remain Owner/Sales Admin-only.

## Module08C business readiness

Import batches carry Supplier, Supplier Code, Currency, Exchange Rate, and Import Notes as defaults. Approved Products and Variants permanently retain source supplier, file, sheet, row, batch, import date, importer, and last updater.

Results include Product/Variant counts, review outcomes, duplicate matches, image coverage, missing attributes, and duration. Error rows export to an Excel-compatible report. Duplicate review checks Internal SKU, Supplier SKU, Product Name similarity, and possible Variants, then suggests Create Product, Update Existing, Add Variant, or Ignore.

Supplier and purchasing values are confidential. Owner, General Manager, Purchasing, and Sales Admin may receive them. Sales and VA payloads are stripped server-side, including nested Product/Variant and import-draft data.

Product workflow is Draft → Pending Review → Approved → Inactive → Archived. Only Approved Products are available to Quote/PI and sales recommendations.

## Scope

The Product Import Center converts `.xlsx`, `.xls`, and `.csv` supplier spreadsheets into human-reviewed Product Drafts. It does not import PDF/Word catalogs, scrape websites, generate images, publish products, or create supplier/warehouse transactions.

## Flow

Upload File → Import Settings → Smart Analysis → Draft Review → Import Result.

Smart Import and Standard Template Import share the same governed review pipeline. Every batch preserves supplier settings, source filename, source sheet/row, detected columns, original source values, and mapping metadata.

## Recognition

English, Chinese, and mixed headers are normalized to PIM fields. Repeated product/model codes are grouped as one Product with Variants; distinct codes remain independent Product Drafts. Each draft records Product Group, Variant, Attribute Mapping, and Image Matching confidence.

## Review

Draft statuses are Pending Review, Needs Review, Approved, Rejected, and Imported. Admin/Owner may edit, split, merge, reject, and approve. VA may upload and edit drafts but cannot approve. Possible matches require an explicit Create New, Update Existing, Add as Variant, or Ignore decision.

## Images

Embedded XLSX media is extracted and linked as a draft Main Image when a clear sequential match is available. Missing images do not block import and are marked `Image Assets Needed`. No AI image generation occurs.

## Parser Notes

CSV and XLSX are parsed without external services. XML Spreadsheet `.xls` is supported. Legacy binary BIFF `.xls` must be resaved as `.xlsx` or `.csv`; the batch records a visible parsing error rather than losing data.

## APIs

- `GET /api/imports`
- `POST /api/imports/analyze`
- `PUT /api/imports/drafts/:id`
- `POST /api/imports/drafts/:id/split`
- `POST /api/imports/merge`
- `POST /api/imports/drafts/:id/approve`
- `POST /api/imports/drafts/:id/reject`
- `POST /api/imports/approve-selected`

## Database

Migration `015_ai_product_import` adds `product_import_batches`, `product_import_drafts`, and `product_import_assets`.
