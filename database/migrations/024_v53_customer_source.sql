BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_source TEXT NOT NULL DEFAULT 'Manual Import';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS recommended_product_reason TEXT;

UPDATE customers
SET customer_source = 'Manual Import'
WHERE customer_source IS NULL OR customer_source = '';

UPDATE customers
SET customer_source = CASE source
  WHEN 'Google Maps' THEN 'Google Maps'
  WHEN 'Website' THEN 'Website'
  WHEN 'Instagram' THEN 'Instagram'
  WHEN 'Facebook' THEN 'Facebook'
  ELSE customer_source
END
WHERE customer_source = 'Manual Import'
  AND source IN ('Google Maps', 'Website', 'Instagram', 'Facebook');

UPDATE customers
SET customer_source = 'Google Maps'
WHERE customer_source = 'Manual Import'
  AND (
    NULLIF(TRIM(COALESCE(google_maps_url, '')), '') IS NOT NULL
    OR LOWER(COALESCE(source_url, '')) LIKE '%google%maps%'
    OR LOWER(COALESCE(source_url, '')) LIKE '%maps.app.goo.gl%'
    OR LOWER(COALESCE(source_url, '')) LIKE '%goo.gl/maps%'
    OR LOWER(COALESCE(source_url, '')) LIKE '%g.page%'
  );

CREATE INDEX IF NOT EXISTS idx_customers_customer_source
  ON customers(customer_source, opportunity_grade, sales_priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_customers_test_data
  ON customers(is_test_data, created_at DESC);

INSERT INTO schema_migrations (version)
VALUES ('024_v53_customer_source')
ON CONFLICT (version) DO NOTHING;

COMMIT;
