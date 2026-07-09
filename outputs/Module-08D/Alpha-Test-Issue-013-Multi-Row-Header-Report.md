# Alpha Test Issue 013 – Multi-row Header and Real Supplier Excel Recognition

## Result

Completed. The Smart Import parser now recognizes supplier worksheets whose product header starts below title rows and spans one, two, or three rows.

## Improvements

- Scans the first 50 worksheet rows for bilingual product-header keywords instead of assuming row 1.
- Combines grouped headers and subheaders, for example `Material - Chassis`, `Material - Column`, and `Material - Tray`.
- Carries merged Model and Product Name values down through their variant rows.
- Groups identical models into one Product Draft and creates variants from different dimensions/prices.
- Extracts workbook media and makes embedded images available for Product Draft main-image assignment.
- Preserves sheet, row, source values, mapped columns, detected header range, and diagnostics.
- Creates a failed Import Batch with a readable reason and downloadable error report when analysis cannot continue.
- Displays the detected header row range, mapped columns, product count, variant count, and embedded-image count in Smart Analysis Result.

## Acceptance Regression

A DUBA-style XLSX regression workbook was tested with:

- title rows before the actual header;
- mixed Chinese/English labels;
- a two-row header;
- a horizontally merged Material group with Chassis, Column, and Tray subcolumns;
- vertically merged Model, Image, and Product Name cells;
- model `DB-A002` with five dimension/price rows;
- one embedded workbook image.

Result: 1 Product Draft, 5 Variants, header rows 5–6 detected, all three Material subcolumns mapped, and 1 embedded image detected.

## Tests

- `npm test`: passed
- Total: 37
- Passed: 37
- Failed: 0
- JavaScript syntax checks: passed
- Git whitespace validation: passed

## Scope Note

The exact business DUBA workbook was not present in the workspace, so the automated acceptance test uses a realistic DUBA-structured XLSX fixture matching the reported layout. The real file should still be uploaded through Product Import Center for final business confirmation.

No new module was started.
