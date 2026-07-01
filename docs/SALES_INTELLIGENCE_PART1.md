# Module 07 — Sales Intelligence Part 1

## Objective

Provide one simple sales workflow: Customer Inquiry → AI Requirement Analysis → Product Recommendation → Quote/Proposal → Customer Confirmation → Order → Tracking. Sales users see only five menu entries: + New Inquiry, Customers, Quotes, Orders, and Tasks.

## Inquiry Experience

Sales selects the customer and inquiry type, then pastes the original customer message. The rules provider derives intent, opportunity size, missing information, next question, project type, budget range, and recommended product categories. Results remain reviewable and regenerate can bypass cache.

## Product and Quote Rules

Recommendations query Product Intelligence directly. Quote items store `product_id`, quantity, unit price, discount, and remark. Product name, SKU, category, image, material, size, MOQ, lead time, and price range are always rendered from Product Library and are never manually duplicated by Sales.

Quote generation is a three-step workflow: select products, adjust quantity/price, generate PI. Freight Quote stores destination and trade term. A generated quote can be converted to an order.

## Tasks and Timeline

Every inquiry creates a follow-up task. Customer timeline events are added automatically for inquiry receipt, AI analysis, quote generation, and order creation.

## APIs

- `GET /api/sales-workspace`
- `POST /api/sales-inquiries`
- `GET /api/sales-inquiries/:id`
- `POST /api/sales-inquiries/:id/analyze`
- `PUT /api/sales-inquiries/:id/products`
- `POST /api/sales-inquiries/:id/quote`
- `POST /api/sales-inquiries/:id/convert-order`

## AI Cost Control

Inquiry analysis uses the shared AI Cost Control Framework. Version 1 uses rules with zero actual cost, logs every execution, and caches identical inquiry analysis by default.

## Part 1 Boundary

Proposal export, PI/PDF rendering, advanced freight calculation, customer sending, and detailed order tracking are reserved for later Module 07 parts. No automatic customer communication is performed.
