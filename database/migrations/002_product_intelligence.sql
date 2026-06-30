-- Restaurant Setup Pro AI Platform
-- Migration 002: Product Intelligence Center (additive and non-destructive).

BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_series TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS finish TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS budget_level TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS recommended_usage TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS common_questions TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS common_objections TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS proposal_ready_status TEXT NOT NULL DEFAULT 'Needs Review';
ALTER TABLE products ADD COLUMN IF NOT EXISTS english_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS short_sales_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS proposal_usage_notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_talking_points TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_keywords TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS canonical_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_alt TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_caption TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_keywords TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS llm_summary TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS use_cases TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS best_for TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS not_recommended_for TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS comparison TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS advantages TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS disadvantages TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS faq TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS buying_guide TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS installation_guide TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS maintenance_guide TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS common_problems TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS suggested_prompt TEXT;

ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS image_type TEXT NOT NULL DEFAULT 'Detail Image';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS image_status TEXT NOT NULL DEFAULT 'Uploaded';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS generated_source TEXT;

CREATE TABLE IF NOT EXISTS product_related_category_links (
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_products_budget_level ON products(budget_level);
CREATE INDEX IF NOT EXISTS idx_products_proposal_ready ON products(proposal_ready_status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_media_assets_image_type ON media_assets(image_type, image_status);
CREATE INDEX IF NOT EXISTS idx_product_related_categories_category ON product_related_category_links(category_id, product_id);

INSERT INTO schema_migrations (version) VALUES ('002_product_intelligence') ON CONFLICT (version) DO NOTHING;

COMMIT;
