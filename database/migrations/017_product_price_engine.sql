-- Module08D: reference selling price engine and immutable quote pricing snapshots.
BEGIN;
CREATE TABLE IF NOT EXISTS product_price_rules (
  id BIGSERIAL PRIMARY KEY, rule_name TEXT NOT NULL, supplier_name TEXT, category_id BIGINT REFERENCES product_categories(id) ON DELETE SET NULL,
  multiplier NUMERIC(12,4) NOT NULL, fixed_addon NUMERIC(12,2) NOT NULL DEFAULT 0, minimum_margin NUMERIC(8,4),
  rounding_rule TEXT NOT NULL DEFAULT 'No rounding', currency TEXT NOT NULL DEFAULT 'USD', active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE, notes TEXT, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS supplier_currency TEXT;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14,6);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS converted_cost NUMERIC(12,2);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS pricing_rule_id BIGINT REFERENCES product_price_rules(id) ON DELETE SET NULL;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS pricing_status TEXT NOT NULL DEFAULT 'Needs Pricing Review';
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS pricing_confidence INTEGER;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS price_manual_override BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS price_override_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS price_override_at TIMESTAMPTZ;
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS pricing_source TEXT NOT NULL DEFAULT 'Reference';
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS reference_price_snapshot NUMERIC(12,2);
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS cost_snapshot NUMERIC(12,2);
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS cost_currency_snapshot TEXT;
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS final_selling_price_snapshot NUMERIC(12,2);
CREATE INDEX IF NOT EXISTS idx_price_rules_match ON product_price_rules(active,effective_date,supplier_name,category_id,currency);
INSERT INTO schema_migrations(version) VALUES ('017_product_price_engine') ON CONFLICT(version) DO NOTHING;
COMMIT;
