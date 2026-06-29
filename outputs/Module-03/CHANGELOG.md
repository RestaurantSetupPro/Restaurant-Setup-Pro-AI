# Module 03

## Added

- Automatic product SKU generation using category, style, and sequence codes.
- Case-insensitive SKU uniqueness enforcement.
- Manual SKU editing with duplicate validation.
- Product create and edit workflow.
- `product_tag_links` many-to-many product/tag relationship.
- Multiple Store Type, Style, and Business tags per product.
- Product tag chips and categorized tag selector.
- Product keyword, category, status, and tag filters.
- Product create/update APIs and integration coverage.
- Module 03 English and Simplified Chinese UI resources.

## Changed

- Product list API now includes category, normalized tag IDs/names, active product tags, and SKU rules.
- Product category seed data now uses the canonical seven SKU categories.
- Product Knowledge Center now supports working create/edit and filter interactions.
- Product create/update mutations are recorded in the audit log.

## Fixed

- Duplicate SKU values that differ only by letter case are now rejected.
- Product tag assignments can no longer contain duplicate product/tag pairs.
- Invalid, inactive, or unsupported tag types are rejected by the product API.

## Removed

None.
