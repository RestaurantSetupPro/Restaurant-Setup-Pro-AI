-- Module 07 acceptance adjustment: custom PI line items (additive).
BEGIN;
CREATE TABLE IF NOT EXISTS sales_quote_custom_items (
 id BIGSERIAL PRIMARY KEY, quote_id BIGINT NOT NULL REFERENCES sales_quotes(id) ON DELETE CASCADE,
 reference_image_url TEXT, item_name TEXT NOT NULL, category TEXT, specification TEXT, material TEXT,
 color_finish TEXT, size_dimensions TEXT, quantity INTEGER NOT NULL DEFAULT 1,
 unit_price NUMERIC(12,2) NOT NULL DEFAULT 0, discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
 cbm NUMERIC(12,4), gross_weight_kg NUMERIC(12,3), net_weight_kg NUMERIC(12,3), remark TEXT,
 sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_order_custom_items (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
 source_quote_custom_item_id BIGINT, item_snapshot JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_quote_custom_items ON sales_quote_custom_items(quote_id,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_sales_order_custom_items ON sales_order_custom_items(order_id,id);
INSERT INTO schema_migrations(version) VALUES ('009_custom_quote_items') ON CONFLICT(version) DO NOTHING;
COMMIT;
