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
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  last_ai_run_at TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
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

INSERT INTO ai_cost_settings
  (daily_budget_usd, monthly_budget_usd, text_budget_usd, image_budget_usd, default_provider,
   allow_paid_provider, require_confirmation_over_usd, cache_ttl_days)
SELECT 2, 50, 20, 30, 'mock', 0, 0.01, 7
WHERE NOT EXISTS (SELECT 1 FROM ai_cost_settings);

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
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_created ON ai_cost_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_module ON ai_cost_logs(module_name, action_name, status);
CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup ON ai_cache_records(module_name, action_name, entity_type, entity_id, expires_at);

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
  trade_term TEXT, status TEXT NOT NULL DEFAULT 'Draft', subtotal REAL NOT NULL DEFAULT 0, discount_total REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sales_quote_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id INTEGER NOT NULL REFERENCES sales_quotes(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL DEFAULT 1, unit_price REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0, remark TEXT, sort_order INTEGER NOT NULL DEFAULT 0
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
CREATE INDEX IF NOT EXISTS idx_sales_inquiries_owner ON sales_inquiries(assigned_sales_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_quotes_inquiry ON sales_quotes(inquiry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_owner ON sales_tasks(assigned_to, status, due_at);
CREATE INDEX IF NOT EXISTS idx_customer_sales_timeline ON customer_sales_timeline(customer_id, created_at DESC);
