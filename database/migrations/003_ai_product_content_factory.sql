-- Restaurant Setup Pro AI Platform
-- Migration 003: AI Product Content Factory (additive and non-destructive).

BEGIN;

CREATE TABLE IF NOT EXISTS ai_product_content_drafts (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_media_id BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
  generation_mode TEXT NOT NULL CHECK (generation_mode IN ('fast', 'standard', 'premium')),
  generated_product_name TEXT,
  generated_category TEXT,
  generated_sub_category TEXT,
  generated_material TEXT,
  generated_color TEXT,
  generated_style JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_store_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_description_en TEXT,
  generated_description_zh TEXT,
  generated_short_sales_description TEXT,
  generated_seo_title TEXT,
  generated_seo_description TEXT,
  generated_meta_keywords TEXT,
  generated_llm_summary TEXT,
  generated_faq TEXT,
  generated_buying_guide TEXT,
  generated_sales_talking_points TEXT,
  generated_proposal_notes TEXT,
  generated_ai_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_summary TEXT,
  cost_estimate NUMERIC(10, 4) NOT NULL DEFAULT 0.01,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'applied')),
  reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_image_generation_tasks (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_media_id BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
  image_type TEXT NOT NULL,
  scene_type TEXT,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  generation_mode TEXT NOT NULL CHECK (generation_mode IN ('fast', 'standard', 'premium')),
  provider TEXT NOT NULL DEFAULT 'reserved',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'generated', 'approved', 'rejected', 'failed')),
  output_media_id BIGINT REFERENCES media_assets(id) ON DELETE SET NULL,
  cost_estimate NUMERIC(10, 4) NOT NULL DEFAULT 0,
  reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_content_drafts_product_status ON ai_product_content_drafts(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_content_drafts_review ON ai_product_content_drafts(status, reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ai_image_tasks_product_status ON ai_image_generation_tasks(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_image_tasks_provider_status ON ai_image_generation_tasks(provider, status);

INSERT INTO schema_migrations (version) VALUES ('003_ai_product_content_factory') ON CONFLICT (version) DO NOTHING;

COMMIT;
