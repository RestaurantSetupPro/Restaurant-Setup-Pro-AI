-- V5.3 Phase 2A: AI Customer & Opportunity Intelligence MVP.
-- Additive migration only. Existing customers remain the source of truth.
BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_value_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_value_grade TEXT NOT NULL DEFAULT 'D';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_value_explanation TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS buying_opportunity_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS buying_opportunity_grade TEXT NOT NULL DEFAULT 'D';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS buying_opportunity_explanation TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS purchase_timing TEXT NOT NULL DEFAULT 'Unknown';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS purchase_timing_confidence TEXT NOT NULL DEFAULT 'Low';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sales_priority_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sales_priority_explanation TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS project_information TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_comments TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS expected_purchase_timing TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS opportunity_notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_customer_intelligence_run_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS customer_intelligence_profiles (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_type TEXT,
  industry TEXT NOT NULL DEFAULT 'Hospitality Furniture',
  customer_value_score INTEGER NOT NULL DEFAULT 0,
  customer_value_grade TEXT NOT NULL DEFAULT 'D',
  customer_value_explanation TEXT,
  buying_opportunity_score INTEGER NOT NULL DEFAULT 0,
  buying_opportunity_grade TEXT NOT NULL DEFAULT 'D',
  buying_opportunity_explanation TEXT,
  purchase_timing TEXT NOT NULL DEFAULT 'Unknown',
  purchase_timing_confidence TEXT NOT NULL DEFAULT 'Low',
  sales_priority_score INTEGER NOT NULL DEFAULT 0,
  sales_priority_explanation TEXT,
  ai_recommendation TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft',
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_intelligence_feedback (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL,
  feedback_note TEXT,
  sales_result_reference_type TEXT,
  sales_result_reference_id BIGINT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_score_history (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score_type TEXT NOT NULL,
  previous_score INTEGER,
  new_score INTEGER NOT NULL,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'rules',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_intelligence_profiles_customer ON customer_intelligence_profiles(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_profiles_priority ON customer_intelligence_profiles(sales_priority_score DESC, review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_feedback_customer ON customer_intelligence_feedback(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_score_history_customer ON customer_score_history(customer_id, score_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_phase2a_priority ON customers(sales_priority_score DESC, customer_value_score DESC, buying_opportunity_score DESC);

INSERT INTO schema_migrations(version) VALUES ('019_v53_phase2a_customer_intelligence_mvp') ON CONFLICT(version) DO NOTHING;

COMMIT;
