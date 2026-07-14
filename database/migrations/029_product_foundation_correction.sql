-- Product Foundation Correction V1.0. Additive PostgreSQL/Supabase migration.
-- Rollback: stop using the new columns/tables. They can be removed only after
-- confirming no Product Foundation V1 data has been written; no legacy column
-- or record is changed by this migration.
BEGIN;

ALTER TABLE product_attribute_definitions ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE product_attribute_definitions ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE product_attribute_definitions ADD COLUMN IF NOT EXISTS minimum_value NUMERIC(14,4);
ALTER TABLE product_attribute_definitions ADD COLUMN IF NOT EXISTS maximum_value NUMERIC(14,4);

UPDATE product_attribute_definitions SET name_en = name WHERE name_en IS NULL OR BTRIM(name_en) = '';
UPDATE product_attribute_definitions SET name_zh = name WHERE name_zh IS NULL OR BTRIM(name_zh) = '';

ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS filterable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS show_on_product BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS show_on_quote BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS show_on_pi BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS internal_only BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS can_be_variant_axis BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS default_unit TEXT;

CREATE TABLE IF NOT EXISTS product_variant_axes (
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_id BIGINT NOT NULL REFERENCES product_attribute_definitions(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(product_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS product_variant_option_values (
  variant_id BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_id BIGINT NOT NULL REFERENCES product_attribute_definitions(id) ON DELETE RESTRICT,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(variant_id, attribute_id)
);

CREATE INDEX IF NOT EXISTS idx_product_variant_axes_product ON product_variant_axes(product_id, sort_order, attribute_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_option_values_variant ON product_variant_option_values(variant_id, attribute_id);

INSERT INTO schema_migrations(version) VALUES ('029_product_foundation_correction') ON CONFLICT(version) DO NOTHING;
COMMIT;
