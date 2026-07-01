-- Module 07 Part 1: Sales Intelligence workflow and frontend support.
BEGIN;

CREATE TABLE IF NOT EXISTS sales_inquiries (
  id BIGSERIAL PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company TEXT, country TEXT, inquiry_type TEXT NOT NULL CHECK (inquiry_type IN ('Product Inquiry','Restaurant Project','Freight Quote','Mixed Inquiry')),
  customer_message TEXT NOT NULL, attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low','Normal','High','Urgent')),
  sales_notes TEXT, status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New','Waiting Customer','Preparing Quote','Quoted','Negotiating','Won','Lost','Closed')),
  assigned_sales_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_inquiry_analyses (
  id BIGSERIAL PRIMARY KEY, inquiry_id BIGINT NOT NULL REFERENCES sales_inquiries(id) ON DELETE CASCADE,
  customer_intent TEXT NOT NULL, opportunity_size TEXT NOT NULL CHECK (opportunity_size IN ('Small','Medium','Large')),
  restaurant_type TEXT, estimated_budget TEXT, furniture_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_information JSONB NOT NULL DEFAULT '[]'::jsonb, suggested_next_question TEXT,
  recommended_package TEXT, notes TEXT, provider TEXT NOT NULL DEFAULT 'rules', created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_inquiry_products (
  inquiry_id BIGINT NOT NULL REFERENCES sales_inquiries(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT, match_reason TEXT, selected BOOLEAN NOT NULL DEFAULT FALSE,
  quantity INTEGER NOT NULL DEFAULT 1, proposed_unit_price NUMERIC(12,2), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(inquiry_id, product_id)
);
CREATE TABLE IF NOT EXISTS sales_quotes (
  id BIGSERIAL PRIMARY KEY, quote_number TEXT NOT NULL UNIQUE, inquiry_id BIGINT NOT NULL REFERENCES sales_inquiries(id) ON DELETE RESTRICT,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT, quote_type TEXT NOT NULL DEFAULT 'Quote', currency TEXT NOT NULL DEFAULT 'USD',
  destination TEXT, trade_term TEXT, status TEXT NOT NULL DEFAULT 'Draft', subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0, total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_quote_items (
  id BIGSERIAL PRIMARY KEY, quote_id BIGINT NOT NULL REFERENCES sales_quotes(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT, quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0, discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0, remark TEXT, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sales_orders (
  id BIGSERIAL PRIMARY KEY, order_number TEXT NOT NULL UNIQUE, inquiry_id BIGINT NOT NULL REFERENCES sales_inquiries(id) ON DELETE RESTRICT,
  quote_id BIGINT REFERENCES sales_quotes(id) ON DELETE SET NULL, customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'Confirmed', total NUMERIC(14,2) NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_tasks (
  id BIGSERIAL PRIMARY KEY, inquiry_id BIGINT NOT NULL REFERENCES sales_inquiries(id) ON DELETE CASCADE,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open',
  due_at TIMESTAMPTZ, assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS customer_sales_timeline (
  id BIGSERIAL PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  inquiry_id BIGINT REFERENCES sales_inquiries(id) ON DELETE CASCADE, event_type TEXT NOT NULL, description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_owner ON sales_inquiries(assigned_sales_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_inquiry ON sales_quotes(inquiry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_owner ON sales_tasks(assigned_to, status, due_at);
CREATE INDEX IF NOT EXISTS idx_customer_sales_timeline ON customer_sales_timeline(customer_id, created_at DESC);
INSERT INTO schema_migrations(version) VALUES ('007_sales_intelligence_part1') ON CONFLICT(version) DO NOTHING;
COMMIT;
