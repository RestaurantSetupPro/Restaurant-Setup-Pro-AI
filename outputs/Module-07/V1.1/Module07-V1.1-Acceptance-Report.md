# Module07 V1.1 Sales Usability & PI Optimization — Acceptance Report

## Result

Module07 V1.1 polish is complete. The existing inquiry-to-order workflow and the five Sales menus remain unchanged. No Module08 work was started.

## Completed polish

- AI analysis selects the three most relevant recommended products by default; Sales can unselect them or change quantity and price.
- Quote Builder shows only Image, Product Name, Quantity, Unit Price, Line Total, and Remark by default.
- Category, specification, material, size, CBM, weights, MOQ, lead time, and discount are available in expandable details.
- Product images are larger in recommendations, Quote Builder, and PI Preview.
- Payment terms default to 30% deposit / 70% balance and remain editable per quote.
- Changing either percentage updates the other percentage, amounts, and generated payment wording.
- EXW, FOB, CIF, and DDP are available as freight quick buttons.
- “Generate Proposal” was renamed to “Generate Furniture Package”; no proposal workflow was added.
- Product Library and Custom Quote items can both be duplicated while preserving snapshot values.
- PI Preview emphasizes customer details, product images, totals, deposit, balance, payment terms, and TBC measurements.
- Demo role login buttons are visible in local demo mode and hidden in production mode unless explicitly enabled.
- Custom Quote Items remain supported in preview, exports, versions, totals, and order conversion.

## Compatibility

- New menus: None
- New workflow steps: None
- Database migration for V1.1: None
- Existing Module07 Part1/Part2 and custom item behavior retained.

## Verification

- Test suite: 19 passed, 0 failed.
- JavaScript syntax checks passed for `public/app.js` and `src/server.mjs`.
- Browser acceptance verified AI default selection, simplified table, 40/60 payment linkage, DDP quick selection, custom PI item, percentages, and TBC display.

## Screenshots

- `Screenshots/01-Product-Recommendation.png`
- `Screenshots/02-Quote-Builder.png`
- `Screenshots/03-Payment-Freight.png`
- `Screenshots/04-PI-Preview.png`
- `Screenshots/05-Custom-Item-in-PI.png`

## Known limitations

- Missing product media displays a clear “No image” placeholder.
- Freight cost remains manually entered and shows “Freight To Be Quoted” until provided.
- AI recommendations remain rule-based; AI does not set prices.

## Acceptance status

Ready for Owner / Sales / VA product acceptance. Development stops here pending review.
