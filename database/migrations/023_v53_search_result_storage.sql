BEGIN;

CREATE TABLE IF NOT EXISTS search_results (
  id BIGSERIAL PRIMARY KEY,
  search_task_id BIGINT NOT NULL REFERENCES search_tasks(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  customer_type TEXT,
  industry TEXT NOT NULL DEFAULT 'Hospitality Furniture',
  country TEXT,
  city TEXT,
  website TEXT,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  linkedin TEXT,
  instagram TEXT,
  company_size TEXT,
  business_type TEXT,
  purchase_potential TEXT,
  opportunity_score INTEGER NOT NULL DEFAULT 0,
  qualification_reason TEXT,
  opportunity_summary TEXT,
  why_customer_matters TEXT,
  recommended_next_action TEXT,
  source_type TEXT NOT NULL DEFAULT 'Manual',
  source_reference TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_results_task_status
  ON search_results(search_task_id, status, opportunity_score DESC);

CREATE INDEX IF NOT EXISTS idx_search_results_company_country
  ON search_results(company_name, country);

CREATE INDEX IF NOT EXISTS idx_search_results_customer_id
  ON search_results(customer_id);

INSERT INTO schema_migrations (version)
VALUES ('023_v53_search_result_storage')
ON CONFLICT (version) DO NOTHING;

COMMIT;
