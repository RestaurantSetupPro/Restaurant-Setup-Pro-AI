# Alpha Test Issue 001 — New Inquiry Customer Blocking Problem

## Status

Fixed and verified.

## Changes

- Added `Select Existing Customer` and `Create New Customer` choices inside New Inquiry.
- New leads can enter restaurant/customer name, company, country, contact, email, phone, and source without leaving the page.
- Creating the inquiry automatically creates or reuses the customer and creates the primary contact when supplied.
- Existing-customer inquiry creation remains unchanged.
- Added idempotent demo customer seeds: California Coffee Lab, Tokyo Sushi House, Harbor Bakery Cafe, and Metro Bubble Tea.
- No menu or workflow was added and the page layout was not redesigned.

## Verified test case

`New Inquiry → Create New Customer → Paste customer message → Create Inquiry → Analyze Inquiry`

Browser test result:

- New customer: Sunset Noodle Bar / Sunset Hospitality Group
- Customer record created: Yes
- Contact record created: Yes
- Inquiry created: Yes
- AI analysis completed: Yes
- Product recommendations displayed: Yes
- Recommended products selected by default: Yes

## Automated tests

- Full suite: 26 passed, 0 failed.
- Tests cover four demo customer seeds, inline customer creation, inquiry creation, and analysis.

## Evidence

- `01-New-Inquiry-Create-New-Customer.png`
- `02-New-Customer-Inquiry-Analyzed.png`
