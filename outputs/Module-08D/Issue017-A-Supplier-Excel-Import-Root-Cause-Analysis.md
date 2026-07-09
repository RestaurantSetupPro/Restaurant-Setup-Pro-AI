# Issue017-A - Supplier Excel Import Root Cause Analysis

## Goal

Find the exact reason why the real supplier XLSX cannot be parsed.

No parser redesign or parser fix was implemented in this task.

## Source Checked

The local database contains one failed real supplier import batch:

- Batch ID: `11`
- Source file name: `DUBA TABLE BASE 2025V2.xlsx`
- Supplier: `DUBA HARDWARE`
- Supplier code: `SUP-001`
- Import mode: `Smart Import`
- Default category: `Table Base`
- Currency: `CNY`
- Exchange rate: `6.8`
- Status: `Failed`
- Created at: `2026-07-09 02:34:50`

## Important Blocker

The original uploaded XLSX file is not available in the current workspace.

Searched locations:

- Project workspace
- `public/`
- `data/`
- `database/`
- `outputs/`
- Codex attachment directory
- Administrator Desktop / Downloads / Documents

Found files:

- Only PI sample spreadsheets and sample CSV files were found.
- `DUBA TABLE BASE 2025V2.xlsx` was not found.

Because the original XLSX file was not retained after the failed upload, the following requested debug outputs cannot be truthfully reconstructed from the actual file:

- Sheet dimensions
- First 10 rows raw values
- Real workbook tab names
- Raw merged-cell layout
- Raw embedded image anchors

## Debug Output From Saved Failed Import Batch

### 1. Workbook Sheet Names

Saved diagnostic only reports:

- `Sheet 1`

Note: this is the parser-generated sheet label, not necessarily the real Excel tab name.

### 2. Sheet Dimensions

Unavailable.

Reason: source XLSX file was not stored after failed import.

### 3. First 10 Rows Raw Values

Unavailable.

Reason: source XLSX file was not stored after failed import, and failed batches currently do not persist raw worksheet rows.

### 4. First 5 Rows Detected As Header Candidates

Saved diagnostic:

```json
[]
```

The failed batch stored:

```json
{
  "header_ranges": [],
  "diagnostics": [
    {
      "sheet": "Sheet 1",
      "possibleHeaderRows": [],
      "reason": "No recognizable 1–3 row product header area; sheet skipped."
    }
  ]
}
```

### 5. Column Names Detected

Saved value:

```text
Detected columns: None
```

Database value:

```text
detected_columns = null
```

### 6. Reason Why Parser Returns `Detected columns: None`

The immediate reason is:

1. The parser failed during header detection.
2. `headerArea()` returned no candidates.
3. The import failed before `detected_columns` was populated.
4. The failed batch path saved `analysis_summary.diagnostics`, but left `product_import_batches.detected_columns` as `null`.
5. The UI therefore displays `Detected columns: None`.

## Parser Decision Point

Current header detection logic scans sheet rows and only accepts a header candidate when:

- Header depth is 1 to 3 rows.
- The candidate maps at least 2 core product fields.

Core fields include:

- SKU / Model
- Product Name
- Image
- Dimensions
- Material
- Finish
- Color
- Height
- Price
- RMB
- USD
- Weight

For this failed batch, the saved result shows:

- No 1-row candidate
- No 2-row candidate
- No 3-row candidate
- No mapped columns
- No possible header rows

## Confirmed Root Cause From Available Evidence

The confirmed root cause is:

> The supplier file reached the parser, but the parser could not identify any recognizable 1-3 row product header area. Because no header candidate was accepted, no column mapping was created, no product rows were analyzed, and `detected_columns` remained null.

## What Cannot Be Confirmed Without The Original XLSX

The exact file-level reason cannot be proven until the original XLSX is available.

Possible file-level causes include:

1. The actual header area is more than 3 rows deep.
2. The actual header area is outside the scanned area.
3. Important labels are stored as shapes/text boxes instead of normal cells.
4. Important labels are stored in rich text XML that the current lightweight parser did not extract correctly.
5. The supplier sheet uses grouped headers that do not match current aliases.
6. Merged cells or blank cells caused the visible Excel header to differ from extracted XML cell values.

These are not implemented fixes. They are hypotheses that require the actual XLSX raw rows to confirm.

## Required Next Debug Step

To complete the exact root-cause analysis, upload or place the real file here:

```text
E:\AI-Projects\2026-06-28\web-restaurant-setup-pro-ai-platform\debug-inputs\DUBA TABLE BASE 2025V2.xlsx
```

Then run a diagnostic-only parser that prints:

- Real workbook sheet names
- Sheet dimensions
- First 10 raw rows
- First 5 header candidates
- Detected column names
- Why each candidate passed or failed

## Recommended Non-Parser Fix For Future Debuggability

Before redesigning parser logic, the application should retain failed import source files or at least store a sanitized raw-row debug snapshot for failed batches.

This would make future root-cause analysis possible without asking the user to re-upload the supplier file.

## Status

- Parser redesigned: No
- Parser fixed: No
- Root cause from saved diagnostics: Confirmed
- Exact raw-file root cause: Blocked by missing source XLSX
