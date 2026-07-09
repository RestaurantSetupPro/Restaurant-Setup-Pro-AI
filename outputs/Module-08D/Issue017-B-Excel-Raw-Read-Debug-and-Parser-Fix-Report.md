# Issue017-B - Excel Raw Read Debug and Parser Fix Report

## Summary

Implemented XLSX raw read diagnostics and improved header recognition for normal supplier Excel formats.

Product grouping logic was not changed.

## Completed

### 1. Temporary XLSX Raw Debug Output

After upload/analyze, Import Batch `analysis_summary.workbook_debug` now includes:

- Workbook sheet names
- Active sheet name
- Sheet row count
- Sheet column count
- First 10 rows raw cell values
- Merged cell ranges
- Image objects count
- Header candidates
- Detected headers

The Product Import Center UI now displays this debug block in Smart Analysis Result.

### 2. XLSX Reading Layer Verification

Improved the lightweight XLSX reader to capture:

- Real workbook sheet names from `xl/workbook.xml`
- Active sheet from workbook view
- Sheet dimensions from worksheet `<dimension ref="...">`
- Merged cell ranges from `<mergeCell ref="...">`
- Raw first 10 rows
- Embedded image count from `xl/media/`

### 3. Header Detection Improvement

Added support for normal supplier Excel headers:

- `Model` → product code / SKU
- `Main Image` → image
- `Product Name` → product name
- `Variant Size` → variant / dimensions
- `Finish` → finish
- `Material` → material
- `Cost` → supplier cost

### 4. Cost Compatibility Fix

Fixed numeric parsing so blank numeric fields return `null` instead of `0`.

This prevents blank `supplier_cost` from overriding valid RMB cost values.

## Files Changed

- `src/services/smart-product-import.mjs`
- `src/server.mjs`
- `public/app.js`
- `public/styles.css`
- `tests/smart-product-import.test.mjs`

## Tests

- `node --test tests/smart-product-import.test.mjs`
  - Passed: 6/6
- `npm test`
  - Passed: 39/39
- `node --check src/services/smart-product-import.mjs`
  - Passed
- `node --check src/server.mjs`
  - Passed
- `node --check public/app.js`
  - Passed
- `git diff --check`
  - Passed

## Acceptance Notes

The new test verifies a supplier XLSX layout equivalent to:

```text
Model | Main Image | Product Name | Variant Size | Finish | Material | Cost
```

Expected debug result in test:

- Sheet: `Sheet1`
- Columns: `13`
- Image objects: `1`
- Merged ranges detected
- Headers detected:
  - Model
  - Main Image
  - Product Name
  - Variant Size
  - Finish
  - Cost

## Real DUBA File Verification

The actual file was found and tested locally:

- File: `debug-inputs/DUBA TABLE BASE 2025V2.xlsx`
- Workbook sheet names: `Sheet1`
- Active sheet name: `Sheet1`
- Sheet row count: `143`
- Sheet column count: `13`
- Image objects count: `77`
- Merged ranges detected: `36`
- Header row detected: `Row 1`
- Detected products: `75`
- Detected variants: `104`

Detected headers include:

- Model
- Main Image
- Product Name
- Variant Size
- Finish
- Material - Base
- Material - Column
- Material - Tray
- Height (mm)
- Cost (RMB)
- Unit Weight (kg)
- Package

## Root Cause Fixed

The real file originally showed raw values like `0`, `1`, `2`, etc. instead of header names.

Root cause:

- XLSX cells using shared strings had `t="s"` in a position the old regex did not capture.
- The reader therefore treated shared string indexes as text.
- Header detection saw numeric indexes instead of `Model`, `Main Image`, `Product Name`, etc.
- Result: no header candidate and `Detected columns: None`.

Fix:

- The XLSX cell reader now parses the full `<c ...>` attribute string and extracts `r="..."` and `t="..."` regardless of attribute order.
- Shared string cells are now decoded correctly.
- Header detection now supports normal supplier headers and continuous multi-row headers.

## Next Step

Upload `DUBA TABLE BASE 2025V2.xlsx` again in Product Import Center and confirm the Smart Analysis Result shows:

- Rows: `143`
- Columns: `13`
- Detected headers listed above
- Product count greater than 0
- Variant count greater than 0
