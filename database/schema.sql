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
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT,
  materials TEXT,
  size TEXT,
  price_range TEXT,
  lead_time_days INTEGER,
  moq INTEGER,
  tags TEXT,
  ai_summary TEXT,
  ai_recommendation_weight INTEGER NOT NULL DEFAULT 50 CHECK (ai_recommendation_weight BETWEEN 0 AND 100),
  ai_notes TEXT,
  internal_notes TEXT,
  knowledge_prompt TEXT,
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

CREATE TABLE IF NOT EXISTS product_keywords (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  keyword_type TEXT NOT NULL CHECK (keyword_type IN ('ai', 'search')),
  keyword TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, keyword_type, keyword)
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
CREATE INDEX IF NOT EXISTS idx_product_keywords_lookup ON product_keywords(keyword_type, keyword, product_id);
CREATE INDEX IF NOT EXISTS idx_products_materials ON products(materials);
