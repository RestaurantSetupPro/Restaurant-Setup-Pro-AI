-- Restaurant Setup Pro AI Platform
-- Migration 006: platform-wide AI Cost Control Framework (additive and non-destructive).

BEGIN;

CREATE TABLE IF NOT EXISTS ai_cost_settings (
  id BIGSERIAL PRIMARY KEY,
  daily_budget_usd NUMERIC(12,4) NOT NULL DEFAULT 2,
  monthly_budget_usd NUMERIC(12,4) NOT NULL DEFAULT 50,
  text_budget_usd NUMERIC(12,4) NOT NULL DEFAULT 20,
  image_budget_usd NUMERIC(12,4) NOT NULL DEFAULT 30,
  default_provider TEXT NOT NULL DEFAULT 'mock',
  allow_paid_provider BOOLEAN NOT NULL DEFAULT FALSE,
  require_confirmation_over_usd NUMERIC(12,4) NOT NULL DEFAULT 0.01,
  cache_ttl_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_cost_logs (
  id BIGSERIAL PRIMARY KEY,
  module_name TEXT NOT NULL,
  action_name TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  actual_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('estimated', 'confirmed', 'executed', 'blocked', 'failed', 'cached')),
  blocked_reason TEXT,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_cache_records (
  id BIGSERIAL PRIMARY KEY,
  module_name TEXT NOT NULL,
  action_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  cache_key TEXT NOT NULL UNIQUE,
  cache_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_created ON ai_cost_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_module ON ai_cost_logs(module_name, action_name, status);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_user ON ai_cost_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup ON ai_cache_records(module_name, action_name, entity_type, entity_id, expires_at);

INSERT INTO ai_cost_settings
  (daily_budget_usd, monthly_budget_usd, text_budget_usd, image_budget_usd, default_provider,
   allow_paid_provider, require_confirmation_over_usd, cache_ttl_days)
SELECT 2, 50, 20, 30, 'mock', FALSE, 0.01, 7
WHERE NOT EXISTS (SELECT 1 FROM ai_cost_settings);

INSERT INTO schema_migrations (version) VALUES ('006_ai_cost_control') ON CONFLICT (version) DO NOTHING;

COMMIT;
