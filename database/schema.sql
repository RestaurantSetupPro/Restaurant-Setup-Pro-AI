PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Owner', 'Sales', 'Designer', 'VA')),
  initials TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
  sub_category TEXT,
  product_series TEXT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT,
  materials TEXT,
  size TEXT,
  color TEXT,
  finish TEXT,
  price_range TEXT,
  lead_time_days INTEGER,
  moq INTEGER,
  tags TEXT,
  budget_level TEXT,
  recommended_usage TEXT,
  sales_notes TEXT,
  common_questions TEXT,
  common_objections TEXT,
  proposal_ready_status TEXT NOT NULL DEFAULT 'Needs Review',
  english_description TEXT,
  short_sales_description TEXT,
  proposal_usage_notes TEXT,
  sales_talking_points TEXT,
  ai_summary TEXT,
  ai_recommendation_weight INTEGER NOT NULL DEFAULT 50 CHECK (ai_recommendation_weight BETWEEN 0 AND 100),
  ai_notes TEXT,
  internal_notes TEXT,
  knowledge_prompt TEXT,
  seo_title TEXT,
  seo_description TEXT,
  meta_keywords TEXT,
  slug TEXT,
  canonical_url TEXT,
  image_alt TEXT,
  image_caption TEXT,
  product_keywords TEXT,
  llm_summary TEXT,
  use_cases TEXT,
  best_for TEXT,
  not_recommended_for TEXT,
  comparison TEXT,
  advantages TEXT,
  disadvantages TEXT,
  faq TEXT,
  buying_guide TEXT,
  installation_guide TEXT,
  maintenance_guide TEXT,
  common_problems TEXT,
  suggested_prompt TEXT,
  library_status TEXT NOT NULL DEFAULT 'Active',
  visibility TEXT NOT NULL DEFAULT 'Website + Quote',
  short_description TEXT,
  website_description TEXT,
  quote_description TEXT,
  website_price_display TEXT NOT NULL DEFAULT 'Request Quote',
  default_supplier TEXT,
  supplier_sku TEXT,
  supplier_cost REAL,
  supplier_lead_time_days INTEGER,
  supplier_moq REAL,
  supplier_notes TEXT,
  source_supplier TEXT, source_file TEXT, source_sheet TEXT, source_row INTEGER,
  import_batch_id INTEGER REFERENCES product_import_batches(id) ON DELETE SET NULL,
  imported_at TEXT, imported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  supplier_currency TEXT, exchange_rate REAL, converted_cost REAL,
  pricing_rule_id INTEGER REFERENCES product_price_rules(id) ON DELETE SET NULL,
  pricing_status TEXT NOT NULL DEFAULT 'Needs Pricing Review', pricing_confidence INTEGER,
  price_manual_override INTEGER NOT NULL DEFAULT 0, price_override_by INTEGER REFERENCES users(id), price_override_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  document_type TEXT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'spreadsheet',
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('queued', 'validating', 'completed', 'failed')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT,
  style TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'failed')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  market TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'internal_review', 'sent', 'won', 'lost')),
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  valid_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proposal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  location TEXT,
  venue_type TEXT,
  summary TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  project_name TEXT NOT NULL,
  market TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('New Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost')),
  probability INTEGER NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  estimated_value INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  next_action TEXT,
  next_action_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opportunity_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  channel TEXT NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'draft', 'review', 'approved', 'published')),
  body TEXT,
  scheduled_at TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Module 02: shared foundation data. Records are retired with active = 0;
-- downstream modules can safely retain their references and historical labels.
CREATE TABLE IF NOT EXISTS system_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_type TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  code TEXT NOT NULL COLLATE NOCASE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (config_type, code)
);

CREATE TABLE IF NOT EXISTS system_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  tag_type TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_tag_links (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES system_tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT,
  storage_provider TEXT,
  related_module TEXT,
  related_record_id TEXT,
  media_category TEXT NOT NULL,
  is_verified INTEGER NOT NULL DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_ai_generated INTEGER NOT NULL DEFAULT 0 CHECK (is_ai_generated IN (0, 1)),
  image_type TEXT NOT NULL DEFAULT 'Detail Image',
  image_status TEXT NOT NULL DEFAULT 'Uploaded',
  generated_source TEXT,
  usage_note TEXT,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  document_type TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_name TEXT NOT NULL,
  prompt_type TEXT NOT NULL,
  prompt_content TEXT NOT NULL,
  variables TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Module 04: normalized Product Knowledge Engine relationships.
CREATE TABLE IF NOT EXISTS product_knowledge_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_type TEXT NOT NULL CHECK (term_type IN ('store_type', 'style', 'feature', 'customer_type')),
  name TEXT NOT NULL COLLATE NOCASE,
  code TEXT NOT NULL COLLATE NOCASE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (term_type, name),
  UNIQUE (term_type, code)
);

CREATE TABLE IF NOT EXISTS product_knowledge_links (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  term_id INTEGER NOT NULL REFERENCES product_knowledge_terms(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, term_id)
);

CREATE TABLE IF NOT EXISTS product_relationships (
  source_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'recommended' CHECK (relationship_type IN ('recommended', 'ai_related')),
  recommendation_weight INTEGER NOT NULL DEFAULT 50 CHECK (recommendation_weight BETWEEN 0 AND 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_product_id, target_product_id, relationship_type),
  CHECK (source_product_id <> target_product_id)
);

CREATE TABLE IF NOT EXISTS product_case_links (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  case_id INTEGER NOT NULL REFERENCES project_cases(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, case_id)
);

CREATE TABLE IF NOT EXISTS product_media_links (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, media_id)
);

CREATE TABLE IF NOT EXISTS product_related_category_links (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE IF NOT EXISTS product_keywords (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  keyword_type TEXT NOT NULL CHECK (keyword_type IN ('ai', 'search')),
  keyword TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, keyword_type, keyword)
);

-- Module 05.1: reviewable AI Product Content Factory outputs.
CREATE TABLE IF NOT EXISTS ai_product_content_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  generation_mode TEXT NOT NULL CHECK (generation_mode IN ('fast', 'standard', 'premium')),
  generated_product_name TEXT,
  generated_category TEXT,
  generated_sub_category TEXT,
  generated_material TEXT,
  generated_color TEXT,
  generated_style TEXT NOT NULL DEFAULT '[]',
  generated_store_types TEXT NOT NULL DEFAULT '[]',
  generated_description_en TEXT,
  generated_description_zh TEXT,
  generated_short_sales_description TEXT,
  generated_seo_title TEXT,
  generated_seo_description TEXT,
  generated_meta_keywords TEXT,
  generated_llm_summary TEXT,
  generated_faq TEXT,
  generated_buying_guide TEXT,
  generated_sales_talking_points TEXT,
  generated_proposal_notes TEXT,
  generated_ai_tags TEXT NOT NULL DEFAULT '[]',
  analysis_summary TEXT,
  cost_estimate REAL NOT NULL DEFAULT 0.01,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'applied')),
  reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_image_generation_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  source_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  image_type TEXT NOT NULL,
  scene_type TEXT,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  generation_mode TEXT NOT NULL CHECK (generation_mode IN ('fast', 'standard', 'premium')),
  provider TEXT NOT NULL DEFAULT 'reserved',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'generated', 'approved', 'rejected', 'failed')),
  lifecycle_status TEXT NOT NULL DEFAULT 'pending' CHECK (lifecycle_status IN ('draft', 'pending', 'running', 'generated', 'pending_review', 'approved', 'rejected', 'failed', 'applied')),
  output_media_id INTEGER REFERENCES media_assets(id) ON DELETE SET NULL,
  cost_estimate REAL NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  provider_request_id TEXT,
  output_url TEXT,
  output_width INTEGER,
  output_height INTEGER,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  ai_confidence REAL,
  reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TEXT,
  applied_at TEXT,
  status_history TEXT NOT NULL DEFAULT '[]',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT, source_file_name TEXT NOT NULL, import_mode TEXT NOT NULL,
  supplier_name TEXT, supplier_code TEXT, supplier_contact TEXT, supplier_country TEXT, supplier_currency TEXT, exchange_rate REAL,
  import_remark TEXT, default_category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Analyzing', detected_columns TEXT, analysis_summary TEXT, total_rows INTEGER NOT NULL DEFAULT 0,
  draft_count INTEGER NOT NULL DEFAULT 0, created_products INTEGER NOT NULL DEFAULT 0, created_variants INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0, error_count INTEGER NOT NULL DEFAULT 0, error_message TEXT,
  started_at TEXT, completed_at TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS product_import_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending Review', product_name TEXT, product_sku TEXT,
  suggested_category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL, mapped_product TEXT NOT NULL DEFAULT '{}',
  suggested_variants TEXT NOT NULL DEFAULT '[]', suggested_attributes TEXT NOT NULL DEFAULT '[]', suggested_tag_ids TEXT NOT NULL DEFAULT '[]',
  source_rows TEXT NOT NULL DEFAULT '[]', source_mapping TEXT NOT NULL DEFAULT '{}', original_values TEXT NOT NULL DEFAULT '{}',
  product_group_confidence INTEGER NOT NULL DEFAULT 0, variant_confidence INTEGER NOT NULL DEFAULT 0,
  attribute_mapping_confidence INTEGER NOT NULL DEFAULT 0, image_matching_confidence INTEGER NOT NULL DEFAULT 0,
  missing_fields TEXT NOT NULL DEFAULT '[]', image_status TEXT NOT NULL DEFAULT 'Image Assets Needed', main_image_url TEXT,
  possible_match_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, resolution_action TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_at TEXT, imported_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS product_import_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  draft_id INTEGER REFERENCES product_import_drafts(id) ON DELETE CASCADE, source_sheet_name TEXT, source_row_number INTEGER,
  file_name TEXT NOT NULL, file_url TEXT NOT NULL, media_type TEXT NOT NULL DEFAULT 'image', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS product_import_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT, batch_id INTEGER NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
  source_sheet TEXT, source_row INTEGER, product_name TEXT, reason TEXT NOT NULL, suggested_fix TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_price_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT, rule_name TEXT NOT NULL, supplier_name TEXT, category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
  multiplier REAL NOT NULL, fixed_addon REAL NOT NULL DEFAULT 0, minimum_margin REAL, rounding_rule TEXT NOT NULL DEFAULT 'No rounding',
  currency TEXT NOT NULL DEFAULT 'USD', active INTEGER NOT NULL DEFAULT 1, effective_date TEXT NOT NULL DEFAULT CURRENT_DATE, notes TEXT,
  created_by INTEGER REFERENCES users(id), updated_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL, variant_sku TEXT UNIQUE, dimensions TEXT, reference_price REAL, cost_price REAL,
  material TEXT, finish TEXT, color TEXT, moq REAL, lead_time_days INTEGER, cbm REAL,
  gross_weight_kg REAL, net_weight_kg REAL, packing_info TEXT,
  default_supplier TEXT, supplier_sku TEXT, supplier_cost REAL, supplier_lead_time_days INTEGER,
  supplier_moq REAL, supplier_notes TEXT,
  source_supplier TEXT, source_file TEXT, source_sheet TEXT, source_row INTEGER,
  import_batch_id INTEGER REFERENCES product_import_batches(id) ON DELETE SET NULL,
  imported_at TEXT, imported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Active', sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant_name)
);

CREATE TABLE IF NOT EXISTS product_attribute_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, data_type TEXT NOT NULL DEFAULT 'Text', unit TEXT,
  active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0,
  show_in_library INTEGER NOT NULL DEFAULT 1, show_on_website INTEGER NOT NULL DEFAULT 0,
  show_in_quote INTEGER NOT NULL DEFAULT 0, show_in_pi INTEGER NOT NULL DEFAULT 0, internal_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_attribute_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_id INTEGER NOT NULL REFERENCES product_attribute_definitions(id) ON DELETE CASCADE, value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS product_attribute_category_links (
  attribute_id INTEGER NOT NULL REFERENCES product_attribute_definitions(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(attribute_id,category_id)
);

CREATE TABLE IF NOT EXISTS product_attribute_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT, attribute_id INTEGER NOT NULL REFERENCES product_attribute_definitions(id) ON DELETE CASCADE,
  option_value TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attribute_id,option_value)
);

CREATE TABLE IF NOT EXISTS product_foundation_relationships (
  source_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(source_product_id,target_product_id,relationship_type), CHECK(source_product_id<>target_product_id)
);

CREATE TABLE IF NOT EXISTS organization_bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, account_name TEXT NOT NULL, beneficiary_name TEXT, bank_name TEXT,
  bank_address TEXT, account_number TEXT, swift_bic TEXT, routing_number TEXT, iban TEXT, bank_country TEXT,
  payment_currency TEXT, active INTEGER NOT NULL DEFAULT 1, is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL, brand_name TEXT, business_type TEXT, country TEXT, city TEXT, address TEXT,
  website TEXT, google_maps_url TEXT, facebook_url TEXT, instagram_url TEXT, linkedin_url TEXT, tiktok_url TEXT,
  phone TEXT, email TEXT, whatsapp TEXT, store_count INTEGER, opening_year INTEGER, years_in_business INTEGER,
  source TEXT NOT NULL, source_url TEXT, source_confidence REAL NOT NULL DEFAULT 50,
  data_quality_score INTEGER NOT NULL DEFAULT 0, opportunity_score INTEGER NOT NULL DEFAULT 0,
  opportunity_grade TEXT NOT NULL DEFAULT 'D' CHECK (opportunity_grade IN ('A+', 'A', 'B', 'C', 'D')),
  opportunity_status TEXT NOT NULL DEFAULT 'Imported', expansion_probability INTEGER NOT NULL DEFAULT 0,
  renovation_probability INTEGER NOT NULL DEFAULT 0, furniture_need_probability INTEGER NOT NULL DEFAULT 0,
  budget_estimate TEXT, style_signal TEXT, ai_summary TEXT, ai_recommendation TEXT, next_action TEXT, next_action_date TEXT,
  assigned_sales_id INTEGER REFERENCES users(id) ON DELETE SET NULL, confidence_score REAL NOT NULL DEFAULT 0,
  last_ai_run_at TEXT,
  customer_type TEXT, industry TEXT,
  customer_value_score INTEGER NOT NULL DEFAULT 0, customer_value_grade TEXT NOT NULL DEFAULT 'D',
  customer_value_explanation TEXT, buying_opportunity_score INTEGER NOT NULL DEFAULT 0,
  buying_opportunity_grade TEXT NOT NULL DEFAULT 'D', buying_opportunity_explanation TEXT,
  purchase_timing TEXT NOT NULL DEFAULT 'Unknown', purchase_timing_confidence TEXT NOT NULL DEFAULT 'Low',
  sales_priority_score INTEGER NOT NULL DEFAULT 0, sales_priority_explanation TEXT,
  project_information TEXT, customer_comments TEXT, expected_purchase_timing TEXT, opportunity_notes TEXT,
  customer_source TEXT NOT NULL DEFAULT 'Manual Import', is_test_data INTEGER NOT NULL DEFAULT 0,
  recommended_product_reason TEXT,
  last_customer_intelligence_run_at TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, role TEXT NOT NULL, email TEXT, phone TEXT, whatsapp TEXT, linkedin_url TEXT, facebook_url TEXT,
  instagram_url TEXT, source TEXT NOT NULL DEFAULT 'Manual', source_url TEXT, confidence_score REAL NOT NULL DEFAULT 50,
  is_primary_decision_maker INTEGER NOT NULL DEFAULT 0, notes TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_data_gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  gap_type TEXT NOT NULL, priority TEXT NOT NULL, assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Open', notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(customer_id, gap_type)
);

CREATE TABLE IF NOT EXISTS customer_ai_analysis_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL, input_snapshot TEXT NOT NULL DEFAULT '{}', output_snapshot TEXT NOT NULL DEFAULT '{}',
  engine_version TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'rules', status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
);

CREATE TABLE IF NOT EXISTS customer_product_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, category_id INTEGER REFERENCES product_categories(id) ON DELETE CASCADE,
  recommendation_reason TEXT NOT NULL, sales_angle TEXT, score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(customer_id, product_id), UNIQUE(customer_id, category_id)
);

CREATE TABLE IF NOT EXISTS customer_outreach_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES customer_contacts(id) ON DELETE SET NULL, channel TEXT NOT NULL, draft_type TEXT NOT NULL,
  subject TEXT, body TEXT NOT NULL, language TEXT NOT NULL DEFAULT 'English', personalization_summary TEXT,
  recommended_products_snapshot TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'Draft',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, description TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_intelligence_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_type TEXT, industry TEXT NOT NULL DEFAULT 'Hospitality Furniture',
  customer_value_score INTEGER NOT NULL DEFAULT 0, customer_value_grade TEXT NOT NULL DEFAULT 'D',
  customer_value_explanation TEXT, buying_opportunity_score INTEGER NOT NULL DEFAULT 0,
  buying_opportunity_grade TEXT NOT NULL DEFAULT 'D', buying_opportunity_explanation TEXT,
  purchase_timing TEXT NOT NULL DEFAULT 'Unknown', purchase_timing_confidence TEXT NOT NULL DEFAULT 'Low',
  sales_priority_score INTEGER NOT NULL DEFAULT 0, sales_priority_explanation TEXT, ai_recommendation TEXT,
  review_status TEXT NOT NULL DEFAULT 'draft', input_snapshot TEXT NOT NULL DEFAULT '{}', output_snapshot TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_intelligence_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL, feedback_note TEXT, sales_result_reference_type TEXT, sales_result_reference_id INTEGER,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_score_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score_type TEXT NOT NULL, previous_score INTEGER, new_score INTEGER NOT NULL, reason TEXT,
  source TEXT NOT NULL DEFAULT 'rules', created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_type_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_type TEXT NOT NULL UNIQUE,
  industry TEXT NOT NULL DEFAULT 'Hospitality Furniture', description TEXT,
  active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_type_score_dimensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_type_profile_id INTEGER NOT NULL REFERENCES customer_type_profiles(id) ON DELETE CASCADE,
  dimension_name TEXT NOT NULL, weight_percent INTEGER NOT NULL DEFAULT 0, description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_discovery_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, raw_request TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned',
  target_customer_type TEXT, industry TEXT, region TEXT, country TEXT,
  search_plan TEXT NOT NULL DEFAULT '{}', guidance TEXT NOT NULL DEFAULT '{}', scoring_profile TEXT NOT NULL DEFAULT '{}',
  ai_execution_log_id INTEGER, cost_log_id INTEGER, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_discovery_request_id INTEGER REFERENCES customer_discovery_requests(id) ON DELETE SET NULL,
  task_name TEXT NOT NULL, target_customer TEXT, customer_type TEXT, industry TEXT, location TEXT, company_size TEXT,
  search_objective TEXT, keywords TEXT NOT NULL DEFAULT '[]', filters TEXT NOT NULL DEFAULT '[]',
  target_quantity INTEGER NOT NULL DEFAULT 0, priority TEXT NOT NULL DEFAULT 'Medium',
  required_data_fields TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'Draft',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_intelligence_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  update_reason TEXT NOT NULL, original_input TEXT NOT NULL, reference_note TEXT, ai_summary TEXT NOT NULL,
  latest_customer_situation TEXT, important_changes TEXT, opportunity_impact TEXT, recommended_next_action TEXT,
  ai_execution_log_id INTEGER REFERENCES ai_execution_logs(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT, search_task_id INTEGER NOT NULL REFERENCES search_tasks(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL, company_name TEXT NOT NULL,
  customer_type TEXT, industry TEXT NOT NULL DEFAULT 'Hospitality Furniture', country TEXT, city TEXT, website TEXT,
  contact_person TEXT, email TEXT, phone TEXT, linkedin TEXT, instagram TEXT, company_size TEXT, business_type TEXT,
  purchase_potential TEXT, opportunity_score INTEGER NOT NULL DEFAULT 0, qualification_reason TEXT,
  opportunity_summary TEXT, why_customer_matters TEXT, recommended_next_action TEXT,
  source_type TEXT NOT NULL DEFAULT 'Manual', source_reference TEXT, status TEXT NOT NULL DEFAULT 'new',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  search_execution_id INTEGER REFERENCES search_executions(id) ON DELETE SET NULL,
  connector_key TEXT, connector_version TEXT, external_id TEXT, canonical_website TEXT, address TEXT, source_category TEXT,
  captured_at TEXT, raw_payload_id INTEGER REFERENCES search_result_raw_payloads(id) ON DELETE SET NULL,
  normalization_version TEXT, dedup_key TEXT,
  duplicate_of_search_result_id INTEGER REFERENCES search_results(id) ON DELETE SET NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, idempotency_key TEXT NOT NULL UNIQUE,
  search_task_id INTEGER NOT NULL REFERENCES search_tasks(id) ON DELETE CASCADE,
  search_strategy_id INTEGER NOT NULL REFERENCES search_strategies(id) ON DELETE RESTRICT,
  connector_key TEXT NOT NULL, connector_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Awaiting Approval','Approved','Running','Paused','Completed','Partially Completed','Failed','Cancelled','Interrupted')),
  phase TEXT CHECK (phase IS NULL OR phase IN ('Estimating','Fetching','Normalizing','Deduplicating','Persisting','Finalizing','Complete','Partial Complete','Failed','Cancelled','Paused')),
  request_snapshot_json TEXT NOT NULL DEFAULT '{}', limits_json TEXT NOT NULL DEFAULT '{}', estimate_json TEXT NOT NULL DEFAULT '{}',
  estimated_cost_usd REAL NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  approved_cost_limit_usd REAL CHECK (approved_cost_limit_usd IS NULL OR approved_cost_limit_usd >= 0),
  actual_cost_usd REAL NOT NULL DEFAULT 0 CHECK (actual_cost_usd >= 0),
  approval_status TEXT NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Pending','Approved','Rejected','Invalidated')),
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_at TEXT,
  checkpoint_json TEXT NOT NULL DEFAULT '{}', provider_request_count INTEGER NOT NULL DEFAULT 0,
  page_count INTEGER NOT NULL DEFAULT 0, received_count INTEGER NOT NULL DEFAULT 0,
  normalized_count INTEGER NOT NULL DEFAULT 0, inserted_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0, retry_count INTEGER NOT NULL DEFAULT 0,
  stop_requested_at TEXT, stop_reason TEXT, last_error_code TEXT, last_error_message TEXT,
  started_at TEXT, heartbeat_at TEXT, completed_at TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_result_raw_payloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_execution_id INTEGER NOT NULL REFERENCES search_executions(id) ON DELETE CASCADE,
  connector_key TEXT NOT NULL, connector_version TEXT NOT NULL, provider_request_id TEXT, external_id TEXT,
  record_index INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL DEFAULT '{}', payload_hash TEXT NOT NULL,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, retention_until TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(search_execution_id,payload_hash)
);

CREATE TABLE IF NOT EXISTS ai_cost_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  daily_budget_usd REAL NOT NULL DEFAULT 2, monthly_budget_usd REAL NOT NULL DEFAULT 50,
  text_budget_usd REAL NOT NULL DEFAULT 20, image_budget_usd REAL NOT NULL DEFAULT 30,
  default_provider TEXT NOT NULL DEFAULT 'mock', allow_paid_provider INTEGER NOT NULL DEFAULT 0,
  require_confirmation_over_usd REAL NOT NULL DEFAULT 0.01, cache_ttl_days INTEGER NOT NULL DEFAULT 7,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_cost_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, module_name TEXT NOT NULL, action_name TEXT NOT NULL,
  entity_type TEXT, entity_id TEXT, provider TEXT NOT NULL, model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, image_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0, actual_cost_usd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('estimated', 'confirmed', 'executed', 'blocked', 'failed', 'cached')),
  blocked_reason TEXT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_cache_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT, module_name TEXT NOT NULL, action_name TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, cache_key TEXT NOT NULL UNIQUE,
  cache_value TEXT NOT NULL DEFAULT '{}', expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  module_name TEXT NOT NULL,
  action_name TEXT NOT NULL,
  variables TEXT NOT NULL DEFAULT '[]',
  output_format TEXT NOT NULL DEFAULT 'json',
  template_text TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(prompt_key, version)
);

CREATE TABLE IF NOT EXISTS ai_context_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  redaction_level TEXT NOT NULL DEFAULT 'internal',
  context_hash TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  source_references TEXT NOT NULL DEFAULT '[]',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_name TEXT NOT NULL,
  action_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'mock',
  model TEXT,
  prompt_template_key TEXT,
  prompt_version INTEGER,
  context_snapshot_id INTEGER REFERENCES ai_context_snapshots(id) ON DELETE SET NULL,
  input_hash TEXT,
  output_snapshot TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'blocked', 'cached')),
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  actual_cost_usd REAL NOT NULL DEFAULT 0,
  cost_log_id INTEGER REFERENCES ai_cost_logs(id) ON DELETE SET NULL,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  knowledge_key TEXT NOT NULL CHECK (LENGTH(TRIM(knowledge_key)) > 0),
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('company', 'target_customer_profile')),
  title TEXT NOT NULL, summary TEXT,
  content_json TEXT NOT NULL DEFAULT '{}', tags_json TEXT NOT NULL DEFAULT '[]',
  revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1),
  supersedes_id INTEGER REFERENCES knowledge_items(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Needs Review', 'Outdated', 'Archived')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL, submitted_at TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_at TEXT,
  review_note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (knowledge_key, revision_no)
);

CREATE TABLE IF NOT EXISTS search_strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_key TEXT NOT NULL CHECK (LENGTH(TRIM(strategy_key)) > 0), revision_no INTEGER NOT NULL DEFAULT 1 CHECK (revision_no >= 1),
  supersedes_id INTEGER REFERENCES search_strategies(id) ON DELETE SET NULL,
  customer_discovery_request_id INTEGER REFERENCES customer_discovery_requests(id) ON DELETE SET NULL,
  linked_search_task_id INTEGER REFERENCES search_tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '', strategy_data_json TEXT NOT NULL DEFAULT '{}',
  knowledge_references_json TEXT NOT NULL DEFAULT '[]', evidence_references_json TEXT NOT NULL DEFAULT '[]', generation_metadata_json TEXT NOT NULL DEFAULT '{}',
  ai_cost_estimate REAL NOT NULL DEFAULT 0 CHECK (ai_cost_estimate >= 0), search_cost_estimate REAL NOT NULL DEFAULT 0 CHECK (search_cost_estimate >= 0),
  total_budget_limit REAL CHECK (total_budget_limit IS NULL OR total_budget_limit >= 0),
  context_snapshot_id INTEGER REFERENCES ai_context_snapshots(id) ON DELETE SET NULL,
  ai_execution_log_id INTEGER REFERENCES ai_execution_logs(id) ON DELETE SET NULL, ai_cost_log_id INTEGER REFERENCES ai_cost_logs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Needs Review','Approved','Superseded','Archived')),
  review_note TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL, submitted_at TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL, approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(strategy_key, revision_no)
);

INSERT INTO ai_cost_settings
  (daily_budget_usd, monthly_budget_usd, text_budget_usd, image_budget_usd, default_provider,
   allow_paid_provider, require_confirmation_over_usd, cache_ttl_days)
SELECT 2, 50, 20, 30, 'mock', 0, 0.01, 7
WHERE NOT EXISTS (SELECT 1 FROM ai_cost_settings);

INSERT INTO ai_prompt_templates(prompt_key, version, module_name, action_name, variables, output_format, template_text, active)
SELECT 'v53.foundation.mock.v1', 1, 'ai-business-brain', 'foundation-check', '["context_type","entity_type","entity_id"]', 'json',
       'Return a structured internal AI foundation response using only the provided business context. Do not modify source-of-truth business records.', 1
WHERE NOT EXISTS (SELECT 1 FROM ai_prompt_templates WHERE prompt_key = 'v53.foundation.mock.v1' AND version = 1);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_owner_id ON opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_proposals_owner_id ON proposals(owner_id);
CREATE INDEX IF NOT EXISTS idx_content_assets_owner_id ON content_assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_system_configs_type ON system_configs(config_type);
CREATE INDEX IF NOT EXISTS idx_system_configs_code ON system_configs(code);
CREATE INDEX IF NOT EXISTS idx_system_tags_type ON system_tags(tag_type);
CREATE INDEX IF NOT EXISTS idx_system_tags_code ON system_tags(code);
CREATE INDEX IF NOT EXISTS idx_product_tag_links_tag ON product_tag_links(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_nocase ON products(sku COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_media_assets_related_module ON media_assets(related_module);
CREATE INDEX IF NOT EXISTS idx_media_assets_related_record ON media_assets(related_record_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_type ON ai_prompts(prompt_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_terms_type_name ON product_knowledge_terms(term_type, name);
CREATE INDEX IF NOT EXISTS idx_knowledge_links_term ON product_knowledge_links(term_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_relationships_target ON product_relationships(target_product_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_product_case_links_case ON product_case_links(case_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_links_media ON product_media_links(media_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_related_categories_category ON product_related_category_links(category_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_keywords_lookup ON product_keywords(keyword_type, keyword, product_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_drafts_product_status ON ai_product_content_drafts(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_content_drafts_review ON ai_product_content_drafts(status, reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ai_image_tasks_product_status ON ai_image_generation_tasks(product_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_image_tasks_provider_status ON ai_image_generation_tasks(provider, status);
CREATE INDEX IF NOT EXISTS idx_products_materials ON products(materials);
CREATE INDEX IF NOT EXISTS idx_customers_queue ON customers(opportunity_grade, opportunity_score DESC, next_action_date);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(opportunity_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer ON customer_contacts(customer_id, is_primary_decision_maker);
CREATE INDEX IF NOT EXISTS idx_customer_gaps_open ON customer_data_gaps(customer_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_customer_ai_runs_customer ON customer_ai_analysis_runs(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_recommendations ON customer_product_recommendations(customer_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_customer_outreach_status ON customer_outreach_drafts(customer_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activity ON customer_activity_log(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_profiles_customer ON customer_intelligence_profiles(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_profiles_priority ON customer_intelligence_profiles(sales_priority_score DESC, review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_feedback_customer ON customer_intelligence_feedback(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_score_history_customer ON customer_score_history(customer_id, score_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_type_profiles_active ON customer_type_profiles(active, sort_order, customer_type);
CREATE INDEX IF NOT EXISTS idx_customer_type_score_dimensions_profile ON customer_type_score_dimensions(customer_type_profile_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_customer_discovery_requests_created ON customer_discovery_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_tasks_status_created ON search_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_tasks_discovery_request ON search_tasks(customer_discovery_request_id);
CREATE INDEX IF NOT EXISTS idx_customer_intelligence_updates_customer ON customer_intelligence_updates(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_results_task_status ON search_results(search_task_id, status, opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_search_results_company_country ON search_results(company_name, country);
CREATE INDEX IF NOT EXISTS idx_search_results_customer_id ON search_results(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_executions_one_active_task ON search_executions(search_task_id) WHERE status IN ('Awaiting Approval','Approved','Running','Paused','Interrupted');
CREATE INDEX IF NOT EXISTS idx_search_executions_task_created ON search_executions(search_task_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_executions_status_heartbeat ON search_executions(status,heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_search_raw_execution ON search_result_raw_payloads(search_execution_id,record_index);
CREATE INDEX IF NOT EXISTS idx_customers_customer_source ON customers(customer_source, opportunity_grade, sales_priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_customers_test_data ON customers(is_test_data, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_created ON ai_cost_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_module ON ai_cost_logs(module_name, action_name, status);
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup ON ai_cache_records(module_name, action_name, entity_type, entity_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_lookup ON ai_prompt_templates(prompt_key, active, version DESC);
CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_lookup ON ai_context_snapshots(context_type, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_execution_logs_lookup ON ai_execution_logs(module_name, action_name, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_execution_logs_status ON ai_execution_logs(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_items_single_active ON knowledge_items(knowledge_key) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_knowledge_items_type_status ON knowledge_items(knowledge_type, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_key_revision ON knowledge_items(knowledge_key, revision_no DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_strategies_single_approved ON search_strategies(strategy_key) WHERE status='Approved';
CREATE INDEX IF NOT EXISTS idx_search_strategies_status_updated ON search_strategies(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_strategies_key_revision ON search_strategies(strategy_key,revision_no DESC);
CREATE INDEX IF NOT EXISTS idx_search_strategies_discovery ON search_strategies(customer_discovery_request_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_strategies_linked_task ON search_strategies(linked_search_task_id) WHERE linked_search_task_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sales_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company TEXT, country TEXT, inquiry_type TEXT NOT NULL, customer_message TEXT NOT NULL, attachments TEXT NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL DEFAULT 'Normal', sales_notes TEXT, status TEXT NOT NULL DEFAULT 'New',
  assigned_sales_id INTEGER REFERENCES users(id) ON DELETE SET NULL, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_inquiry_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id INTEGER NOT NULL REFERENCES sales_inquiries(id) ON DELETE CASCADE,
  customer_intent TEXT NOT NULL, opportunity_size TEXT NOT NULL, restaurant_type TEXT, estimated_budget TEXT,
  furniture_categories TEXT NOT NULL DEFAULT '[]', missing_information TEXT NOT NULL DEFAULT '[]', suggested_next_question TEXT,
  recommended_package TEXT, notes TEXT, provider TEXT NOT NULL DEFAULT 'rules', created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_inquiry_products (
  inquiry_id INTEGER NOT NULL REFERENCES sales_inquiries(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  match_reason TEXT, selected INTEGER NOT NULL DEFAULT 0, quantity INTEGER NOT NULL DEFAULT 1, proposed_unit_price REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(inquiry_id, product_id)
);
CREATE TABLE IF NOT EXISTS sales_quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, quote_number TEXT NOT NULL UNIQUE, inquiry_id INTEGER NOT NULL REFERENCES sales_inquiries(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id), quote_type TEXT NOT NULL DEFAULT 'Quote', currency TEXT NOT NULL DEFAULT 'USD', destination TEXT,
  trade_term TEXT, quote_date TEXT, valid_until TEXT, salesperson_id INTEGER REFERENCES users(id), discount_percent REAL NOT NULL DEFAULT 0,
  other_charges REAL NOT NULL DEFAULT 0, deposit_percent REAL NOT NULL DEFAULT 30, balance_percent REAL NOT NULL DEFAULT 70,
  payment_method TEXT DEFAULT 'TT Bank Transfer', payment_note TEXT, shipping_method TEXT, origin_port TEXT, destination_port TEXT,
  destination_address TEXT, freight_cost REAL, transit_time TEXT, freight_remark TEXT, other_remark TEXT, contact_person TEXT,
  buyer_phone TEXT, buyer_email TEXT, billing_address TEXT, buyer_reference_no TEXT, project_name TEXT, total_packages INTEGER,
  total_cbm_override REAL, total_gross_weight_override REAL, total_net_weight_override REAL,
  production_time TEXT, special_terms TEXT, bank_account_id INTEGER REFERENCES organization_bank_accounts(id), current_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Draft', subtotal REAL NOT NULL DEFAULT 0, discount_total REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id INTEGER NOT NULL REFERENCES sales_quotes(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0, remark TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  confirmed_material TEXT, confirmed_finish TEXT, confirmed_color_name TEXT, customer_remark TEXT, swatch_image_url TEXT,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL, variant_snapshot TEXT, product_snapshot TEXT,
  pricing_source TEXT NOT NULL DEFAULT 'Reference', reference_price_snapshot REAL, cost_snapshot REAL,
  cost_currency_snapshot TEXT, final_selling_price_snapshot REAL
);
CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, inquiry_id INTEGER NOT NULL REFERENCES sales_inquiries(id), quote_id INTEGER REFERENCES sales_quotes(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id), status TEXT NOT NULL DEFAULT 'Confirmed', total REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD',
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id INTEGER NOT NULL REFERENCES sales_inquiries(id) ON DELETE CASCADE, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open', due_at TEXT, assigned_to INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS customer_sales_timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE, inquiry_id INTEGER REFERENCES sales_inquiries(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, description TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_quote_versions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id INTEGER NOT NULL REFERENCES sales_quotes(id) ON DELETE CASCADE,
 version_number INTEGER NOT NULL, snapshot TEXT NOT NULL, created_by INTEGER REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(quote_id, version_number)
);
CREATE TABLE IF NOT EXISTS sales_order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
 product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, unit_price REAL NOT NULL,
 discount_percent REAL NOT NULL DEFAULT 0, remark TEXT, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sales_quote_custom_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id INTEGER NOT NULL REFERENCES sales_quotes(id) ON DELETE CASCADE,
 reference_image_url TEXT, item_name TEXT NOT NULL, category TEXT, specification TEXT, material TEXT, color_finish TEXT,
 size_dimensions TEXT, quantity INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0,
 discount_percent REAL NOT NULL DEFAULT 0, cbm REAL, gross_weight_kg REAL, net_weight_kg REAL, remark TEXT,
 confirmed_material TEXT, confirmed_finish TEXT, confirmed_color_name TEXT, customer_remark TEXT, swatch_image_url TEXT,
 sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_order_custom_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
 source_quote_custom_item_id INTEGER, item_snapshot TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_owner ON sales_inquiries(assigned_sales_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_inquiry ON sales_quotes(inquiry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_owner ON sales_tasks(assigned_to, status, due_at);
CREATE INDEX IF NOT EXISTS idx_customer_sales_timeline ON customer_sales_timeline(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_quote_versions ON sales_quote_versions(quote_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_sales_quote_custom_items ON sales_quote_custom_items(quote_id,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_sales_order_custom_items ON sales_order_custom_items(order_id,id);
