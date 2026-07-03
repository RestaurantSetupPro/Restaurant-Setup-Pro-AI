# Alpha Test Issue 003 — Quote Calculation Engine

## Status

Fixed and verified.

## Calculation rules

- Line Total = Quantity × Unit Price − item discount.
- Product Total = Sum of all Line Totals.
- Grand Total = Product Total + Freight + Other Charges.
- Deposit = Grand Total × Deposit %.
- Balance = Grand Total − Deposit.

## Live recalculation

The Quote Builder recalculates immediately, without saving or refreshing, when Sales changes:

- Quantity
- Unit Price
- Item Discount
- Freight Cost
- Other Charges
- Deposit or Balance percentage

## Acceptance result

- Atlas Stone-Top Table: 15 × $180 = $2,700
- Harbor Ash Dining Chair: 50 × $95 = $4,750
- Linework Modular Booth: 1 × $320 = $320
- Product Total: $7,770
- Deposit 50%: $3,885
- Balance: $3,885

Browser testing also verified live recalculation after changing quantity, unit price, discount, and other charges, then restoring the acceptance values.

## Tests

- Full automated suite: 26 passed, 0 failed.
- Browser acceptance: Passed.
