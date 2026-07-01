-- Restaurant Setup Pro AI Platform
-- Migration 005: Opportunity Intelligence Engine (additive and non-destructive).

BEGIN;

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  brand_name TEXT,
  business_type TEXT,
  country TEXT,
  city TEXT,
  address TEXT,
  website TEXT,
  google_maps_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,
  tiktok_url TEXT,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  store_count INTEGER,
  opening_year INTEGER,
  years_in_business INTEGER,
  source TEXT NOT NULL,
  source_url TEXT,
  source_confidence NUMERIC(5,2) NOT NULL DEFAULT 50,
  data_quality_score INTEGER NOT NULL DEFAULT 0,
  opportunity_score INTEGER NOT NULL DEFAULT 0,
  opportunity_grade TEXT NOT NULL DEFAULT 'D' CHECK (opportunity_grade IN ('A+', 'A', 'B', 'C', 'D')),
  opportunity_status TEXT NOT NULL DEFAULT 'Imported' CHECK (opportunity_status IN ('Imported', 'Cleaned', 'Enriched', 'Scored', 'Recommended', 'Ready for Sales', 'Contacted', 'In Progress', 'Replied', 'Qualified', 'Proposal Needed', 'Won', 'Lost', 'Nurture')),
  expansion_probability INTEGER NOT NULL DEFAULT 0,
  renovation_probability INTEGER NOT NULL DEFAULT 0,
  furniture_need_probability INTEGER NOT NULL DEFAULT 0,
  budget_estimate TEXT,
  style_signal TEXT,
  ai_summary TEXT,
  ai_recommendation TEXT,
  next_action TEXT,
  next_action_date DATE,
  assigned_sales_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_ai_run_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_contacts (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Founder', 'Co-Founder', 'Purchasing', 'Operations', 'Manager', 'Designer', 'Other')),
  email TEXT, phone TEXT, whatsapp TEXT, linkedin_url TEXT, facebook_url TEXT, instagram_url TEXT,
  source TEXT NOT NULL DEFAULT 'Manual', source_url TEXT, confidence_score NUMERIC(5,2) NOT NULL DEFAULT 50,
  is_primary_decision_maker BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_data_gaps (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  gap_type TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Filled', 'Ignored')),
  notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, gap_type)
);

CREATE TABLE IF NOT EXISTS customer_ai_analysis_runs (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('Cleaning', 'Enrichment', 'Scoring', 'Recommendation', 'Outreach Draft', 'Full Run')),
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, output_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  engine_version TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'rules',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customer_product_recommendations (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES product_categories(id) ON DELETE CASCADE,
  recommendation_reason TEXT NOT NULL,
  sales_angle TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, product_id), UNIQUE(customer_id, category_id)
);

CREATE TABLE IF NOT EXISTS customer_outreach_drafts (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES customer_contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('Email', 'WhatsApp', 'LinkedIn', 'Facebook')),
  draft_type TEXT NOT NULL CHECK (draft_type IN ('First Touch', 'Follow Up 1', 'Follow Up 2', 'Reply Response')),
  subject TEXT, body TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'English', personalization_summary TEXT,
  recommended_products_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Ready', 'Approved', 'Sent Manually', 'Archived')),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_activity_log (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_queue ON customers(opportunity_grade, opportunity_score DESC, next_action_date);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(opportunity_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source, source_url);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id, is_primary_decision_maker);
CREATE INDEX IF NOT EXISTS idx_customer_gaps_open ON customer_data_gaps(customer_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_customer_ai_runs_customer ON customer_ai_analysis_runs(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_recommendations ON customer_product_recommendations(customer_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_customer_outreach_status ON customer_outreach_drafts(customer_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activity ON customer_activity_log(customer_id, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('005_opportunity_intelligence_engine') ON CONFLICT (version) DO NOTHING;

COMMIT;
