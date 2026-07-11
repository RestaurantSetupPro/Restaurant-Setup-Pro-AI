BEGIN;

CREATE TABLE IF NOT EXISTS customer_intelligence_updates (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  update_reason TEXT NOT NULL,
  original_input TEXT NOT NULL,
  reference_note TEXT,
  ai_summary TEXT NOT NULL,
  latest_customer_situation TEXT,
  important_changes TEXT,
  opportunity_impact TEXT,
  recommended_next_action TEXT,
  ai_execution_log_id BIGINT REFERENCES ai_execution_logs(id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_intelligence_updates_customer
  ON customer_intelligence_updates(customer_id, created_at DESC);

INSERT INTO schema_migrations (version)
VALUES ('022_v53_customer_intelligence_update_history')
ON CONFLICT (version) DO NOTHING;

COMMIT;
