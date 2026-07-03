-- Alpha Test Issue 004: Global Proforma Invoice Template V1.
BEGIN;

ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS buyer_phone TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS buyer_email TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS buyer_reference_no TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS origin_port TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS total_packages INTEGER;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS production_time TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS special_terms TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS bank_account_id BIGINT;

CREATE TABLE IF NOT EXISTS organization_bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  account_name TEXT NOT NULL,
  beneficiary_name TEXT,
  bank_name TEXT,
  bank_address TEXT,
  account_number TEXT,
  swift_bic TEXT,
  routing_number TEXT,
  iban TEXT,
  bank_country TEXT,
  payment_currency TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO schema_migrations(version) VALUES ('010_global_pi_template') ON CONFLICT(version) DO NOTHING;
COMMIT;
