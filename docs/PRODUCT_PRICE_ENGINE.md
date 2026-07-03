# Module08D — Product Price Engine

## Purpose

The engine converts confidential supplier cost into a reference selling price for Product Library and Quote defaults. It does not decide final project pricing. Quote and PI prices remain editable, immutable historical snapshots.

## Rule priority

1. Supplier + Category
2. Supplier only
3. Category only
4. Global rule

Rules are Owner-only and support multiplier, fixed add-on, optional minimum margin reservation, currency, effective date, status, notes, and six rounding modes.

## Formula

`Reference Selling Price = converted supplier cost × multiplier + fixed add-on`, followed by rounding.

Supported rounding: none, nearest 1/5/10, end with .90, and end with .99. Missing rules produce `Needs Pricing Review`.

## Import and Product Library

Spreadsheet cost, original currency, and exchange rate are retained internally. Draft Review shows the reference result, applied rule, confidence, and review status. Approved Variants store converted cost, reference price, rule, confidence, and override state. Product display price is derived from active Variant minimum/maximum prices.

## Overrides and bulk recalculation

Owner manual overrides record user/date and remain unchanged during ordinary bulk recalculation. Recalculation always produces a preview and requires confirmation; manual overrides require an explicit include-overrides choice.

## Quote snapshots

New Quote items default to Variant reference price and store reference, final selling price, pricing source, and an internal cost snapshot. Sales edits change only the Quote snapshot and mark the source `Manual Quote Edit`.

## Confidentiality

Sales and VA APIs do not receive supplier cost, converted cost, exchange rate, rule internals, cost snapshots, margin, profit, or supplier pricing notes.
