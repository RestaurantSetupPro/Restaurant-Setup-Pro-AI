-- V5.3 Opportunity Intelligence V3.0: AI Customer Discovery Execution Center MVP.
-- Planning task management only. No external search provider is connected.
BEGIN;

CREATE TABLE IF NOT EXISTS search_tasks (
  id BIGSERIAL PRIMARY KEY,
  customer_discovery_request_id BIGINT REFERENCES customer_discovery_requests(id) ON DELETE SET NULL,
  task_name TEXT NOT NULL,
  target_customer TEXT,
  customer_type TEXT,
  industry TEXT,
  location TEXT,
  company_size TEXT,
  search_objective TEXT,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_quantity INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'Medium',
  required_data_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_tasks_status_created ON search_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_tasks_discovery_request ON search_tasks(customer_discovery_request_id);

INSERT INTO schema_migrations(version) VALUES ('021_v53_search_task_execution_center') ON CONFLICT(version) DO NOTHING;

COMMIT;
