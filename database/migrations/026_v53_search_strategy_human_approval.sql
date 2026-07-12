BEGIN;
CREATE TABLE IF NOT EXISTS search_strategies (
  id BIGSERIAL PRIMARY KEY, strategy_key TEXT NOT NULL CHECK (LENGTH(TRIM(strategy_key)) > 0),
  revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1), supersedes_id BIGINT REFERENCES search_strategies(id) ON DELETE SET NULL,
  customer_discovery_request_id BIGINT REFERENCES customer_discovery_requests(id) ON DELETE SET NULL,
  linked_search_task_id BIGINT REFERENCES search_tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '', strategy_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  knowledge_references_json JSONB NOT NULL DEFAULT '[]'::jsonb, evidence_references_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_cost_estimate NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (ai_cost_estimate >= 0),
  search_cost_estimate NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (search_cost_estimate >= 0),
  total_budget_limit NUMERIC(14,6) CHECK (total_budget_limit IS NULL OR total_budget_limit >= 0),
  context_snapshot_id BIGINT REFERENCES ai_context_snapshots(id) ON DELETE SET NULL,
  ai_execution_log_id BIGINT REFERENCES ai_execution_logs(id) ON DELETE SET NULL,
  ai_cost_log_id BIGINT REFERENCES ai_cost_logs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Needs Review','Approved','Superseded','Archived')),
  review_note TEXT, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  submitted_by BIGINT REFERENCES users(id) ON DELETE SET NULL, submitted_at TIMESTAMPTZ,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL, approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(strategy_key, revision_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_strategies_single_approved ON search_strategies(strategy_key) WHERE status='Approved';
CREATE INDEX IF NOT EXISTS idx_search_strategies_status_updated ON search_strategies(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_strategies_key_revision ON search_strategies(strategy_key,revision_no DESC);
CREATE INDEX IF NOT EXISTS idx_search_strategies_discovery ON search_strategies(customer_discovery_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_strategies_linked_task ON search_strategies(linked_search_task_id) WHERE linked_search_task_id IS NOT NULL;
INSERT INTO schema_migrations(version) VALUES ('026_v53_search_strategy_human_approval') ON CONFLICT(version) DO NOTHING;
COMMIT;
