# Issue 015 – Product Grouping + Excel Import Fix Report

## Summary

Fixed Product Import Center spreadsheet analysis so real supplier Excel files group products and variants correctly.

## Completed Fixes

- Same Model / SKU is grouped as one Product.
- Multiple rows under the same Model become Variants.
- Empty or merged-down Model cells inherit the previous Model value.
- Multiple possible Model/SKU columns now use the first non-empty candidate instead of failing on an empty first candidate.
- Import Batch analysis summary now stores grouping results.
- Smart Analysis Result UI now displays grouping results.
- Server/debug output prints grouping results in this format:
  - `DB-A002: 5 variants`

## Files Changed

- `src/services/smart-product-import.mjs`
- `src/server.mjs`
- `public/app.js`
- `tests/smart-product-import.test.mjs`

## Acceptance Coverage

- DUBA-style merged Model cells are grouped into one Product.
- Variant rows under the same Model are preserved as multiple Variants.
- Blank Model cells inherit the previous Model value.
- Real bilingual multi-row header layout remains supported.
- Independent chair-style rows remain independent Products and are not incorrectly forced into Variants.

## Test Results

- `node --test tests/smart-product-import.test.mjs`
  - Passed: 5/5
- `npm test`
  - Passed: 38/38
- `git diff --check`
  - Passed

## Known Issues

None for Issue 015.

## Next Step

Retest the real DUBA Table Base supplier Excel in Product Import Center and confirm the Smart Analysis Result shows Product count, Variant count, and Grouping result.
