-- Module08B Part 1: spreadsheet import batches and human-reviewed product drafts.
BEGIN;
CREATE TABLE IF NOT EXISTS product_import_batches (
  id BIGSERIAL PRIMARY KEY, source_file_name TEXT NOT NULL, import_mode TEXT NOT NULL,
  supplier_name TEXT, supplier_contact TEXT, supplier_country TEXT, supplier_currency TEXT,
  exchange_rate NUMERIC(14,6), import_remark TEXT, default_category_id BIGINT REFERENCES product_categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Analyzing', detected_columns TEXT, analysis_summary TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0, draft_count INTEGER NOT NULL DEFAULT 0,
  created_products INTEGER NOT NULL DEFAULT 0, created_variants INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0, error_count INTEGER NOT NULL DEFAULT 0, error_message TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS product_import_drafts (
  id BIGSERIAL PRIMARY KEY, batch_id BIGINT NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending Review', product_name TEXT, product_sku TEXT, suggested_category_id BIGINT REFERENCES product_categories(id) ON DELETE SET NULL,
  mapped_product TEXT NOT NULL DEFAULT '{}', suggested_variants TEXT NOT NULL DEFAULT '[]', suggested_attributes TEXT NOT NULL DEFAULT '[]',
  suggested_tag_ids TEXT NOT NULL DEFAULT '[]', source_rows TEXT NOT NULL DEFAULT '[]', source_mapping TEXT NOT NULL DEFAULT '{}', original_values TEXT NOT NULL DEFAULT '{}',
  product_group_confidence INTEGER NOT NULL DEFAULT 0, variant_confidence INTEGER NOT NULL DEFAULT 0,
  attribute_mapping_confidence INTEGER NOT NULL DEFAULT 0, image_matching_confidence INTEGER NOT NULL DEFAULT 0,
  missing_fields TEXT NOT NULL DEFAULT '[]', image_status TEXT NOT NULL DEFAULT 'Image Assets Needed', main_image_url TEXT,
  possible_match_product_id BIGINT REFERENCES products(id) ON DELETE SET NULL, resolution_action TEXT,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL, approved_at TIMESTAMPTZ,
  imported_product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS product_import_assets (
  id BIGSERIAL PRIMARY KEY, batch_id BIGINT NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  draft_id BIGINT REFERENCES product_import_drafts(id) ON DELETE CASCADE, source_sheet_name TEXT,
  source_row_number INTEGER, file_name TEXT NOT NULL, file_url TEXT NOT NULL, media_type TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_import_drafts_batch_status ON product_import_drafts(batch_id,status,id);
INSERT INTO schema_migrations(version) VALUES ('015_ai_product_import') ON CONFLICT(version) DO NOTHING;
COMMIT;
