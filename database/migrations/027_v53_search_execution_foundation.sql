BEGIN;

CREATE TABLE IF NOT EXISTS search_executions (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  search_task_id BIGINT NOT NULL REFERENCES search_tasks(id) ON DELETE CASCADE,
  search_strategy_id BIGINT NOT NULL REFERENCES search_strategies(id) ON DELETE RESTRICT,
  connector_key TEXT NOT NULL,
  connector_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Awaiting Approval','Approved','Running','Paused','Completed','Partially Completed','Failed','Cancelled','Interrupted')),
  phase TEXT CHECK (phase IS NULL OR phase IN ('Estimating','Fetching','Normalizing','Deduplicating','Persisting','Finalizing')),
  request_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimate_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost_usd NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  approved_cost_limit_usd NUMERIC(14,6) CHECK (approved_cost_limit_usd IS NULL OR approved_cost_limit_usd >= 0),
  actual_cost_usd NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (actual_cost_usd >= 0),
  approval_status TEXT NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Pending','Approved','Rejected','Invalidated')),
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  checkpoint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_request_count INTEGER NOT NULL DEFAULT 0,
  page_count INTEGER NOT NULL DEFAULT 0,
  received_count INTEGER NOT NULL DEFAULT 0,
  normalized_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  stop_requested_at TIMESTAMPTZ,
  stop_reason TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  started_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_result_raw_payloads (
  id BIGSERIAL PRIMARY KEY,
  search_execution_id BIGINT NOT NULL REFERENCES search_executions(id) ON DELETE CASCADE,
  connector_key TEXT NOT NULL,
  connector_version TEXT NOT NULL,
  provider_request_id TEXT,
  external_id TEXT,
  record_index INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_hash TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retention_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(search_execution_id, payload_hash)
);

ALTER TABLE search_results ADD COLUMN IF NOT EXISTS search_execution_id BIGINT REFERENCES search_executions(id) ON DELETE SET NULL;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS connector_key TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS connector_version TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS canonical_website TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS source_category TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS raw_payload_id BIGINT REFERENCES search_result_raw_payloads(id) ON DELETE SET NULL;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS normalization_version TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS dedup_key TEXT;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS duplicate_of_search_result_id BIGINT REFERENCES search_results(id) ON DELETE SET NULL;
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_search_executions_one_active_task ON search_executions(search_task_id)
  WHERE status IN ('Awaiting Approval','Approved','Running','Paused','Interrupted');
CREATE INDEX IF NOT EXISTS idx_search_executions_task_created ON search_executions(search_task_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_executions_status_heartbeat ON search_executions(status,heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_search_raw_execution ON search_result_raw_payloads(search_execution_id,record_index);
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_results_task_external ON search_results(search_task_id,connector_key,external_id)
  WHERE external_id IS NOT NULL AND LENGTH(TRIM(external_id)) > 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_results_task_dedup ON search_results(search_task_id,dedup_key)
  WHERE dedup_key IS NOT NULL AND LENGTH(TRIM(dedup_key)) > 0 AND duplicate_of_search_result_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_search_results_execution ON search_results(search_execution_id,status);
CREATE INDEX IF NOT EXISTS idx_search_results_duplicate ON search_results(duplicate_of_search_result_id);

INSERT INTO schema_migrations(version) VALUES ('027_v53_search_execution_foundation') ON CONFLICT(version) DO NOTHING;
COMMIT;
