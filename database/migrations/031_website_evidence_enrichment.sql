-- Connector-independent Website & Evidence Enrichment V1.0.
BEGIN;

ALTER TABLE search_results ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE search_results ADD COLUMN IF NOT EXISTS enrichment_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS lead_enrichment_jobs (
  id BIGSERIAL PRIMARY KEY,
  search_task_id BIGINT NOT NULL REFERENCES search_tasks(id) ON DELETE CASCADE,
  search_execution_id BIGINT REFERENCES search_executions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Running','Paused','Completed','Failed')),
  total_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  retry_failed BOOLEAN NOT NULL DEFAULT FALSE,
  checkpoint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  pause_requested_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  last_error TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_enrichment_records (
  id BIGSERIAL PRIMARY KEY,
  search_result_id BIGINT NOT NULL UNIQUE REFERENCES search_results(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Verified Website','Needs Review','No Reliable Website','Completed','Failed')),
  official_website TEXT,
  phone TEXT,
  public_emails_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_page_url TEXT,
  business_description TEXT,
  verification_score INTEGER NOT NULL DEFAULT 0,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_urls_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status_history_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_enrichment_jobs_task ON lead_enrichment_jobs(search_task_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_results_enrichment ON search_results(search_task_id,enrichment_status,id);
CREATE INDEX IF NOT EXISTS idx_lead_enrichment_records_status ON lead_enrichment_records(status,updated_at);

INSERT INTO schema_migrations(version) VALUES ('031_website_evidence_enrichment') ON CONFLICT(version) DO NOTHING;
COMMIT;
