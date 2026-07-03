-- Module 07 Alpha Issue 005: quote-only confirmed specifications and packing overrides.
BEGIN;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS total_cbm_override NUMERIC(12,4);
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS total_gross_weight_override NUMERIC(12,3);
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS total_net_weight_override NUMERIC(12,3);

ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS confirmed_material TEXT;
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS confirmed_finish TEXT;
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS confirmed_color_name TEXT;
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS customer_remark TEXT;
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS swatch_image_url TEXT;

ALTER TABLE sales_quote_custom_items ADD COLUMN IF NOT EXISTS confirmed_material TEXT;
ALTER TABLE sales_quote_custom_items ADD COLUMN IF NOT EXISTS confirmed_finish TEXT;
ALTER TABLE sales_quote_custom_items ADD COLUMN IF NOT EXISTS confirmed_color_name TEXT;
ALTER TABLE sales_quote_custom_items ADD COLUMN IF NOT EXISTS customer_remark TEXT;
ALTER TABLE sales_quote_custom_items ADD COLUMN IF NOT EXISTS swatch_image_url TEXT;

INSERT INTO schema_migrations(version) VALUES ('011_professional_pi_optimization') ON CONFLICT(version) DO NOTHING;
COMMIT;
