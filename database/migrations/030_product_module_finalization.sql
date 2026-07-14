-- Product Module Finalization V2.0. Additive PostgreSQL/Supabase migration.
-- Rollback: stop reading the new columns and tables first. The new tables and
-- columns may then be removed only after exporting any V2 catalog data. This
-- migration never deletes or rewrites existing Products, Variants, SKU, price,
-- supplier, media, category, attribute, tag, Quote, PI, or Workflow records.
BEGIN;

ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS name_zh TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS category_code TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS description_zh TEXT;
UPDATE product_categories SET name_en=name WHERE name_en IS NULL OR BTRIM(name_en)='';
UPDATE product_categories SET name_zh=name WHERE name_zh IS NULL OR BTRIM(name_zh)='';
UPDATE product_categories SET category_code=UPPER(REPLACE(slug,'-','_')) WHERE category_code IS NULL OR BTRIM(category_code)='';
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_categories_code ON product_categories(LOWER(category_code));

ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS searchable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_category_links ADD COLUMN IF NOT EXISTS show_on_storefront BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_variant_axes ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_mode TEXT NOT NULL DEFAULT 'quote_only';
ALTER TABLE products ADD COLUMN IF NOT EXISTS publish_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE products ADD COLUMN IF NOT EXISTS storefront_title_zh TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS storefront_title_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS storefront_description_zh TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS storefront_description_en TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_display_mode TEXT NOT NULL DEFAULT 'request_quote';
ALTER TABLE products ADD COLUMN IF NOT EXISTS minimum_order_quantity NUMERIC(14,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_text TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_mode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS request_quote_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS customization_available BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_axis_review_status TEXT NOT NULL DEFAULT 'clear';
UPDATE products SET variant_axis_review_status='needs_review'
WHERE id IN (SELECT product_id FROM product_variant_axes WHERE active=TRUE GROUP BY product_id HAVING COUNT(*)>1);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM product_variant_axes WHERE active=TRUE GROUP BY product_id HAVING COUNT(*)>1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_product_variant_axes_one_active ON product_variant_axes(product_id) WHERE active=TRUE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS product_attribute_aliases (
  id BIGSERIAL PRIMARY KEY,
  attribute_id BIGINT NOT NULL REFERENCES product_attribute_definitions(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attribute_id, normalized_alias)
);
CREATE INDEX IF NOT EXISTS idx_product_attribute_aliases_lookup ON product_attribute_aliases(normalized_alias,attribute_id);

CREATE TABLE IF NOT EXISTS supplier_import_mapping_profiles (
  id BIGSERIAL PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  source_column TEXT NOT NULL,
  target_field TEXT NOT NULL,
  attribute_id BIGINT REFERENCES product_attribute_definitions(id) ON DELETE SET NULL,
  default_category_id BIGINT REFERENCES product_categories(id) ON DELETE SET NULL,
  currency TEXT,
  exchange_rate_rule TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(supplier_name, source_column)
);
CREATE INDEX IF NOT EXISTS idx_supplier_import_mapping_profiles_supplier ON supplier_import_mapping_profiles(LOWER(supplier_name),active);

CREATE TABLE IF NOT EXISTS channel_product_mappings (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel IN ('shopify','woocommerce','alibaba','other')),
  external_product_id TEXT,
  external_variant_id TEXT,
  external_url TEXT,
  sync_status TEXT NOT NULL DEFAULT 'not_connected',
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_channel_product_mappings_product ON channel_product_mappings(product_id,channel,sync_status);

INSERT INTO schema_migrations(version) VALUES ('030_product_module_finalization') ON CONFLICT(version) DO NOTHING;
COMMIT;
