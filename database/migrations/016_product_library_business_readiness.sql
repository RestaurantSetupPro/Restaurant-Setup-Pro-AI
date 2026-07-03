-- Module08C: business readiness, source audit, and import error reporting.
BEGIN;
ALTER TABLE product_import_batches ADD COLUMN IF NOT EXISTS supplier_code TEXT;
ALTER TABLE product_import_batches ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE product_import_batches ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_supplier TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_sheet TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_row INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS import_batch_id BIGINT REFERENCES product_import_batches(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS imported_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS source_supplier TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS source_sheet TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS source_row INTEGER;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS import_batch_id BIGINT REFERENCES product_import_batches(id) ON DELETE SET NULL;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS imported_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS last_updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS product_import_errors (
  id BIGSERIAL PRIMARY KEY, batch_id BIGINT NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  source_sheet TEXT, source_row INTEGER, product_name TEXT, reason TEXT NOT NULL, suggested_fix TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_import_batch ON products(import_batch_id,imported_at);
CREATE INDEX IF NOT EXISTS idx_variants_import_batch ON product_variants(import_batch_id,imported_at);
INSERT INTO schema_migrations(version) VALUES ('016_product_library_business_readiness') ON CONFLICT(version) DO NOTHING;
COMMIT;
