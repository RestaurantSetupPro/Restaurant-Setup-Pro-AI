-- Module08A PIM Foundation Upgrade. Additive PostgreSQL migration only.
BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS default_supplier TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_cost NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_lead_time_days INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_moq NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_notes TEXT;

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS material TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS finish TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS moq NUMERIC(12,2);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS cbm NUMERIC(12,4);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(12,3);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS net_weight_kg NUMERIC(12,3);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS packing_info TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS default_supplier TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_sku TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_cost NUMERIC(12,2);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_lead_time_days INTEGER;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_moq NUMERIC(12,2);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_notes TEXT;

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS product_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_media_assets_product_variant ON media_assets(related_module, related_record_id, variant_id);
INSERT INTO schema_migrations(version) VALUES ('014_pim_foundation_upgrade') ON CONFLICT(version) DO NOTHING;
COMMIT;
