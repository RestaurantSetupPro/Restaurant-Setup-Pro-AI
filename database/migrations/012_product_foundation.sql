-- Module 08A: Product Foundation. Additive PostgreSQL migration only.
BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS library_status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE products ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'Website + Quote';
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS website_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS quote_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS website_price_display TEXT NOT NULL DEFAULT 'Request Quote';

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL,
  variant_sku TEXT UNIQUE,
  dimensions TEXT,
  reference_price NUMERIC(12,2),
  cost_price NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'Active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant_name)
);

CREATE TABLE IF NOT EXISTS product_attribute_definitions (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  data_type TEXT NOT NULL DEFAULT 'Text',
  unit TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_attribute_values (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_id BIGINT NOT NULL REFERENCES product_attribute_definitions(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS product_foundation_relationships (
  source_product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(source_product_id, target_product_id, relationship_type),
  CHECK(source_product_id <> target_product_id)
);

ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS variant_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_product_attribute_values_product ON product_attribute_values(product_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_product_foundation_relationships_source ON product_foundation_relationships(source_product_id, relationship_type, sort_order);

INSERT INTO schema_migrations(version) VALUES ('012_product_foundation') ON CONFLICT(version) DO NOTHING;
COMMIT;
