# Module 08A - Product Foundation

## Objective

Product Foundation is the single master product database used by recommendation, Quote Builder, PI, orders, and future website publishing. Module08A is additive and does not introduce inventory, purchasing, warehouse, customer portal, or automated importing.

## Structure

- Products remain independent sellable records. Table Tops and Table Bases are not combined into sets.
- Product Categories are unlimited, sortable, and can be created, edited, disabled, or deleted when unused by Admin or Owner. Seed categories are defaults, not hard-coded UI options.
- Product Variants belong to one product and store variant name, SKU, dimensions, reference price, optional cost price, status, and sort order.
- Attribute Definitions are configurable and may apply globally or to multiple categories. Supported types are Text, Number, Select, Multi-select, Color, Image, and Boolean. Select options are normalized master records. Attribute Values belong to a product and optionally a variant.
- Store Type, Style, and Business tags are database master data. Admin or Owner controls names, codes, grouping, order, active status, and deletion of unused tags.
- Attribute display flags govern Product Library, Website, Quote, PI, and internal-only use without duplicating product data.
- Related Products and Frequently Bought Together use normalized relationship records and never force a bundle.
- Product media supports Main Image, Gallery Image, Dimension Drawing, CAD Drawing, Packaging Image, and Installation Image in addition to the existing image types.

## Status and Visibility

Product status supports Active, Hidden, New, Best Seller, Coming Soon, and Discontinued.

Visibility supports Website + Quote, Quote Only, Internal Only, and Hidden. Quote Builder only lists Website + Quote and Quote Only products that are not Hidden or Discontinued.

## Quote and PI Protection

Quote Builder stores the selected `product_id`, optional `variant_id`, and an immutable variant snapshot. Sales may edit quantity, price, discount, material, finish, color, and customer remarks on the quote. These edits never update products or product variants. PI and converted orders use the quote snapshot.

## APIs

- `GET/POST /api/product-categories`
- `PUT/DELETE /api/product-categories/:id`
- `GET/POST /api/product-attributes`
- `PUT/DELETE /api/product-attributes/:id`
- `GET/POST /api/product-tags`
- `PUT/DELETE /api/product-tags/:id`
- `POST /api/products/:id/variants`
- `PUT/DELETE /api/products/:id/variants/:variantId`
- `PUT /api/products/:id/foundation`

## Deferred

AI Product Import, website publishing, inventory, purchasing, warehouse, and customer portal are intentionally excluded.

## Enterprise PIM Foundation Upgrade

Migration `014_pim_foundation_upgrade` keeps one universal Category → Product → Variant → Attribute → Asset model for furniture, kitchen equipment, tableware, lighting, decor, and future restaurant supplies. Category Attribute Templates use normalized attribute/category links and remain manageable by Admin/Owner without code changes.

Variants hold price- and production-changing specifications: material, finish, color, MOQ, lead time, CBM, weights, packing information, reference/cost prices, and supplier-reserved fields. Products also reserve default supplier metadata for future procurement modules; no supplier workflow is included.

Product and variant assets support images, drawings, finish samples, certificates, specification PDFs, manuals, installation guides, test reports, warranties, supplier catalogs, and material certificates. Assets remain optional.

Quote Library Items store an immutable `product_snapshot` plus the existing `variant_snapshot`. Product Library edits therefore do not change historical Quotes, PIs, or Orders.

## Product Library Management UI

Alpha Test Issue 006 adds a dedicated left-menu Product Library section with Products, Categories, Attributes, and Variants pages. Products support create, edit, protected delete, search, filters, and pagination. Product Detail provides General, Variants, Attributes, Images, Related Products, and Frequently Bought Together tabs. All Module08A foundation records can now be maintained without direct API or database access.

Alpha Test Issue 007 makes the Product Create/Edit dialog safe for long forms: only the form body scrolls while Cancel, Save Draft, and Create Product remain fixed at the bottom. Required fields are marked and validated before API submission. Successful creation returns to Products and displays `Product created successfully.`

Alpha Test Issue 008 replaces generic menu-permission checks on product writes with explicit Product Library management capability checks. Owner and Sales Admin can create and edit products. Sales Admin is mapped through the dedicated `salesadmin@rspro.ai` account while retaining the secure Admin permission set. Authentication uses an HttpOnly, SameSite=Lax session cookie.

## Business Optimization V1

Migration `013_product_master_data` adds category lifecycle/order fields, tag ordering, normalized attribute-to-category links, normalized select options, and attribute display controls. Product Create/Edit now loads active categories and tags from the database and renders only global attributes or attributes assigned to the selected category. Only Product Name, Category, SKU/Product Code, Product Status, and Visibility form the minimal product master; all category attributes remain optional and can be completed later with variants, images, and relationships.
