-- Restaurant Setup Pro AI Platform
-- Migration 004: real AI image execution metadata (additive and non-destructive).

BEGIN;

ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (lifecycle_status IN ('draft', 'pending', 'running', 'generated', 'pending_review', 'approved', 'rejected', 'failed', 'applied'));
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS provider_request_id TEXT;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS output_url TEXT;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS output_width INTEGER;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS output_height INTEGER;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS prompt_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5, 4);
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE ai_image_generation_tasks ADD COLUMN IF NOT EXISTS status_history JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE ai_image_generation_tasks SET lifecycle_status = status WHERE lifecycle_status = 'pending' AND status != 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_image_tasks_lifecycle ON ai_image_generation_tasks(product_id, lifecycle_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_image_tasks_execution_queue ON ai_image_generation_tasks(lifecycle_status, provider, created_at);

INSERT INTO schema_migrations (version) VALUES ('004_real_ai_image_generation') ON CONFLICT (version) DO NOTHING;

COMMIT;
