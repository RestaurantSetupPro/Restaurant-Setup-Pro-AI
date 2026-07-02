-- Module 07 Part 2: Quote Builder and PI Builder (additive).
BEGIN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS specification TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cbm NUMERIC(12,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(12,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS net_weight_kg NUMERIC(12,3);
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS quote_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS salesperson_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS other_charges NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS deposit_percent NUMERIC(5,2) NOT NULL DEFAULT 30;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS balance_percent NUMERIC(5,2) NOT NULL DEFAULT 70;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'TT Bank Transfer';
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS payment_note TEXT DEFAULT '30% deposit, 70% balance before shipment.';
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS shipping_method TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS destination_port TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS destination_address TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(14,2);
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS transit_time TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS freight_remark TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS other_remark TEXT;
ALTER TABLE sales_quotes ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sales_quote_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS order_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS sales_quote_versions (
 id BIGSERIAL PRIMARY KEY, quote_id BIGINT NOT NULL REFERENCES sales_quotes(id) ON DELETE CASCADE,
 version_number INTEGER NOT NULL, snapshot JSONB NOT NULL, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(quote_id, version_number)
);
CREATE TABLE IF NOT EXISTS sales_order_items (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
 product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT, quantity INTEGER NOT NULL,
 unit_price NUMERIC(12,2) NOT NULL, discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0, remark TEXT, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sales_quote_versions ON sales_quote_versions(quote_id, version_number DESC);
INSERT INTO schema_migrations(version) VALUES ('008_quote_pi_builder') ON CONFLICT(version) DO NOTHING;
COMMIT;
