-- Module 08A Business Optimization V1: administrator-managed product master data.
BEGIN;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE system_tags ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE product_attribute_definitions ADD COLUMN IF NOT EXISTS show_in_library BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE product_attribute_definitions ADD COLUMN IF NOT EXISTS show_on_website BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_definitions ADD COLUMN IF NOT EXISTS show_in_quote BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_definitions ADD COLUMN IF NOT EXISTS show_in_pi BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_attribute_definitions ADD COLUMN IF NOT EXISTS internal_only BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS product_attribute_category_links (
  attribute_id BIGINT NOT NULL REFERENCES product_attribute_definitions(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(attribute_id, category_id)
);
CREATE TABLE IF NOT EXISTS product_attribute_options (
  id BIGSERIAL PRIMARY KEY, attribute_id BIGINT NOT NULL REFERENCES product_attribute_definitions(id) ON DELETE CASCADE,
  option_value TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attribute_id, option_value)
);
INSERT INTO product_attribute_category_links(attribute_id,category_id)
SELECT id,category_id FROM product_attribute_definitions WHERE category_id IS NOT NULL
ON CONFLICT(attribute_id,category_id) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_product_categories_active_sort ON product_categories(active,sort_order,name);
CREATE INDEX IF NOT EXISTS idx_system_tags_group_sort ON system_tags(tag_type,active,sort_order,tag_name);
CREATE INDEX IF NOT EXISTS idx_product_attribute_category ON product_attribute_category_links(category_id,attribute_id);
INSERT INTO schema_migrations(version) VALUES ('013_product_master_data') ON CONFLICT(version) DO NOTHING;
COMMIT;
