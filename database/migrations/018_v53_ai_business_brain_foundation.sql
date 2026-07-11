-- V5.3 Phase 1: AI Business Brain Foundation.
-- Additive migration only. AI records are logs, prompts and snapshots; they do not become business source of truth.
BEGIN;

CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id BIGSERIAL PRIMARY KEY,
  prompt_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  module_name TEXT NOT NULL,
  action_name TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_format TEXT NOT NULL DEFAULT 'json',
  template_text TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(prompt_key, version)
);

CREATE TABLE IF NOT EXISTS ai_context_snapshots (
  id BIGSERIAL PRIMARY KEY,
  context_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  redaction_level TEXT NOT NULL DEFAULT 'internal',
  context_hash TEXT NOT NULL,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_execution_logs (
  id BIGSERIAL PRIMARY KEY,
  module_name TEXT NOT NULL,
  action_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'mock',
  model TEXT,
  prompt_template_key TEXT,
  prompt_version INTEGER,
  context_snapshot_id BIGINT REFERENCES ai_context_snapshots(id) ON DELETE SET NULL,
  input_hash TEXT,
  output_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'blocked', 'cached')),
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  actual_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  cost_log_id BIGINT REFERENCES ai_cost_logs(id) ON DELETE SET NULL,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_lookup ON ai_prompt_templates(prompt_key, active, version DESC);
CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_lookup ON ai_context_snapshots(context_type, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_execution_logs_lookup ON ai_execution_logs(module_name, action_name, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_execution_logs_status ON ai_execution_logs(status, created_at DESC);

INSERT INTO ai_prompt_templates(prompt_key, version, module_name, action_name, variables, output_format, template_text, active)
VALUES (
  'v53.foundation.mock.v1',
  1,
  'ai-business-brain',
  'foundation-check',
  '["context_type","entity_type","entity_id"]'::jsonb,
  'json',
  'Return a structured internal AI foundation response using only the provided business context. Do not modify source-of-truth business records.',
  TRUE
)
ON CONFLICT(prompt_key, version) DO NOTHING;

INSERT INTO schema_migrations(version) VALUES ('018_v53_ai_business_brain_foundation') ON CONFLICT(version) DO NOTHING;
COMMIT;
