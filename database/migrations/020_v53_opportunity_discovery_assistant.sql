-- V5.3 Opportunity Intelligence V2: AI Customer Discovery Assistant MVP.
-- Additive migration only. Existing customers remain the source of truth.
BEGIN;

CREATE TABLE IF NOT EXISTS customer_type_profiles (
  id BIGSERIAL PRIMARY KEY,
  customer_type TEXT NOT NULL UNIQUE,
  industry TEXT NOT NULL DEFAULT 'Hospitality Furniture',
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_type_score_dimensions (
  id BIGSERIAL PRIMARY KEY,
  customer_type_profile_id BIGINT NOT NULL REFERENCES customer_type_profiles(id) ON DELETE CASCADE,
  dimension_name TEXT NOT NULL,
  weight_percent INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_discovery_requests (
  id BIGSERIAL PRIMARY KEY,
  raw_request TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  target_customer_type TEXT,
  industry TEXT,
  region TEXT,
  country TEXT,
  search_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  guidance JSONB NOT NULL DEFAULT '{}'::jsonb,
  scoring_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_execution_log_id BIGINT,
  cost_log_id BIGINT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_type_profiles_active ON customer_type_profiles(active, sort_order, customer_type);
CREATE INDEX IF NOT EXISTS idx_customer_type_score_dimensions_profile ON customer_type_score_dimensions(customer_type_profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_customer_discovery_requests_created ON customer_discovery_requests(created_at DESC);

INSERT INTO schema_migrations(version) VALUES ('020_v53_opportunity_discovery_assistant') ON CONFLICT(version) DO NOTHING;

COMMIT;
