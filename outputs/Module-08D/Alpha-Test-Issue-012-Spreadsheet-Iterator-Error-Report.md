# Alpha Test Issue 012 — Spreadsheet Iterator Error

## Root cause

Merged-cell gaps created sparse JavaScript arrays. Mapping headers with `Array.map()` preserved empty slots, and `Object.fromEntries()` later received `undefined` instead of a two-value entry.

## Fix

- Sparse rows/cells are normalized before iteration.
- Entry pairs are constructed explicitly and validated before `Object.fromEntries()`.
- Blank rows and sheets are skipped with diagnostics.
- Merged Product/SKU cells are carried forward so following size rows become Variants.
- Invalid ZIP entries, cells, rows, and sheets are guarded.
- Native Chinese and English header aliases are supported.
- Skipped content records Sheet, row, column, and reason in Import Errors and System Debug events.
- Truly unreadable workbooks create a Failed Import Batch with a clear message and downloadable error report.
- Import Center refreshes after failure so the failed batch remains visible.

## Verification

- DUBA-style XLSX with merged SKU/name cells: passed.
- Sparse header and row arrays: passed.
- Blank rows/cells: passed.
- Embedded image entry: passed.
- Invalid XLSX produces a Failed batch and error report: passed.
- `npm test`: **36 passed, 0 failed**.
