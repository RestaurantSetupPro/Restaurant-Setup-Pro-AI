import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { PostgresSyncDatabase } from './postgres-sync.mjs';
import { aiImageProviderConfig, createAiImageProvider } from './services/ai-image-provider.mjs';
import { saveGeneratedImage } from './services/generated-image-storage.mjs';
import { createAiCostControl } from './services/ai-cost-control.mjs';
import { createAiBusinessBrain } from './services/ai-business-brain.mjs';
import { createKnowledgeCenter } from './services/knowledge-center.mjs';
import { blankSearchStrategyData, createSearchStrategyService, validateSearchStrategyData } from './services/search-strategy.mjs';
import { analyzeInquiry, inquiryTypes, inquiryStatuses } from './services/sales-intelligence.mjs';
import { analyzeSpreadsheet, parseSpreadsheet } from './services/smart-product-import.mjs';
import {
  buildOutreachDraft, contactRoles, customerSources, dataQualityScore, detectGaps, nextActionFor,
  normalizeCustomer, opportunityEngineVersion, parseImportPayload, scoreOpportunity
} from './services/opportunity-engine.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const publicDir = join(root, 'public');
const databasePath = resolve(root, process.env.DATABASE_PATH || 'data/restaurant-setup-pro.db');
const databaseUrl = process.env.DATABASE_URL;
const PORT = process.env.PORT || 3000;
const databaseInitializationDelayMs = Number(process.env.DATABASE_INITIALIZATION_DELAY_MS || 2_000);
const databaseRetryDelayMs = Number(process.env.DATABASE_RETRY_DELAY_MS || 30_000);
const sessionHours = Number(process.env.SESSION_HOURS || 12);
const seedPassword = process.env.SEED_PASSWORD || 'Welcome123!';
const demoMode = process.env.DEMO_MODE === 'true' || (process.env.DEMO_MODE !== 'false' && process.env.NODE_ENV !== 'production');
const buildVersion = String(process.env.BUILD_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || `startup-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '-');

let db;
let aiCostControl;
let aiBusinessBrain;
let knowledgeCenter;
let searchStrategyService;
let databaseStatus = 'starting';
let databaseInitializationError;
let databaseRetryTimer;
let databaseInitializationInProgress = false;
const databaseDiagnostics = {
  connected: false,
  migration: false,
  migrationVersion: null,
  tables: [],
  error: null
};
const systemEvents = [];

function recordSystemEvent(level, message, details = null) {
  const event = { timestamp: new Date().toISOString(), level, message, details };
  systemEvents.push(event);
  if (systemEvents.length > 100) systemEvents.shift();
  const writer = level === 'error' ? console.error : console.log;
  writer(message, details === null ? '' : JSON.stringify(details, null, level === 'error' ? 2 : 0));
}

function databaseTarget() {
  if (!databaseUrl) return { engine: 'sqlite', database: databasePath };
  try {
    const parsed = new URL(databaseUrl);
    return {
      engine: 'postgresql',
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.replace(/^\//, '') || 'postgres',
      ssl: process.env.DATABASE_SSL !== 'false'
    };
  } catch {
    return { engine: 'postgresql', host: 'invalid_DATABASE_URL' };
  }
}

function serializeDatabaseError(error) {
  if (!error) return null;
  return Object.fromEntries(Object.entries({
    name: error.name,
    message: error.message,
    code: error.code,
    detail: error.detail,
    hint: error.hint,
    position: error.position,
    where: error.where,
    schema: error.schema,
    table: error.table,
    column: error.column,
    constraint: error.constraint,
    stack: error.stack
  }).filter(([, value]) => value !== undefined));
}

function initializeDatabase() {
  if (databaseInitializationInProgress || databaseStatus === 'ready') return;
  databaseInitializationInProgress = true;
  databaseStatus = 'starting';
  databaseDiagnostics.error = null;
  recordSystemEvent('info', 'Database initialization started', databaseTarget());
  try {
    if (!db && databaseUrl) {
      recordSystemEvent('info', 'Database connection: connecting to PostgreSQL');
      db = new PostgresSyncDatabase(databaseUrl, { ssl: process.env.DATABASE_SSL !== 'false' });
      databaseDiagnostics.connected = true;
      recordSystemEvent('info', 'Database connection: PostgreSQL connected');
    } else if (!db) {
      recordSystemEvent('info', 'Database connection: opening SQLite');
      mkdirSync(dirname(databasePath), { recursive: true });
      db = new DatabaseSync(databasePath);
      databaseDiagnostics.connected = true;
      recordSystemEvent('info', 'Database connection: SQLite connected');
    }

    if (databaseUrl) {
      recordSystemEvent('info', `Database migration: RUN_MIGRATIONS=${process.env.RUN_MIGRATIONS !== 'false'}`);
      if (process.env.RUN_MIGRATIONS !== 'false') {
        for (const migrationFile of ['001_initial_schema.sql', '002_product_intelligence.sql', '003_ai_product_content_factory.sql', '004_real_ai_image_generation.sql', '005_opportunity_intelligence_engine.sql', '006_ai_cost_control.sql', '007_sales_intelligence_part1.sql', '008_quote_pi_builder.sql', '009_custom_quote_items.sql', '010_global_pi_template.sql', '011_professional_pi_optimization.sql', '012_product_foundation.sql', '013_product_master_data.sql', '014_pim_foundation_upgrade.sql', '015_ai_product_import.sql', '016_product_library_business_readiness.sql', '017_product_price_engine.sql', '018_v53_ai_business_brain_foundation.sql', '019_v53_phase2a_customer_intelligence_mvp.sql', '020_v53_opportunity_discovery_assistant.sql', '021_v53_search_task_execution_center.sql', '022_v53_customer_intelligence_update_history.sql', '023_v53_search_result_storage.sql', '024_v53_customer_source.sql', '025_v53_ai_knowledge_center_foundation.sql', '026_v53_search_strategy_human_approval.sql']) {
          db.exec(readFileSync(join(root, 'database', 'migrations', migrationFile), 'utf8'));
        }
      }
      const migration = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get('026_v53_search_strategy_human_approval');
      databaseDiagnostics.migration = migration?.version === '026_v53_search_strategy_human_approval';
      databaseDiagnostics.migrationVersion = migration?.version || null;
      if (!databaseDiagnostics.migration) throw new Error('Migration 026_v53_search_strategy_human_approval was not recorded.');
      databaseDiagnostics.tables = db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name").all().map(row => row.table_name);
    } else {
      db.exec(readFileSync(join(root, 'database', 'schema.sql'), 'utf8'));
      ensureProductColumns();
      ensureProductMasterDataColumns();
      ensurePimFoundationColumns();
      ensureProductBusinessReadinessColumns();
      ensureProductPriceEngineColumns();
      ensureMediaColumns();
      ensureImageTaskColumns();
      ensureQuoteBuilderColumns();
      ensureCustomerIntelligenceColumns();
      databaseDiagnostics.migration = true;
      databaseDiagnostics.migrationVersion = '026_v53_search_strategy_human_approval';
      databaseDiagnostics.tables = db.prepare("SELECT name AS table_name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.table_name);
    }
    seedCustomerDiscoveryProfiles();
    aiCostControl = createAiCostControl(db);
    knowledgeCenter = createKnowledgeCenter({ db, audit });
    searchStrategyService = createSearchStrategyService({ db, audit });
    aiBusinessBrain = createAiBusinessBrain({ db, aiCostControl, buildContext: buildAiContext });
    recordSystemEvent('info', `Database migration: verified (${databaseDiagnostics.tables.length} tables)`);
    recordSystemEvent('info', 'Database seed: started');
    seedDatabase();
    refreshProductReadiness();
    recordSystemEvent('info', 'Database seed: completed');
    databaseStatus = 'ready';
    databaseInitializationError = undefined;
    databaseDiagnostics.error = null;
    recordSystemEvent('info', `Database ready (${databaseUrl ? 'PostgreSQL' : 'SQLite'})`);
  } catch (error) {
    databaseStatus = 'error';
    databaseInitializationError = error;
    databaseDiagnostics.error = JSON.stringify(serializeDatabaseError(error));
    recordSystemEvent('error', 'Database initialization failed', serializeDatabaseError(error));
    clearTimeout(databaseRetryTimer);
    databaseRetryTimer = setTimeout(initializeDatabase, databaseRetryDelayMs);
    recordSystemEvent('error', `Database initialization retry scheduled in ${databaseRetryDelayMs}ms`);
  } finally {
    databaseInitializationInProgress = false;
  }
}

function ensureProductColumns() {
  const existing = new Set(db.prepare('PRAGMA table_info(products)').all().map(column => column.name));
  const columns = {
    size: 'TEXT',
    price_range: 'TEXT',
    moq: 'INTEGER',
    tags: 'TEXT',
    ai_summary: 'TEXT',
    ai_recommendation_weight: 'INTEGER NOT NULL DEFAULT 50',
    ai_notes: 'TEXT',
    internal_notes: 'TEXT',
    knowledge_prompt: 'TEXT',
    sub_category: 'TEXT',
    product_series: 'TEXT',
    color: 'TEXT',
    finish: 'TEXT',
    budget_level: 'TEXT',
    recommended_usage: 'TEXT',
    sales_notes: 'TEXT',
    common_questions: 'TEXT',
    common_objections: 'TEXT',
    proposal_ready_status: "TEXT NOT NULL DEFAULT 'Needs Review'",
    english_description: 'TEXT',
    short_sales_description: 'TEXT',
    proposal_usage_notes: 'TEXT',
    sales_talking_points: 'TEXT',
    seo_title: 'TEXT',
    seo_description: 'TEXT',
    meta_keywords: 'TEXT',
    slug: 'TEXT',
    canonical_url: 'TEXT',
    image_alt: 'TEXT',
    image_caption: 'TEXT',
    product_keywords: 'TEXT',
    llm_summary: 'TEXT',
    use_cases: 'TEXT',
    best_for: 'TEXT',
    not_recommended_for: 'TEXT',
    comparison: 'TEXT',
    advantages: 'TEXT',
    disadvantages: 'TEXT',
    faq: 'TEXT',
    buying_guide: 'TEXT',
    installation_guide: 'TEXT',
    maintenance_guide: 'TEXT',
    common_problems: 'TEXT',
    suggested_prompt: 'TEXT', specification: 'TEXT', cbm: 'REAL', gross_weight_kg: 'REAL', net_weight_kg: 'REAL',
    library_status: "TEXT NOT NULL DEFAULT 'Active'", visibility: "TEXT NOT NULL DEFAULT 'Website + Quote'",
    short_description: 'TEXT', website_description: 'TEXT', quote_description: 'TEXT', website_price_display: "TEXT NOT NULL DEFAULT 'Request Quote'"
  };
  for (const [name, type] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE products ADD COLUMN ${name} ${type}`);
  }
}

function ensureMediaColumns() {
  const existing = new Set(db.prepare('PRAGMA table_info(media_assets)').all().map(column => column.name));
  const columns = {
    image_type: "TEXT NOT NULL DEFAULT 'Detail Image'",
    image_status: "TEXT NOT NULL DEFAULT 'Uploaded'",
    generated_source: 'TEXT'
  };
  for (const [name, type] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE media_assets ADD COLUMN ${name} ${type}`);
  }
}

function ensureImageTaskColumns() {
  const existing = new Set(db.prepare('PRAGMA table_info(ai_image_generation_tasks)').all().map(column => column.name));
  const columns = {
    lifecycle_status: "TEXT NOT NULL DEFAULT 'pending' CHECK (lifecycle_status IN ('draft', 'pending', 'running', 'generated', 'pending_review', 'approved', 'rejected', 'failed', 'applied'))",
    started_at: 'TEXT', completed_at: 'TEXT', error_message: 'TEXT', provider_request_id: 'TEXT', output_url: 'TEXT',
    output_width: 'INTEGER', output_height: 'INTEGER', prompt_version: 'INTEGER NOT NULL DEFAULT 1', ai_confidence: 'REAL',
    reviewed_at: 'TEXT', applied_at: 'TEXT', status_history: "TEXT NOT NULL DEFAULT '[]'"
  };
  for (const [name, type] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE ai_image_generation_tasks ADD COLUMN ${name} ${type}`);
  }
  db.prepare("UPDATE ai_image_generation_tasks SET lifecycle_status = status WHERE lifecycle_status = 'pending' AND status != 'pending'").run();
  db.exec('CREATE INDEX IF NOT EXISTS idx_ai_image_tasks_lifecycle ON ai_image_generation_tasks(product_id, lifecycle_status, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ai_image_tasks_execution_queue ON ai_image_generation_tasks(lifecycle_status, provider, created_at)');
}

function ensureCustomerIntelligenceColumns() {
  const existing = new Set(db.prepare('PRAGMA table_info(customers)').all().map(column => column.name));
  const columns = {
    customer_type: 'TEXT',
    industry: 'TEXT',
    customer_value_score: 'INTEGER NOT NULL DEFAULT 0',
    customer_value_grade: "TEXT NOT NULL DEFAULT 'D'",
    customer_value_explanation: 'TEXT',
    buying_opportunity_score: 'INTEGER NOT NULL DEFAULT 0',
    buying_opportunity_grade: "TEXT NOT NULL DEFAULT 'D'",
    buying_opportunity_explanation: 'TEXT',
    purchase_timing: "TEXT NOT NULL DEFAULT 'Unknown'",
    purchase_timing_confidence: "TEXT NOT NULL DEFAULT 'Low'",
    sales_priority_score: 'INTEGER NOT NULL DEFAULT 0',
    sales_priority_explanation: 'TEXT',
    project_information: 'TEXT',
    customer_comments: 'TEXT',
    expected_purchase_timing: 'TEXT',
    opportunity_notes: 'TEXT',
    last_customer_intelligence_run_at: 'TEXT',
    customer_source: "TEXT NOT NULL DEFAULT 'Manual Import'",
    is_test_data: 'INTEGER NOT NULL DEFAULT 0',
    recommended_product_reason: 'TEXT'
  };
  for (const [name, type] of Object.entries(columns)) if (!existing.has(name)) db.exec(`ALTER TABLE customers ADD COLUMN ${name} ${type}`);
  db.prepare(`UPDATE customers SET customer_source = CASE source
    WHEN 'Google Maps' THEN 'Google Maps'
    WHEN 'Website' THEN 'Website'
    WHEN 'Instagram' THEN 'Instagram'
    WHEN 'Facebook' THEN 'Facebook'
    ELSE customer_source END
    WHERE customer_source = 'Manual Import' AND source IN ('Google Maps', 'Website', 'Instagram', 'Facebook')`).run();
  db.prepare(`UPDATE customers SET customer_source = 'Google Maps'
    WHERE customer_source = 'Manual Import'
      AND (
        NULLIF(TRIM(COALESCE(google_maps_url, '')), '') IS NOT NULL
        OR LOWER(COALESCE(source_url, '')) LIKE '%google%maps%'
        OR LOWER(COALESCE(source_url, '')) LIKE '%maps.app.goo.gl%'
        OR LOWER(COALESCE(source_url, '')) LIKE '%goo.gl/maps%'
        OR LOWER(COALESCE(source_url, '')) LIKE '%g.page%'
      )`).run();
  db.exec(`CREATE TABLE IF NOT EXISTS customer_intelligence_profiles (
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
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS customer_intelligence_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    feedback_type TEXT NOT NULL, feedback_note TEXT, sales_result_reference_type TEXT, sales_result_reference_id INTEGER,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS customer_score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    score_type TEXT NOT NULL, previous_score INTEGER, new_score INTEGER NOT NULL, reason TEXT,
    source TEXT NOT NULL DEFAULT 'rules', created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS customer_intelligence_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    update_reason TEXT NOT NULL,
    original_input TEXT NOT NULL,
    reference_note TEXT,
    ai_summary TEXT NOT NULL,
    latest_customer_situation TEXT,
    important_changes TEXT,
    opportunity_impact TEXT,
    recommended_next_action TEXT,
    ai_execution_log_id INTEGER REFERENCES ai_execution_logs(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS customer_type_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_type TEXT NOT NULL UNIQUE,
    industry TEXT NOT NULL DEFAULT 'Hospitality Furniture',
    description TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS customer_type_score_dimensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_type_profile_id INTEGER NOT NULL REFERENCES customer_type_profiles(id) ON DELETE CASCADE,
    dimension_name TEXT NOT NULL,
    weight_percent INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS customer_discovery_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_request TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    target_customer_type TEXT,
    industry TEXT,
    region TEXT,
    country TEXT,
    search_plan TEXT NOT NULL DEFAULT '{}',
    guidance TEXT NOT NULL DEFAULT '{}',
    scoring_profile TEXT NOT NULL DEFAULT '{}',
    ai_execution_log_id INTEGER,
    cost_log_id INTEGER,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS search_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_discovery_request_id INTEGER REFERENCES customer_discovery_requests(id) ON DELETE SET NULL,
    task_name TEXT NOT NULL,
    target_customer TEXT,
    customer_type TEXT,
    industry TEXT,
    location TEXT,
    company_size TEXT,
    search_objective TEXT,
    keywords TEXT NOT NULL DEFAULT '[]',
    filters TEXT NOT NULL DEFAULT '[]',
    target_quantity INTEGER NOT NULL DEFAULT 0,
    priority TEXT NOT NULL DEFAULT 'Medium',
    required_data_fields TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'Draft',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS search_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_task_id INTEGER NOT NULL REFERENCES search_tasks(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    customer_type TEXT,
    industry TEXT NOT NULL DEFAULT 'Hospitality Furniture',
    country TEXT,
    city TEXT,
    website TEXT,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    linkedin TEXT,
    instagram TEXT,
    company_size TEXT,
    business_type TEXT,
    purchase_potential TEXT,
    opportunity_score INTEGER NOT NULL DEFAULT 0,
    qualification_reason TEXT,
    opportunity_summary TEXT,
    why_customer_matters TEXT,
    recommended_next_action TEXT,
    source_type TEXT NOT NULL DEFAULT 'Manual',
    source_reference TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_customer_intelligence_profiles_customer ON customer_intelligence_profiles(customer_id, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customer_intelligence_profiles_priority ON customer_intelligence_profiles(sales_priority_score DESC, review_status, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customer_intelligence_feedback_customer ON customer_intelligence_feedback(customer_id, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customer_score_history_customer ON customer_score_history(customer_id, score_type, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customer_intelligence_updates_customer ON customer_intelligence_updates(customer_id, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customers_phase2a_priority ON customers(sales_priority_score DESC, customer_value_score DESC, buying_opportunity_score DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customers_customer_source ON customers(customer_source, opportunity_grade, sales_priority_score DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customers_test_data ON customers(is_test_data, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customer_discovery_requests_created ON customer_discovery_requests(created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_search_tasks_status_created ON search_tasks(status, created_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_search_tasks_discovery_request ON search_tasks(customer_discovery_request_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_search_results_task_status ON search_results(search_task_id, status, opportunity_score DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_search_results_company_country ON search_results(company_name, country)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_search_results_customer_id ON search_results(customer_id)');
}

const rolePermissions = Object.freeze({
  Admin: ['dashboard', 'products', 'product-library-products', 'product-library-categories', 'product-library-tags', 'product-library-attributes', 'product-library-variants', 'knowledge-dashboard', 'opportunity-intelligence', 'imports', 'images', 'proposals', 'cases', 'crm', 'sales-ai', 'content-ai', 'core-foundation', 'debug-center', 'settings', 'new-inquiry', 'sales-customers', 'sales-quotes', 'sales-orders', 'sales-tasks'],
  Owner: ['dashboard', 'products', 'product-library-products', 'product-library-categories', 'product-library-tags', 'product-library-attributes', 'product-library-variants', 'knowledge-dashboard', 'opportunity-intelligence', 'imports', 'images', 'proposals', 'cases', 'crm', 'sales-ai', 'content-ai', 'core-foundation', 'debug-center', 'settings', 'new-inquiry', 'sales-customers', 'sales-quotes', 'sales-orders', 'sales-tasks'],
  Sales: ['dashboard', 'products', 'product-library-products', 'product-library-categories', 'product-library-tags', 'product-library-attributes', 'product-library-variants', 'knowledge-dashboard', 'opportunity-intelligence', 'images', 'proposals', 'cases', 'crm', 'sales-ai', 'content-ai', 'core-foundation', 'new-inquiry', 'sales-customers', 'sales-quotes', 'sales-orders', 'sales-tasks'],
  Designer: ['dashboard', 'products', 'product-library-products', 'product-library-categories', 'product-library-tags', 'product-library-attributes', 'product-library-variants', 'knowledge-dashboard', 'images', 'proposals', 'cases', 'content-ai', 'core-foundation'],
  VA: ['dashboard', 'products', 'product-library-products', 'product-library-categories', 'product-library-tags', 'product-library-attributes', 'product-library-variants', 'knowledge-dashboard', 'opportunity-intelligence', 'imports', 'cases', 'crm', 'content-ai', 'core-foundation']
});

const foundationTypes = Object.freeze({
  configs: ['Product Categories', 'Store Types', 'Styles', 'Materials', 'Finishes', 'Colors', 'Countries', 'States / Regions', 'Currencies', 'Units', 'Trade Terms', 'Visibility Options', 'Lead Time Options', 'Product Status Options', 'Proposal Status Options', 'CRM Signal Types', 'CRM Contact Priority', 'Content Status Options'],
  tags: ['Store Type Tags', 'Style Tags', 'Business Tags', 'Material Tags', 'Product Feature Tags', 'Customer Signal Tags', 'Content Tags', 'AI Recommendation Tags'],
  media: ['Product Photo', 'AI Generated Image', 'Project Case Photo', 'PDF', 'CAD', 'DWG', '3D Model', 'Video', 'Document'],
  prompts: ['Product Description Prompt', 'Image Generation Prompt', 'Sales DM Prompt', 'Email Prompt', 'WhatsApp Prompt', 'Proposal Prompt', 'Content Script Prompt', 'SEO Prompt']
});

const aiPreviewNotice = 'AI Generated Preview - Not for Production Use';
const skuCategoryCodes = Object.freeze({
  'Booth Seating': 'BS',
  'Dining Chair': 'CH',
  'Restaurant Table': 'TB',
  'Bar Stool': 'ST',
  'Outdoor Furniture': 'OD',
  'Partition / Divider': 'PT',
  'Counter / Service Bar': 'CT',
  'Table Top': 'TP', 'Table Base': 'BA', Sofa: 'SF', Cabinet: 'CB', Divider: 'DV', Lighting: 'LG', Decor: 'DC',
  'Custom Furniture': 'CF', 'Kitchen Equipment': 'KE', Tableware: 'TW', Others: 'OT'
});
const skuStyleCodes = Object.freeze({
  California: 'CA', Japandi: 'JP', Industrial: 'IN', Luxury: 'LX', Modern: 'MD', Minimalist: 'MN'
});
const productTagTypes = Object.freeze(['Store Type Tags', 'Style Tags', 'Business Tags']);
const knowledgeTermSeeds = Object.freeze({
  store_type: ['Coffee Shop', 'Restaurant', 'Bubble Tea', 'Bakery', 'Bakery Cafe', 'Bar', 'Fast Casual', 'Hotel', 'Food Court'],
  style: ['California', 'Japandi', 'Industrial', 'Modern', 'Luxury', 'Minimalist', 'Mediterranean', 'Scandinavian'],
  feature: ['Commercial Grade', 'Outdoor', 'Easy Cleaning', 'Fire Resistant', 'Custom Upholstery', 'Quick Production', 'DDP Available', 'High Traffic', 'Space Saving', 'AI Recommendation'],
  customer_type: ['New Store', 'Expansion', 'Remodel', 'Chain Brand', 'Design Firm', 'Mature Store']
});
const budgetLevels = Object.freeze(['Economy', 'Standard', 'Premium', 'Luxury']);
const productLibraryStatuses = Object.freeze(['Draft','Pending Review','Approved','Inactive','Archived']);
const productVisibilities = Object.freeze(['Website + Quote','Quote Only','Internal Only','Hidden']);
const variantStatuses = Object.freeze(['Active','Hidden','Coming Soon','Discontinued']);
const productImageTypes = Object.freeze([
  'Main Image', 'Front View', 'Back View', 'Left View', 'Right View', '45 Degree View', 'Detail Image', 'White Background Image',
  'Scene Image - Coffee Shop', 'Scene Image - Restaurant', 'Scene Image - Bubble Tea', 'Scene Image - Bar',
  'Gallery Image', 'Dimension Drawing', 'CAD Drawing', 'Packaging Image', 'Installation Image', 'Finish / Color Sample', 'Certificate Image',
  'Specification PDF', 'Assembly Manual', 'Installation Guide', 'Test Report', 'Warranty', 'Supplier Catalog', 'Material Certificate'
]);
const productImageStatuses = Object.freeze(['Uploaded', 'AI Generated', 'Approved', 'Rejected']);
const productIntelligenceFields = Object.freeze([
  'sub_category', 'product_series', 'color', 'finish', 'budget_level', 'recommended_usage', 'sales_notes', 'common_questions', 'common_objections',
  'english_description', 'short_sales_description', 'proposal_usage_notes', 'sales_talking_points',
  'seo_title', 'seo_description', 'meta_keywords', 'slug', 'canonical_url', 'image_alt', 'image_caption', 'product_keywords',
  'llm_summary', 'use_cases', 'best_for', 'not_recommended_for', 'comparison', 'advantages', 'disadvantages', 'faq', 'buying_guide',
  'installation_guide', 'maintenance_guide', 'common_problems', 'suggested_prompt',
  'library_status', 'visibility', 'short_description', 'website_description', 'quote_description', 'website_price_display'
]);
const aiFactoryModes = Object.freeze(['fast', 'standard', 'premium']);
const aiDraftStatuses = Object.freeze(['draft', 'pending_review', 'approved', 'rejected', 'applied']);
const aiImageTaskStatuses = Object.freeze(['draft', 'pending', 'generated', 'approved', 'rejected', 'failed']);
const aiDraftEditableFields = Object.freeze([
  'generated_product_name', 'generated_category', 'generated_sub_category', 'generated_material', 'generated_color',
  'generated_description_en', 'generated_description_zh', 'generated_short_sales_description', 'generated_seo_title',
  'generated_seo_description', 'generated_meta_keywords', 'generated_llm_summary', 'generated_faq', 'generated_buying_guide',
  'generated_sales_talking_points', 'generated_proposal_notes', 'analysis_summary', 'review_notes'
]);
const aiFactoryImagePlans = Object.freeze({
  fast: [],
  standard: [
    ['Scene Image - Coffee Shop', 'Coffee Shop'],
    ['Scene Image - Restaurant', 'Restaurant'],
    ['White Background Image', null]
  ],
  premium: [
    ['Front View', null], ['Back View', null], ['Left View', null], ['Right View', null], ['45 Degree View', null],
    ['Detail Image', null], ['White Background Image', null], ['Transparent PNG', null],
    ['Scene Image - Coffee Shop', 'Coffee Shop'], ['Scene Image - Restaurant', 'Restaurant'],
    ['Scene Image - Bubble Tea', 'Bubble Tea'], ['Scene Image - Bar', 'Bar'],
    ['Scene Image - Bakery', 'Bakery'], ['Scene Image - Hotel', 'Hotel']
  ]
});

const demoUsers = [
  ['Avery Brooks', 'admin@rspro.ai', 'Admin', 'AB'],
  ['Riley Morgan', 'salesadmin@rspro.ai', 'Admin', 'RM'],
  ['Morgan Chen', 'owner@rspro.ai', 'Owner', 'MC'],
  ['Jordan Lee', 'sales@rspro.ai', 'Sales', 'JL'],
  ['Taylor Kim', 'designer@rspro.ai', 'Designer', 'TK'],
  ['Casey Rivera', 'va@rspro.ai', 'VA', 'CR']
];

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, encoded) {
  const [algorithm, salt, hash] = String(encoded).split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (!userCount) {
    const insert = db.prepare('INSERT INTO users (name, email, password_hash, role, initials) VALUES (?, ?, ?, ?, ?)');
    const password = hashPassword(seedPassword);
    for (const user of demoUsers) insert.run(user[0], user[1], password, user[2], user[3]);
  }
  if (!db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get('salesadmin@rspro.ai')) {
    db.prepare('INSERT INTO users (name,email,password_hash,role,initials) VALUES (?,?,?,?,?)').run('Riley Morgan','salesadmin@rspro.ai',hashPassword(seedPassword),'Admin','RM');
  }

  const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM product_categories').get().count;
  if (!categoryCount) {
    const categories = [
      ['Restaurant Chairs', 'restaurant-chairs', 'Commercial indoor and outdoor restaurant seating.'],
      ['Dining Tables', 'dining-tables', 'Table tops, bases, and complete dining tables.'],
      ['Booth Seating', 'booth-seating', 'Custom banquettes and modular booth systems.'],
      ['Outdoor Furniture', 'outdoor-furniture', 'Weather-ready furniture for patios and terraces.']
    ];
    const insertCategory = db.prepare('INSERT INTO product_categories (name, slug, description) VALUES (?, ?, ?)');
    for (const category of categories) insertCategory.run(...category);
  }

  db.prepare("UPDATE product_categories SET name = 'Dining Chair', slug = 'dining-chair' WHERE slug = 'restaurant-chairs'").run();
  db.prepare("UPDATE product_categories SET name = 'Restaurant Table', slug = 'restaurant-table' WHERE slug = 'dining-tables'").run();
  const ensureCategory = db.prepare('INSERT OR IGNORE INTO product_categories (name, slug) VALUES (?, ?)');
  for (const name of Object.keys(skuCategoryCodes)) ensureCategory.run(name, makeCode(name).toLowerCase());
  for (const name of ['Dining Chair','Bar Stool','Table Top','Table Base','Booth Seating','Sofa','Outdoor Furniture','Cabinet','Divider','Lighting','Decor','Custom Furniture','Kitchen Equipment','Tableware','Others']) ensureCategory.run(name, makeCode(name).toLowerCase());

  const adminId = db.prepare("SELECT id FROM users WHERE role = 'Admin'").get().id;
  const salesId = db.prepare("SELECT id FROM users WHERE role = 'Sales'").get().id;
  const ownerId = db.prepare("SELECT id FROM users WHERE role = 'Owner'").get().id;

  const organizationDefaults = {
    company_logo: '/favicon.svg', company_name: 'Restaurant Setup Pro', address: '', city_state_zip: '', country: '',
    phone: '', email: 'sales@restaurantsetuppro.com', website: 'https://restaurantsetuppro.com', registration_no: ''
  };
  const insertOrganizationSetting = db.prepare('INSERT OR IGNORE INTO organization_settings (key, value, updated_by) VALUES (?, ?, ?)');
  for (const [key, value] of Object.entries(organizationDefaults)) insertOrganizationSetting.run(key, value, ownerId);

  const demoCustomers = [
    ['California Coffee Lab', 'Coffee Shop', 'United States', 'San Diego', 'Website'],
    ['Tokyo Sushi House', 'Restaurant', 'Japan', 'Tokyo', 'Manual'],
    ['Harbor Bakery Cafe', 'Bakery Cafe', 'Australia', 'Sydney', 'Instagram'],
    ['Metro Bubble Tea', 'Bubble Tea', 'Malaysia', 'Kuala Lumpur', 'Facebook']
  ];
  const findDemoCustomer = db.prepare('SELECT id FROM customers WHERE LOWER(company_name) = LOWER(?) LIMIT 1');
  const insertDemoCustomer = db.prepare(`INSERT INTO customers
    (company_name, business_type, country, city, source, source_confidence, confidence_score, created_by)
    VALUES (?, ?, ?, ?, ?, 80, 80, ?)`);
  for (const customer of demoCustomers) if (!findDemoCustomer.get(customer[0])) insertDemoCustomer.run(...customer, ownerId);

  const configSeeds = {
    'Product Categories': ['Booth Seating', 'Dining Chair', 'Restaurant Table', 'Bar Stool', 'Outdoor Furniture', 'Partition / Divider', 'Counter / Service Bar'],
    'Store Types': ['Coffee Shop', 'Bubble Tea', 'Restaurant', 'Bar', 'Bakery Cafe', 'Fast Casual', 'Japanese Restaurant'],
    Styles: ['California', 'Japandi', 'Industrial', 'Luxury', 'Minimalist', 'Modern', 'Mediterranean', 'Scandinavian'],
    Materials: ['Solid Wood', 'Plywood', 'Metal', 'Stainless Steel', 'PU Leather', 'Fabric', 'Laminate', 'Marble Look', 'Stone Top'],
    Finishes: ['Natural', 'Painted', 'Powder Coated', 'Brushed', 'Polished', 'Matte', 'Gloss'],
    Colors: ['Natural', 'Black', 'White', 'Grey', 'Brown', 'Custom'],
    Currencies: ['USD', 'CNY', 'MYR', 'THB'],
    Units: ['mm', 'cm', 'inch', 'sqft', 'sqm', 'CBM'],
    'Trade Terms': ['EXW', 'FOB', 'CIF', 'DDP'],
    'Visibility Options': ['Website + Quote', 'Quote Only', 'Internal Only', 'Hidden'],
    'Product Status Options': ['Draft', 'Pending Review', 'Approved', 'Inactive', 'Archived'],
    'CRM Signal Types': ['Expansion', 'New Store', 'Remodel', 'Mature Store', 'Chain Brand', 'Design Firm']
  };
  const insertConfig = db.prepare('INSERT OR IGNORE INTO system_configs (config_type, name, code, sort_order, active, is_system, created_by) VALUES (?, ?, ?, ?, 1, 1, ?)');
  for (const [type, names] of Object.entries(configSeeds)) {
    names.forEach((name, index) => insertConfig.run(type, name, makeCode(name), index + 1, adminId));
  }
  db.prepare("UPDATE system_configs SET active=0 WHERE config_type='Product Status Options' AND name IN ('Active','Hidden','New','Best Seller','Coming Soon','Discontinued')").run();
  db.prepare("UPDATE products SET library_status=CASE library_status WHEN 'Active' THEN 'Approved' WHEN 'New' THEN 'Approved' WHEN 'Best Seller' THEN 'Approved' WHEN 'Coming Soon' THEN 'Pending Review' WHEN 'Hidden' THEN 'Inactive' WHEN 'Discontinued' THEN 'Inactive' ELSE library_status END").run();

  const tagSeeds = {
    'Store Type Tags': ['Coffee Shop', 'Bubble Tea', 'Restaurant', 'Bar', 'Fast Casual', 'Japanese Restaurant', 'Bakery', 'Bakery Cafe'],
    'Style Tags': ['California', 'Japandi', 'Industrial', 'Luxury', 'Minimalist', 'Modern', 'Mediterranean', 'Scandinavian'],
    'Business Tags': ['Budget Friendly', 'Custom Size', 'Quick Production', 'DDP Available', 'Modular', 'Premium', 'Outdoor'],
    'Product Feature Tags': ['Booth Seating', 'Space Saving', 'High Traffic', 'Easy Cleaning', 'Custom Upholstery', 'Commercial Grade'],
    'Customer Signal Tags': ['New Store', 'Expansion', 'Remodel', 'Mature Store', 'Chain Brand', 'Design Firm']
  };
  const insertTag = db.prepare('INSERT OR IGNORE INTO system_tags (tag_name, tag_type, code, active, is_system, created_by) VALUES (?, ?, ?, 1, 1, ?)');
  for (const [type, names] of Object.entries(tagSeeds)) {
    names.forEach(name => insertTag.run(name, type, `TAG-${makeCode(name)}`, adminId));
  }

  const categoryTemplates = {
    'Dining Chair': [['Frame Material','Select'],['Seat Material','Select'],['Finish','Select'],['Seat Height','Number','mm'],['Overall Size','Text']],
    'Table Top': [['Shape','Select'],['Size','Text'],['Thickness','Number','mm'],['Material','Select'],['Edge Style','Select'],['Surface Finish','Select']],
    'Table Base': [['Base Type','Select'],['Base Size','Text'],['Height','Number','mm'],['Material','Select'],['Finish','Select'],['Suitable Top Size','Text']],
    'Booth Seating': [['Shape','Select'],['Length','Number','mm'],['Seat Depth','Number','mm'],['Back Height','Number','mm'],['Upholstery','Select'],['Foam Density','Text']],
    'Kitchen Equipment': [['Voltage','Text'],['Power','Text'],['Frequency','Text'],['Capacity','Text'],['Gas Type','Select'],['Certification','Multi-select']],
    Tableware: [['Diameter','Number','mm'],['Volume','Number','ml'],['Material','Select'],['Dishwasher Safe','Boolean'],['Microwave Safe','Boolean'],['Stackable','Boolean']],
    Lighting: [['Wattage','Text'],['Voltage','Text'],['Color Temperature','Text'],['IP Rating','Text'],['Installation Type','Select']]
  };
  const findAttribute = db.prepare('SELECT id FROM product_attribute_definitions WHERE code = ?');
  const addAttribute = db.prepare('INSERT INTO product_attribute_definitions(name,code,data_type,unit,active,sort_order) VALUES(?,?,?,?,1,?)');
  const linkAttribute = db.prepare('INSERT OR IGNORE INTO product_attribute_category_links(attribute_id,category_id) VALUES(?,?)');
  for (const [categoryName, attributes] of Object.entries(categoryTemplates)) {
    const categoryId = db.prepare('SELECT id FROM product_categories WHERE name = ?').get(categoryName)?.id;
    if (!categoryId) continue;
    attributes.forEach(([name, dataType, unit], index) => {
      const code = `PIM-${makeCode(categoryName)}-${makeCode(name)}`;
      let attributeId = findAttribute.get(code)?.id;
      if (!attributeId) attributeId = Number(addAttribute.run(name, code, dataType, unit || null, index + 1).lastInsertRowid);
      linkAttribute.run(attributeId, categoryId);
    });
  }

  const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  const demoDataCleared = db.prepare("SELECT value FROM organization_settings WHERE key='product_demo_data_cleared'").get()?.value === 'true';
  if (!productCount && !demoDataCleared) {
    const categoryIds = Object.fromEntries(db.prepare('SELECT slug, id FROM product_categories').all().map(row => [row.slug, row.id]));
    const products = [
      [categoryIds['dining-chair'], 'CHR-1042', 'Harbor Ash Dining Chair', 'Solid ash frame with commercial-grade joinery.', 'Ash wood / performance upholstery', 35, 'approved'],
      [categoryIds['restaurant-table'], 'TBL-2086', 'Atlas Stone-Top Table', 'Compact hospitality table with sintered stone top.', 'Sintered stone / powder-coated steel', 42, 'approved'],
      [categoryIds['booth-seating'], 'BTH-3018', 'Linework Modular Booth', 'Configurable channel-back booth for restaurant layouts.', 'Plywood / high-density foam / vinyl', 48, 'review'],
      [categoryIds['outdoor-furniture'], 'OUT-4044', 'Pacific Rope Lounge Chair', 'All-weather rope lounge chair for patios.', 'Aluminum / olefin rope', 38, 'draft']
    ];
    const insertProduct = db.prepare("INSERT INTO products (category_id, sku, name, summary, materials, lead_time_days, status, library_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved', ?)");
    for (const product of products) insertProduct.run(...product, adminId);
  }

  const productDetails = [
    ['20.5 × 22 × 32 in', '$95–$135', 50, 'indoor,ash,upholstered', 'CHR-1042'],
    ['30 × 30 × 29.5 in', '$180–$260', 30, 'indoor,sintered-stone,steel', 'TBL-2086'],
    ['Custom by layout', '$320–$480 / linear ft', 10, 'custom,booth,upholstered', 'BTH-3018'],
    ['28 × 31 × 30 in', '$145–$210', 40, 'outdoor,rope,aluminum', 'OUT-4044']
  ];
  const enrichProduct = db.prepare('UPDATE products SET size = COALESCE(size, ?), price_range = COALESCE(price_range, ?), moq = COALESCE(moq, ?), tags = COALESCE(tags, ?) WHERE sku = ?');
  for (const details of productDetails) enrichProduct.run(...details);
  const intelligenceDetails = [
    ['Natural', 'Clear matte', 'Premium', 'Lead with commercial durability, warm ash grain, and easy upholstery customization.', 'CHR-1042'],
    ['Stone / black', 'Powder coated', 'Standard', 'Position as a compact commercial table for flexible restaurant layouts.', 'TBL-2086'],
    ['Custom', 'Contract upholstery', 'Premium', 'Lead with custom sizing, space efficiency, and coordinated upholstery.', 'BTH-3018'],
    ['Sand', 'Outdoor powder coat', 'Premium', 'Recommend for hospitality patios requiring weather-ready construction.', 'OUT-4044']
  ];
  const enrichIntelligence = db.prepare('UPDATE products SET color = COALESCE(color, ?), finish = COALESCE(finish, ?), budget_level = COALESCE(budget_level, ?), sales_notes = COALESCE(sales_notes, ?) WHERE sku = ?');
  for (const details of intelligenceDetails) enrichIntelligence.run(...details);

  const opportunityCount = db.prepare('SELECT COUNT(*) AS count FROM opportunities').get().count;
  if (!opportunityCount) {
    const opportunities = [
      ['Northline Hospitality', 'Emma Walker', 'Austin Flagship Restaurant', 'United States', 'Proposal', 60, 128000, salesId, 'Review finish samples', '2026-07-01'],
      ['Sierra Table Group', 'Noah Davis', 'Three-Site Renovation', 'United States', 'Negotiation', 80, 94000, salesId, 'Confirm freight estimate', '2026-06-30'],
      ['Maison & Marché', 'Sophie Martin', 'Montreal Bistro Collection', 'Canada', 'Qualified', 35, 67000, ownerId, 'Schedule design call', '2026-07-03'],
      ['Pacific Venue Co.', 'Liam Wilson', 'Rooftop Dining Program', 'United States', 'New Lead', 15, 52000, salesId, 'Send discovery email', '2026-07-02'],
      ['Mesa Food Hall', 'Olivia Brown', 'Food Hall Seating Package', 'United States', 'Won', 100, 156000, ownerId, 'Prepare production handoff', '2026-07-05']
    ];
    const insertOpportunity = db.prepare('INSERT INTO opportunities (company_name, contact_name, project_name, market, stage, probability, estimated_value, owner_id, next_action, next_action_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const opportunity of opportunities) insertOpportunity.run(...opportunity);
  }

  const proposalCount = db.prepare('SELECT COUNT(*) AS count FROM proposals').get().count;
  if (!proposalCount) {
    const insertProposal = db.prepare('INSERT INTO proposals (proposal_number, client_name, project_name, market, status, owner_id, valid_until) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertProposal.run('RSP-2026-0148', 'Northline Hospitality', 'Austin Flagship Restaurant', 'United States', 'internal_review', salesId, '2026-07-20');
    insertProposal.run('RSP-2026-0147', 'Sierra Table Group', 'Three-Site Renovation', 'United States', 'sent', salesId, '2026-07-15');
    insertProposal.run('RSP-2026-0146', 'Maison & Marché', 'Montreal Bistro Collection', 'Canada', 'draft', ownerId, '2026-07-22');
  }

  const importCount = db.prepare('SELECT COUNT(*) AS count FROM import_jobs').get().count;
  if (!importCount) {
    const insertImport = db.prepare('INSERT INTO import_jobs (filename, total_rows, imported_rows, error_rows, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertImport.run('outdoor_collection_june.xlsx', 148, 146, 2, 'completed', adminId, '2026-06-27 14:32:00');
    insertImport.run('booth_specs_revision.csv', 64, 64, 0, 'completed', adminId, '2026-06-25 09:16:00');
  }

  const insertKnowledgeTerm = db.prepare('INSERT OR IGNORE INTO product_knowledge_terms (term_type, name, code, sort_order) VALUES (?, ?, ?, ?)');
  for (const [type, names] of Object.entries(knowledgeTermSeeds)) names.forEach((name, index) => insertKnowledgeTerm.run(type, name, makeCode(name), index + 1));

  const caseCount = db.prepare('SELECT COUNT(*) AS count FROM project_cases').get().count;
  if (!caseCount) {
    const insertCase = db.prepare('INSERT INTO project_cases (title, location, venue_type, summary, status, created_by) VALUES (?, ?, ?, ?, ?, ?)');
    insertCase.run('California Coffee Shop', 'San Diego, CA', 'Coffee Shop', 'Warm coastal coffee shop with commercial ash seating.', 'published', adminId);
    insertCase.run('Tokyo Sushi', 'Tokyo, Japan', 'Japanese Restaurant', 'Compact Japandi dining layout for a high-traffic sushi concept.', 'published', adminId);
    insertCase.run('Bakery Cafe', 'Austin, TX', 'Bakery Cafe', 'Flexible bakery cafe seating with easy-clean finishes.', 'published', adminId);
  }

  const mediaCount = db.prepare('SELECT COUNT(*) AS count FROM media_assets').get().count;
  if (!mediaCount) {
    const insertMedia = db.prepare("INSERT INTO media_assets (file_name, file_type, file_url, related_module, related_record_id, media_category, is_verified, image_type, image_status, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, 'Main Image', 'Approved', ?)");
    const chairId = db.prepare("SELECT id FROM products WHERE sku = 'CHR-1042'").get()?.id;
    const boothId = db.prepare("SELECT id FROM products WHERE sku = 'BTH-3018'").get()?.id;
    if (chairId) insertMedia.run('harbor-ash-chair.jpg', 'image/jpeg', '/media/harbor-ash-chair.jpg', 'products', String(chairId), 'Product Photo', adminId);
    if (boothId) insertMedia.run('linework-booth.jpg', 'image/jpeg', '/media/linework-booth.jpg', 'products', String(boothId), 'Product Photo', adminId);
  }

  const knowledgeLinkCount = db.prepare('SELECT COUNT(*) AS count FROM product_knowledge_links').get().count;
  if (!knowledgeLinkCount) {
    const productsBySku = Object.fromEntries(db.prepare('SELECT id, sku FROM products').all().map(row => [row.sku, row.id]));
    const termId = (type, name) => db.prepare('SELECT id FROM product_knowledge_terms WHERE term_type = ? AND name = ?').get(type, name)?.id;
    const addTerm = db.prepare('INSERT OR IGNORE INTO product_knowledge_links (product_id, term_id) VALUES (?, ?)');
    const knowledgeMap = {
      'CHR-1042': { store_type: ['Coffee Shop', 'Restaurant', 'Bakery Cafe'], style: ['California', 'Modern'], feature: ['Commercial Grade', 'Easy Cleaning', 'High Traffic'], customer_type: ['New Store', 'Remodel', 'Design Firm'] },
      'TBL-2086': { store_type: ['Restaurant', 'Coffee Shop', 'Food Court'], style: ['Modern', 'Minimalist'], feature: ['Commercial Grade', 'Easy Cleaning', 'High Traffic'], customer_type: ['New Store', 'Expansion', 'Chain Brand'] },
      'BTH-3018': { store_type: ['Restaurant', 'Bakery Cafe', 'Hotel'], style: ['Japandi', 'Luxury'], feature: ['Custom Upholstery', 'Space Saving', 'AI Recommendation'], customer_type: ['Remodel', 'Design Firm', 'Mature Store'] },
      'OUT-4044': { store_type: ['Coffee Shop', 'Restaurant', 'Hotel'], style: ['California', 'Mediterranean'], feature: ['Outdoor', 'Commercial Grade', 'Easy Cleaning'], customer_type: ['New Store', 'Expansion'] }
    };
    for (const [sku, groups] of Object.entries(knowledgeMap)) for (const [type, names] of Object.entries(groups)) for (const name of names) {
      const id = termId(type, name);
      if (productsBySku[sku] && id) addTerm.run(productsBySku[sku], id);
    }
    const addRelationship = db.prepare("INSERT OR IGNORE INTO product_relationships (source_product_id, target_product_id, relationship_type, recommendation_weight) VALUES (?, ?, 'recommended', ?)");
    if (productsBySku['CHR-1042'] && productsBySku['TBL-2086']) addRelationship.run(productsBySku['CHR-1042'], productsBySku['TBL-2086'], 90);
    if (productsBySku['TBL-2086'] && productsBySku['BTH-3018']) addRelationship.run(productsBySku['TBL-2086'], productsBySku['BTH-3018'], 82);
    if (productsBySku['BTH-3018'] && productsBySku['CHR-1042']) addRelationship.run(productsBySku['BTH-3018'], productsBySku['CHR-1042'], 78);
    const casesByTitle = Object.fromEntries(db.prepare('SELECT id, title FROM project_cases').all().map(row => [row.title, row.id]));
    const addCase = db.prepare('INSERT OR IGNORE INTO product_case_links (product_id, case_id) VALUES (?, ?)');
    if (productsBySku['CHR-1042'] && casesByTitle['California Coffee Shop']) addCase.run(productsBySku['CHR-1042'], casesByTitle['California Coffee Shop']);
    if (productsBySku['BTH-3018'] && casesByTitle['Tokyo Sushi']) addCase.run(productsBySku['BTH-3018'], casesByTitle['Tokyo Sushi']);
    if (productsBySku['TBL-2086'] && casesByTitle['Bakery Cafe']) addCase.run(productsBySku['TBL-2086'], casesByTitle['Bakery Cafe']);
    const addMedia = db.prepare('INSERT OR IGNORE INTO product_media_links (product_id, media_id, is_primary) VALUES (?, ?, 1)');
    for (const media of db.prepare("SELECT id, related_record_id FROM media_assets WHERE related_module = 'products'").all()) if (Number(media.related_record_id)) addMedia.run(Number(media.related_record_id), media.id);
    const addKeyword = db.prepare('INSERT OR IGNORE INTO product_keywords (product_id, keyword_type, keyword) VALUES (?, ?, ?)');
    for (const [sku, words] of Object.entries({ 'CHR-1042': ['commercial chair', 'california cafe', 'ash seating'], 'TBL-2086': ['stone top', 'restaurant table'], 'BTH-3018': ['modular booth', 'japandi seating'], 'OUT-4044': ['outdoor lounge', 'weather resistant'] })) for (const word of words) if (productsBySku[sku]) {
      addKeyword.run(productsBySku[sku], 'ai', word);
      addKeyword.run(productsBySku[sku], 'search', word);
    }
  }

  const knowledgeEnrichment = [
    ['Commercial ash dining chair for high-traffic hospitality interiors.', 88, 'Prioritize for California cafes and modern restaurant briefs.', 'Verify upholstery finish before proposal use.', 'Recommend this chair when the brief needs durable commercial seating with a warm natural finish.', 'CHR-1042'],
    ['Compact stone-top restaurant table engineered for commercial service.', 84, 'Pair with ash chairs or modular booths.', 'Confirm base finish and freight packing.', 'Use for modern, minimalist, and high-traffic restaurant layouts.', 'TBL-2086'],
    ['Configurable upholstered booth system for space-efficient restaurant planning.', 92, 'Strong fit for Japandi and premium remodel projects.', 'Requires layout dimensions before quoting.', 'Recommend for custom banquette layouts where space saving and upholstery flexibility matter.', 'BTH-3018'],
    ['All-weather rope lounge chair for hospitality patios and terraces.', 80, 'Prioritize for outdoor and Mediterranean concepts.', 'Confirm fabric color and UV specification.', null, 'OUT-4044']
  ];
  const enrichKnowledge = db.prepare('UPDATE products SET ai_summary = COALESCE(ai_summary, ?), ai_recommendation_weight = COALESCE(ai_recommendation_weight, ?), ai_notes = COALESCE(ai_notes, ?), internal_notes = COALESCE(internal_notes, ?), knowledge_prompt = COALESCE(knowledge_prompt, ?) WHERE sku = ?');
  for (const row of knowledgeEnrichment) enrichKnowledge.run(...row);
}

function makeCode(value) {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function json(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 30_000_000) throw new Error('Request body too large');
  }
  return body ? JSON.parse(body) : {};
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    businessRole: String(row.email).toLowerCase() === 'salesadmin@rspro.ai' ? 'Sales Admin' : row.role,
    initials: row.initials,
    permissions: rolePermissions[row.role] || []
  };
}

function currentUser(req) {
  const sessionId = parseCookies(req).rsp_session;
  if (!sessionId) return null;
  return db.prepare(`
    SELECT users.id, users.name, users.email, users.role, users.initials
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP AND users.status = 'active'
  `).get(sessionId) || null;
}

function requires(user, permission) {
  return Boolean(user && rolePermissions[user.role]?.includes(permission));
}

function masterValues(type, fallback = []) {
  if (fallback === variantStatuses) return [...variantStatuses];
  const rows = db.prepare('SELECT name FROM system_configs WHERE config_type=? AND active=1 ORDER BY sort_order,name').all(type).map(row=>row.name);
  return rows.length ? rows : [...fallback];
}

function ensureProductMasterDataColumns() {
  const ensure = (table, columns) => {
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
    for (const [name,type] of Object.entries(columns)) if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  };
  ensure('product_categories',{active:'INTEGER NOT NULL DEFAULT 1',sort_order:'INTEGER NOT NULL DEFAULT 0',updated_at:'TEXT'});
  ensure('system_tags',{sort_order:'INTEGER NOT NULL DEFAULT 0'});
  ensure('product_attribute_definitions',{show_in_library:'INTEGER NOT NULL DEFAULT 1',show_on_website:'INTEGER NOT NULL DEFAULT 0',show_in_quote:'INTEGER NOT NULL DEFAULT 0',show_in_pi:'INTEGER NOT NULL DEFAULT 0',internal_only:'INTEGER NOT NULL DEFAULT 0'});
  db.exec('CREATE INDEX IF NOT EXISTS idx_product_categories_active_sort ON product_categories(active,sort_order,name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_system_tags_group_sort ON system_tags(tag_type,active,sort_order,tag_name)');
  db.prepare('INSERT OR IGNORE INTO product_attribute_category_links(attribute_id,category_id) SELECT id,category_id FROM product_attribute_definitions WHERE category_id IS NOT NULL').run();
}

function ensurePimFoundationColumns() {
  const ensure = (table, columns) => {
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
    for (const [name, type] of Object.entries(columns)) if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  };
  ensure('products', { default_supplier:'TEXT', supplier_sku:'TEXT', supplier_cost:'REAL', supplier_lead_time_days:'INTEGER', supplier_moq:'REAL', supplier_notes:'TEXT' });
  ensure('product_variants', { material:'TEXT', finish:'TEXT', color:'TEXT', moq:'REAL', lead_time_days:'INTEGER', cbm:'REAL', gross_weight_kg:'REAL', net_weight_kg:'REAL', packing_info:'TEXT', default_supplier:'TEXT', supplier_sku:'TEXT', supplier_cost:'REAL', supplier_lead_time_days:'INTEGER', supplier_moq:'REAL', supplier_notes:'TEXT' });
  ensure('media_assets', { variant_id:'INTEGER', document_type:'TEXT' });
  ensure('sales_quote_items', { product_snapshot:'TEXT' });
  db.exec('CREATE INDEX IF NOT EXISTS idx_media_assets_product_variant ON media_assets(related_module, related_record_id, variant_id)');
}

function ensureProductBusinessReadinessColumns(){
  const ensure=(table,columns)=>{const existing=new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column=>column.name));for(const [name,type] of Object.entries(columns))if(!existing.has(name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)};
  ensure('product_import_batches',{supplier_code:'TEXT',started_at:'TEXT',completed_at:'TEXT'});
  const auditColumns={source_supplier:'TEXT',source_file:'TEXT',source_sheet:'TEXT',source_row:'INTEGER',import_batch_id:'INTEGER',imported_at:'TEXT',imported_by:'INTEGER',last_updated_by:'INTEGER'};
  ensure('products',auditColumns);ensure('product_variants',auditColumns);
  db.exec('CREATE INDEX IF NOT EXISTS idx_products_import_batch ON products(import_batch_id,imported_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_variants_import_batch ON product_variants(import_batch_id,imported_at)');
}

function ensureProductPriceEngineColumns(){
  const ensure=(table,columns)=>{const existing=new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column=>column.name));for(const [name,type] of Object.entries(columns))if(!existing.has(name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)};
  ensure('product_variants',{supplier_currency:'TEXT',exchange_rate:'REAL',converted_cost:'REAL',pricing_rule_id:'INTEGER',pricing_status:"TEXT NOT NULL DEFAULT 'Needs Pricing Review'",pricing_confidence:'INTEGER',price_manual_override:'INTEGER NOT NULL DEFAULT 0',price_override_by:'INTEGER',price_override_at:'TEXT'});
  ensure('sales_quote_items',{pricing_source:"TEXT NOT NULL DEFAULT 'Reference'",reference_price_snapshot:'REAL',cost_snapshot:'REAL',cost_currency_snapshot:'TEXT',final_selling_price_snapshot:'REAL'});
  db.exec('CREATE INDEX IF NOT EXISTS idx_price_rules_match ON product_price_rules(active,effective_date,supplier_name,category_id,currency)');
}

function canManageProductLibrary(user) {
  return Boolean(user && (['Admin', 'Owner'].includes(user.role) || String(user.email).toLowerCase() === 'salesadmin@rspro.ai'));
}

const sensitiveProductFields=new Set(['default_supplier','supplier_sku','supplier_cost','supplier_currency','supplier_moq','supplier_lead_time_days','supplier_notes','cost_price','converted_cost','converted_cost_currency','exchange_rate','pricing_rule_id','pricing_rule','multiplier','fixed_addon','minimum_margin','purchase_cost_history','profit','profit_margin','source_supplier','cost_snapshot','cost_currency_snapshot']);
function canViewSensitiveProductData(user){return Boolean(user&&['Admin','Owner','General Manager','Purchasing'].includes(user.role))}
function redactSensitiveProductData(value,user){if(canViewSensitiveProductData(user)||value==null)return value;if(Array.isArray(value))return value.map(item=>redactSensitiveProductData(item,user));if(typeof value!=='object')return value;const result={};for(const [key,item] of Object.entries(value)){if(sensitiveProductFields.has(key))continue;if(key==='supplier')continue;result[key]=redactSensitiveProductData(item,user)}return result}
function redactImportBatch(batch,user){if(!batch)return batch;const result=redactSensitiveProductData(batch,user);if(!canViewSensitiveProductData(user))for(const key of ['supplier_name','supplier_code','supplier_contact','supplier_country','supplier_currency','exchange_rate','import_remark'])delete result[key];return result}

const pricingRoundingRules=Object.freeze(['No rounding','Round to nearest 1','Round to nearest 5','Round to nearest 10','End with .90','End with .99']);
function roundReferencePrice(value,rule){const amount=Number(value);if(rule==='Round to nearest 1')return Math.round(amount);if(rule==='Round to nearest 5')return Math.round(amount/5)*5;if(rule==='Round to nearest 10')return Math.round(amount/10)*10;if(rule==='End with .90')return Math.floor(amount)+.9;if(rule==='End with .99')return Math.floor(amount)+.99;return Math.round(amount*100)/100}
function matchingPriceRule({supplier,categoryId,currency='USD'}){return db.prepare(`SELECT * FROM product_price_rules WHERE active=1 AND effective_date<=CURRENT_DATE AND currency=? AND (supplier_name IS NULL OR LOWER(supplier_name)=LOWER(?)) AND (category_id IS NULL OR category_id=?) ORDER BY CASE WHEN supplier_name IS NOT NULL AND category_id IS NOT NULL THEN 1 WHEN supplier_name IS NOT NULL THEN 2 WHEN category_id IS NOT NULL THEN 3 ELSE 4 END,effective_date DESC,id DESC LIMIT 1`).get(currency,String(supplier||''),Number(categoryId)||0)}
function calculateReferencePrice({supplierCost,supplierCurrency='USD',exchangeRate=1,supplier,categoryId,currency='USD'}){const cost=Number(supplierCost);if(!Number.isFinite(cost)||cost<0)return {reference_price:null,converted_cost:null,pricing_status:'Needs Pricing Review',pricing_confidence:0,rule:null};const rate=Number(exchangeRate)||1,converted=supplierCurrency===currency?cost:cost/rate,rule=matchingPriceRule({supplier,categoryId,currency});if(!rule)return {reference_price:null,converted_cost:Math.round(converted*100)/100,pricing_status:'Needs Pricing Review',pricing_confidence:40,rule:null};const raw=converted*Number(rule.multiplier)+Number(rule.fixed_addon||0);return {reference_price:roundReferencePrice(raw,rule.rounding_rule),converted_cost:Math.round(converted*100)/100,pricing_status:'Calculated',pricing_confidence:rule.supplier_name&&rule.category_id?100:rule.supplier_name?90:rule.category_id?80:70,rule}}

function audit(userId, action, entityType, entityId = null, metadata = null) {
  db.prepare('INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?)')
    .run(userId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null);
}

function foundationCapabilities(user) {
  const editor = ['Admin', 'Owner'].includes(user?.role);
  return {
    canEditConfigs: editor,
    canEditTags: editor,
    canViewMedia: ['Admin', 'Owner', 'Designer'].includes(user?.role),
    canEditMedia: editor,
    canViewPrompts: ['Admin', 'Owner'].includes(user?.role),
    canEditPrompts: editor
  };
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) {
    const error = new Error(`${field} is required.`);
    error.status = 400;
    throw error;
  }
  return text;
}

function normalizeUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function customerSourceValue(input = {}, fallbackSource = 'Manual Import') {
  const explicit = String(input.customer_source || '').trim();
  const sourceEvidence = [
    input.source,
    fallbackSource,
    input.google_maps_url,
    input.source_url
  ].map(value => String(value || '').toLowerCase()).join(' ');
  const hasGoogleMapsEvidence = (
    sourceEvidence.includes('google maps')
    || sourceEvidence.includes('google_maps')
    || sourceEvidence.includes('googlemaps')
    || sourceEvidence.includes('google.com/maps')
    || sourceEvidence.includes('maps.app.goo.gl')
    || sourceEvidence.includes('goo.gl/maps')
    || sourceEvidence.includes('g.page')
  );
  if (hasGoogleMapsEvidence) return 'Google Maps';
  if (['AI Discovery', 'Search Result', 'Manual Import', 'Website Import', 'Website', 'Google Maps', 'Instagram', 'Facebook', 'Existing Customer'].includes(explicit)) return explicit;
  const source = String(input.source || fallbackSource || '').toLowerCase();
  if (source.includes('instagram')) return 'Instagram';
  if (source.includes('facebook')) return 'Facebook';
  if (source.includes('website')) return 'Website';
  if (source.includes('discovery')) return 'AI Discovery';
  if (source.includes('search result')) return 'Search Result';
  return 'Manual Import';
}

function allowedType(value, values, field) {
  const text = requiredText(value, field);
  if (!values.includes(text)) {
    const error = new Error(`${field} is not supported.`);
    error.status = 400;
    throw error;
  }
  return text;
}

function activeValue(value, fallback = 1) {
  return value === undefined ? fallback : (value === true || value === 1 || value === '1' ? 1 : 0);
}

function foundationRecord(table, id) {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

function handleConstraint(error) {
  if (error?.code === '23505' || String(error?.message).includes('UNIQUE constraint failed')) {
    error.status = 409;
    error.message = 'Name or code already exists.';
  }
  throw error;
}

function productReadiness(product) {
  const checks = {
    basicInformation: Boolean(product.name && product.sku && product.category_id && product.materials && product.size && product.color && product.finish),
    images: Number(product.main_image_count || 0) > 0,
    commercialTerms: Boolean(product.price_range && Number(product.moq) > 0 && Number(product.lead_time_days) > 0),
    aiTags: Array.isArray(product.ai_tags) && product.ai_tags.length > 0,
    salesNotes: Boolean(String(product.sales_notes || '').trim())
  };
  const score = Object.values(checks).filter(Boolean).length * 20;
  return { score, status: score >= 80 ? 'Proposal Ready' : 'Needs Review', checks };
}

function productWithTags(id) {
  const product = db.prepare(`
    SELECT products.*, product_categories.name AS category, pib.source_file_name AS import_batch_file,
      imported_user.name AS imported_by_name, updated_user.name AS last_updated_by_name
    FROM products LEFT JOIN product_categories ON product_categories.id = products.category_id
    LEFT JOIN product_import_batches pib ON pib.id=products.import_batch_id
    LEFT JOIN users imported_user ON imported_user.id=products.imported_by
    LEFT JOIN users updated_user ON updated_user.id=products.last_updated_by
    WHERE products.id = ?
  `).get(id);
  if (!product) return null;
  product.tag_ids = db.prepare('SELECT tag_id FROM product_tag_links WHERE product_id = ? ORDER BY tag_id').all(id).map(row => row.tag_id);
  product.tag_names = db.prepare(`
    SELECT system_tags.tag_name FROM product_tag_links
    JOIN system_tags ON system_tags.id = product_tag_links.tag_id
    WHERE product_tag_links.product_id = ? ORDER BY system_tags.tag_type, system_tags.tag_name
  `).all(id).map(row => row.tag_name);
  const knowledgeTerms = db.prepare(`
    SELECT product_knowledge_terms.id, product_knowledge_terms.term_type, product_knowledge_terms.name
    FROM product_knowledge_links JOIN product_knowledge_terms ON product_knowledge_terms.id = product_knowledge_links.term_id
    WHERE product_knowledge_links.product_id = ? ORDER BY product_knowledge_terms.term_type, product_knowledge_terms.sort_order, product_knowledge_terms.name
  `).all(id);
  product.knowledge_term_ids = knowledgeTerms.map(row => row.id);
  product.knowledge = Object.fromEntries(Object.keys(knowledgeTermSeeds).map(type => [type, knowledgeTerms.filter(row => row.term_type === type).map(row => row.name)]));
  product.related_count = db.prepare("SELECT COUNT(*) AS count FROM product_relationships WHERE source_product_id = ? AND relationship_type = 'recommended'").get(id).count;
  product.case_count = db.prepare('SELECT COUNT(*) AS count FROM product_case_links WHERE product_id = ?').get(id).count;
  product.media_count = db.prepare('SELECT COUNT(*) AS count FROM product_media_links WHERE product_id = ?').get(id).count;
  product.main_image_url = db.prepare("SELECT ma.file_url FROM product_media_links pml JOIN media_assets ma ON ma.id=pml.media_id WHERE pml.product_id=? AND ma.image_status!='Rejected' ORDER BY pml.is_primary DESC,CASE WHEN ma.image_type='Main Image' THEN 0 ELSE 1 END,pml.sort_order LIMIT 1").get(id)?.file_url||null;
  const variantPricing=db.prepare("SELECT MIN(reference_price) AS minimum,MAX(reference_price) AS maximum,COUNT(reference_price) AS priced FROM product_variants WHERE product_id=? AND status='Active' AND reference_price IS NOT NULL").get(id);product.reference_price=variantPricing?.minimum??null;product.reference_price_max=variantPricing?.maximum??null;product.reference_price_display=variantPricing?.priced?(variantPricing.minimum===variantPricing.maximum?`USD ${Number(variantPricing.minimum).toFixed(2)}`:`USD ${Number(variantPricing.minimum).toFixed(2)} - ${Number(variantPricing.maximum).toFixed(2)}`):(product.price_range||'Request Quote');
  product.variant_count = Number(db.prepare('SELECT COUNT(*) AS count FROM product_variants WHERE product_id=?').get(id).count);
  product.main_image_count = db.prepare("SELECT COUNT(*) AS count FROM product_media_links pml JOIN media_assets ma ON ma.id = pml.media_id WHERE pml.product_id = ? AND (pml.is_primary = 1 OR ma.image_type = 'Main Image') AND ma.image_status != 'Rejected'").get(id).count;
  product.ai_tags = db.prepare("SELECT keyword FROM product_keywords WHERE product_id = ? AND keyword_type = 'ai' ORDER BY keyword").all(id).map(row => row.keyword);
  product.product_readiness = productReadiness(product);
  product.product_readiness_score = product.product_readiness.score;
  product.proposal_ready_status = product.product_readiness.status;
  product.knowledge_score = knowledgeScore(product);
  return product;
}

function syncProductReadiness(id) {
  const product = productWithTags(id);
  if (!product) return null;
  db.prepare('UPDATE products SET proposal_ready_status = ? WHERE id = ?').run(product.proposal_ready_status, id);
  return product;
}

function refreshProductReadiness() {
  for (const row of db.prepare('SELECT id FROM products').all()) syncProductReadiness(row.id);
}

function knowledgeScore(product) {
  return (product.media_count ? 20 : 0) + (product.size ? 15 : 0) + (product.materials ? 15 : 0) +
    (product.case_count ? 15 : 0) + (product.related_count ? 15 : 0) + (product.knowledge_prompt ? 20 : 0);
}

function productKnowledge(id) {
  const product = productWithTags(id);
  if (!product) return null;
  product.recommended_products = db.prepare(`
    SELECT products.id, products.sku, products.name, product_categories.name AS category, product_relationships.recommendation_weight
    FROM product_relationships JOIN products ON products.id = product_relationships.target_product_id
    LEFT JOIN product_categories ON product_categories.id = products.category_id
    WHERE product_relationships.source_product_id = ? AND product_relationships.relationship_type = 'recommended'
    ORDER BY product_relationships.recommendation_weight DESC, products.name
  `).all(id);
  product.ai_related_products = db.prepare(`
    SELECT products.id, products.sku, products.name, product_relationships.recommendation_weight
    FROM product_relationships JOIN products ON products.id = product_relationships.target_product_id
    WHERE product_relationships.source_product_id = ? AND product_relationships.relationship_type = 'ai_related'
    ORDER BY product_relationships.recommendation_weight DESC, products.name
  `).all(id);
  product.related_cases = db.prepare(`
    SELECT project_cases.* FROM product_case_links JOIN project_cases ON project_cases.id = product_case_links.case_id
    WHERE product_case_links.product_id = ? ORDER BY project_cases.title
  `).all(id);
  product.media = db.prepare(`
    SELECT media_assets.*, product_media_links.is_primary, product_media_links.sort_order
    FROM product_media_links JOIN media_assets ON media_assets.id = product_media_links.media_id
    WHERE product_media_links.product_id = ? ORDER BY product_media_links.is_primary DESC, product_media_links.sort_order, media_assets.file_name
  `).all(id);
  product.related_categories = db.prepare(`
    SELECT product_categories.id, product_categories.name
    FROM product_related_category_links JOIN product_categories ON product_categories.id = product_related_category_links.category_id
    WHERE product_related_category_links.product_id = ? ORDER BY product_categories.name
  `).all(id);
  const keywordRows = db.prepare('SELECT keyword_type, keyword FROM product_keywords WHERE product_id = ? ORDER BY keyword_type, keyword').all(id);
  product.ai_keywords = product.ai_tags;
  product.ai_search_keywords = keywordRows.filter(row => row.keyword_type === 'search').map(row => row.keyword);
  product.missing_knowledge = [!product.media_count && 'media', !product.size && 'size', !product.materials && 'material', !product.case_count && 'cases', !product.related_count && 'related_products', !product.knowledge_prompt && 'prompt'].filter(Boolean);
  return product;
}

function knowledgeOptions(productId = 0) {
  return {
    terms: db.prepare('SELECT id, term_type, name FROM product_knowledge_terms WHERE active = 1 ORDER BY term_type, sort_order, name').all(),
    products: db.prepare('SELECT id, sku, name FROM products WHERE id != ? AND status != ? ORDER BY name').all(productId, 'archived'),
    cases: db.prepare("SELECT id, title, location, venue_type FROM project_cases WHERE status = 'published' ORDER BY title").all(),
    media: db.prepare("SELECT id, file_name, media_category, image_type, image_status FROM media_assets WHERE active = 1 ORDER BY file_name").all(),
    categories: db.prepare('SELECT id, name FROM product_categories ORDER BY name').all(),
    budgetLevels,
    imageTypes: productImageTypes,
    imageStatuses: productImageStatuses,
    libraryStatuses: productLibraryStatuses,
    visibilities: productVisibilities,
    variantStatuses: masterValues('Product Status Options',variantStatuses),
    masterData:{materials:masterValues('Materials'),finishes:masterValues('Finishes'),colors:masterValues('Colors'),units:masterValues('Units'),currencies:masterValues('Currencies'),tradeTerms:masterValues('Trade Terms'),visibilities:masterValues('Visibility Options',productVisibilities),productStatuses:masterValues('Product Status Options',productLibraryStatuses)}
  };
}

function productFoundation(id) {
  const categoryId=db.prepare('SELECT category_id FROM products WHERE id=?').get(id)?.category_id;
  const definitions=attributeMasterRows().filter(attribute=>!attribute.category_ids.length||attribute.category_ids.includes(Number(categoryId)));
  return {
    variants: db.prepare(`SELECT pv.*,pib.source_file_name AS import_batch_file,iu.name AS imported_by_name,uu.name AS last_updated_by_name
      FROM product_variants pv LEFT JOIN product_import_batches pib ON pib.id=pv.import_batch_id
      LEFT JOIN users iu ON iu.id=pv.imported_by LEFT JOIN users uu ON uu.id=pv.last_updated_by
      WHERE pv.product_id=? ORDER BY pv.sort_order,pv.id`).all(id),
    attributeDefinitions: definitions.filter(attribute=>Number(attribute.active)===1),
    attributeValues: db.prepare('SELECT pav.*,pad.name,pad.code,pad.unit,pv.variant_name FROM product_attribute_values pav JOIN product_attribute_definitions pad ON pad.id=pav.attribute_id LEFT JOIN product_variants pv ON pv.id=pav.variant_id WHERE pav.product_id=? ORDER BY pad.sort_order,pad.name,pv.sort_order').all(id),
    relatedProducts: db.prepare("SELECT p.id,p.sku,p.name FROM product_foundation_relationships pfr JOIN products p ON p.id=pfr.target_product_id WHERE pfr.source_product_id=? AND pfr.relationship_type='related' ORDER BY pfr.sort_order,p.name").all(id),
    frequentlyBoughtTogether: db.prepare("SELECT p.id,p.sku,p.name FROM product_foundation_relationships pfr JOIN products p ON p.id=pfr.target_product_id WHERE pfr.source_product_id=? AND pfr.relationship_type='frequently_bought_together' ORDER BY pfr.sort_order,p.name").all(id)
  };
}

function productQualitySummary(product) {
  const readiness = product.product_readiness || productReadiness(product);
  const missing = [];
  if (!readiness.checks.basicInformation) {
    for (const [field, value] of Object.entries({
      name: product.name,
      sku: product.sku,
      category: product.category_id,
      material: product.materials,
      size: product.size,
      color: product.color,
      finish: product.finish
    })) if (!value) missing.push(field);
  }
  if (!readiness.checks.images) missing.push('main_image');
  if (!readiness.checks.commercialTerms) {
    if (!product.price_range && product.reference_price == null) missing.push('price');
    if (!(Number(product.moq) > 0)) missing.push('moq');
    if (!(Number(product.lead_time_days) > 0)) missing.push('lead_time');
  }
  if (!readiness.checks.aiTags) missing.push('ai_tags');
  if (!readiness.checks.salesNotes) missing.push('sales_notes');
  for (const item of product.missing_knowledge || []) if (!missing.includes(item)) missing.push(item);
  const aiFields = [product.ai_summary, product.product_keywords, product.llm_summary, product.faq, product.buying_guide, product.sales_talking_points].filter(value => String(value || '').trim()).length;
  return {
    score: readiness.score,
    status: readiness.status,
    checks: readiness.checks,
    missing_fields: missing,
    data_quality: readiness.score,
    ai_readiness: {
      score: Math.round((aiFields / 6) * 100),
      has_ai_summary: Boolean(String(product.ai_summary || '').trim()),
      has_ai_keywords: Array.isArray(product.ai_tags) && product.ai_tags.length > 0,
      has_sales_content: Boolean(String(product.sales_talking_points || product.sales_notes || '').trim()),
      has_customer_facing_content: Boolean(String(product.english_description || product.short_sales_description || '').trim())
    }
  };
}

function productIntelligenceAiProfile(product) {
  return {
    ai_summary: product.ai_summary || null,
    ai_keywords: product.ai_keywords || product.ai_tags || [],
    ai_search_keywords: product.ai_search_keywords || [],
    ai_recommendation_weight: product.ai_recommendation_weight ?? null,
    product_keywords: product.product_keywords || null,
    suitable_store_types: product.knowledge?.store_type || [],
    suitable_styles: product.knowledge?.style || [],
    features: product.knowledge?.feature || [],
    target_customers: product.knowledge?.customer_type || [],
    selling_points: product.sales_talking_points || product.advantages || null,
    application_scenarios: product.use_cases || product.recommended_usage || null,
    best_for: product.best_for || null,
    not_recommended_for: product.not_recommended_for || null,
    faq: product.faq || null,
    buying_guide: product.buying_guide || null,
    proposal_usage_notes: product.proposal_usage_notes || null
  };
}

function productPricingSummary(product, foundation) {
  const variants = (foundation?.variants || []).map(variant => ({
    id: variant.id,
    variant_name: variant.variant_name,
    variant_sku: variant.variant_sku,
    reference_price: variant.reference_price,
    recommended_selling_price: variant.reference_price,
    selling_currency: 'USD',
    pricing_status: variant.pricing_status || null,
    pricing_confidence: variant.pricing_confidence ?? null,
    price_manual_override: Boolean(variant.price_manual_override),
    supplier_cost: variant.supplier_cost ?? variant.cost_price ?? null,
    supplier_currency: variant.supplier_currency || null,
    converted_cost: variant.converted_cost ?? null,
    converted_cost_currency: 'USD',
    exchange_rate: variant.exchange_rate ?? null,
    pricing_rule_id: variant.pricing_rule_id ?? null,
    updated_at: variant.updated_at || null
  }));
  const prices = variants.map(variant => Number(variant.reference_price)).filter(Number.isFinite);
  const hasManualOverride = variants.some(variant => variant.price_manual_override);
  const missingCost = variants.length > 0 && variants.some(variant => variant.supplier_cost == null);
  const needsReview = variants.some(variant => variant.pricing_status === 'Needs Pricing Review');
  const status = hasManualOverride ? 'Manual Override' : missingCost ? 'Missing Cost' : needsReview ? 'Needs Pricing Review' : (prices.length ? 'Ready' : 'Missing Price');
  return {
    price_range: product.price_range || null,
    reference_price_min: prices.length ? Math.min(...prices) : product.reference_price ?? null,
    reference_price_max: prices.length ? Math.max(...prices) : product.reference_price_max ?? product.reference_price ?? null,
    reference_price_display: product.reference_price_display || product.price_range || 'Request Quote',
    selling_currency: 'USD',
    variants,
    priced_variant_count: prices.length,
    pricing_status: status
  };
}

function productIntelligenceSourceInformation(product, foundation, user) {
  if (!canViewSensitiveProductData(user)) return null;
  return {
    source_supplier: product.source_supplier || product.default_supplier || null,
    source_file: product.source_file || product.import_batch_file || null,
    source_sheet: product.source_sheet || null,
    source_row: product.source_row ?? null,
    import_batch_id: product.import_batch_id ?? null,
    imported_at: product.imported_at || null,
    imported_by: product.imported_by_name || null,
    last_updated_by: product.last_updated_by_name || null,
    variants: (foundation?.variants || []).map(variant => ({
      id: variant.id,
      variant_name: variant.variant_name,
      source_supplier: variant.source_supplier || variant.default_supplier || null,
      source_file: variant.source_file || variant.import_batch_file || null,
      source_sheet: variant.source_sheet || null,
      source_row: variant.source_row ?? null,
      import_batch_id: variant.import_batch_id ?? null,
      imported_at: variant.imported_at || null,
      imported_by: variant.imported_by_name || null,
      last_updated_by: variant.last_updated_by_name || null
    }))
  };
}

function productIntelligenceListItem(product, user) {
  const quality = productQualitySummary(product);
  const pricing = productPricingSummary(product, productFoundation(product.id));
  return redactSensitiveProductData({
    id: product.id,
    image: product.main_image_url || null,
    main_image_url: product.main_image_url || null,
    product_name: product.name,
    name: product.name,
    sku: product.sku,
    category: product.category || null,
    category_id: product.category_id || null,
    variant_count: product.variant_count ?? 0,
    status: product.library_status || product.status || null,
    library_status: product.library_status || null,
    visibility: product.visibility || null,
    ai_confidence: product.ai_recommendation_weight ?? null,
    data_quality: quality.data_quality,
    data_quality_status: quality.status,
    missing_fields: quality.missing_fields,
    product_readiness_score: quality.score,
    proposal_ready_status: product.proposal_ready_status,
    ai_readiness_score: quality.ai_readiness.score,
    ai_readiness_status: quality.ai_readiness.score >= 80 ? 'AI Ready' : 'Needs AI Data',
    pricing_status: pricing.pricing_status,
    reference_price_display: pricing.reference_price_display,
    reference_price_min: pricing.reference_price_min,
    reference_price_max: pricing.reference_price_max,
    priced_variant_count: pricing.priced_variant_count,
    updated_at: product.updated_at
  }, user);
}

function productIntelligenceDetailData(id, user) {
  const product = productKnowledge(id);
  if (!product) return null;
  const foundation = productFoundation(id);
  const quality = productQualitySummary(product);
  const payload = {
    basic_information: {
      id: product.id,
      product_name: product.name,
      name: product.name,
      sku: product.sku,
      category_id: product.category_id,
      category: product.category || null,
      main_image: product.main_image_url || null,
      main_image_url: product.main_image_url || null,
      status: product.library_status || product.status || null,
      library_status: product.library_status || null,
      visibility: product.visibility || null,
      summary: product.summary || product.short_description || null,
      material: product.materials || null,
      size: product.size || null,
      color: product.color || null,
      finish: product.finish || null,
      updated_at: product.updated_at
    },
    attributes: {
      definitions: foundation.attributeDefinitions,
      values: foundation.attributeValues
    },
    variants: foundation.variants,
    media: product.media || [],
    pricing_summary: productPricingSummary(product, foundation),
    ai_profile: productIntelligenceAiProfile(product),
    source_information: productIntelligenceSourceInformation(product, foundation, user),
    quality,
    relationships: {
      recommended_products: product.recommended_products || [],
      ai_related_products: product.ai_related_products || [],
      related_cases: product.related_cases || [],
      related_categories: product.related_categories || [],
      related_products: foundation.relatedProducts,
      frequently_bought_together: foundation.frequentlyBoughtTogether
    }
  };
  return redactSensitiveProductData(payload, user);
}

function productIntelligenceContextData(id, user) {
  const detail = productIntelligenceDetailData(id, user);
  if (!detail) return null;
  const context = {
    product: detail.basic_information,
    attributes: detail.attributes.values.map(value => ({
      name: value.name,
      code: value.code,
      value: value.value,
      variant_id: value.variant_id || null,
      variant_name: value.variant_name || null
    })),
    variants: detail.variants.map(variant => ({
      id: variant.id,
      variant_name: variant.variant_name,
      variant_sku: variant.variant_sku,
      dimensions: variant.dimensions,
      material: variant.material,
      finish: variant.finish,
      color: variant.color,
      reference_price: variant.reference_price,
      pricing_status: variant.pricing_status || null,
      status: variant.status
    })),
    media: detail.media.map(media => ({
      id: media.id,
      file_url: media.file_url,
      image_type: media.image_type,
      image_status: media.image_status,
      is_primary: Boolean(media.is_primary)
    })),
    knowledge: {
      ai_profile: detail.ai_profile,
      relationships: detail.relationships,
      quality: detail.quality
    },
    usage_contract: {
      source_of_truth: 'Product Library / Product Intelligence Center',
      allowed_for: ['AI recommendation', 'Quote Builder', 'PI Builder', 'Sales Assistant'],
      restrictions: ['AI may suggest only', 'Do not overwrite Product Library without approval', 'Do not change pricing outside Product Price Engine']
    }
  };
  return redactSensitiveProductData(context, user);
}

function attributeMasterRows(){return db.prepare('SELECT * FROM product_attribute_definitions ORDER BY sort_order,name').all().map(attribute=>({...attribute,category_ids:db.prepare('SELECT category_id FROM product_attribute_category_links WHERE attribute_id=? ORDER BY category_id').all(attribute.id).map(row=>Number(row.category_id)),options:db.prepare('SELECT * FROM product_attribute_options WHERE attribute_id=? ORDER BY sort_order,option_value').all(attribute.id)}))}
function syncAttributeMaster(attributeId,body){if(Array.isArray(body.category_ids)){db.prepare('DELETE FROM product_attribute_category_links WHERE attribute_id=?').run(attributeId);const insert=db.prepare('INSERT INTO product_attribute_category_links(attribute_id,category_id) VALUES(?,?)');normalizedIds(body.category_ids).forEach(categoryId=>insert.run(attributeId,categoryId))}if(Array.isArray(body.options)){db.prepare('DELETE FROM product_attribute_options WHERE attribute_id=?').run(attributeId);const insert=db.prepare('INSERT INTO product_attribute_options(attribute_id,option_value,active,sort_order) VALUES(?,?,?,?)');body.options.map(option=>typeof option==='string'?{option_value:option}:option).filter(option=>String(option.option_value||'').trim()).forEach((option,index)=>insert.run(attributeId,String(option.option_value).trim(),option.active===false?0:1,Number(option.sort_order??index)))}}

function knowledgeDashboardData() {
  const products = db.prepare('SELECT id FROM products WHERE status != ? ORDER BY updated_at DESC').all('archived').map(row => productKnowledge(row.id));
  const total = products.length;
  const average = total ? Math.round(products.reduce((sum, product) => sum + product.knowledge_score, 0) / total) : 0;
  return {
    metrics: {
      knowledgeScore: average,
      productCount: total,
      missingImages: products.filter(product => !product.media_count).length,
      missingSizes: products.filter(product => !product.size).length,
      missingCases: products.filter(product => !product.case_count).length
    },
    top: [...products].sort((a, b) => b.knowledge_score - a.knowledge_score || a.name.localeCompare(b.name)).slice(0, 100),
    incomplete: products.filter(product => product.knowledge_score < 100).sort((a, b) => a.knowledge_score - b.knowledge_score)
  };
}

function productIntelligenceDashboardData() {
  const products = db.prepare("SELECT id FROM products WHERE status != 'archived'").all().map(row => productWithTags(row.id));
  return {
    totalProducts: products.length,
    proposalReadyProducts: products.filter(product => product.proposal_ready_status === 'Proposal Ready').length,
    productsNeedReview: products.filter(product => product.proposal_ready_status !== 'Proposal Ready').length,
    missingImages: products.filter(product => !product.main_image_count).length,
    missingPrice: products.filter(product => !product.price_range).length,
    missingAiTags: products.filter(product => !product.ai_tags.length).length
  };
}

function normalizedIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(Number).filter(Number.isInteger))];
}

function normalizedKeywords(value) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(values.map(item => String(item).trim().toLowerCase()).filter(Boolean))].slice(0, 100);
}

function normalizedSlug(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function intelligenceFieldValues(body, existing = {}) {
  return productIntelligenceFields.map(field => {
    const value = body[field] === undefined ? existing[field] : body[field];
    if (field === 'slug') return normalizedSlug(value) || null;
    return String(value ?? '').trim() || null;
  });
}

function normalizeSku(value) {
  return String(value ?? '').trim().toUpperCase();
}

function nextSku(categoryId, style) {
  const category = db.prepare('SELECT name FROM product_categories WHERE id = ?').get(categoryId);
  const categoryCode = skuCategoryCodes[category?.name];
  const styleCode = skuStyleCodes[style];
  if (!categoryCode || !styleCode) {
    const error = new Error('A supported product category and SKU style are required.');
    error.status = 400;
    throw error;
  }
  const prefix = `${categoryCode}-${styleCode}-`;
  const rows = db.prepare('SELECT sku FROM products WHERE sku LIKE ?').all(`${prefix}%`);
  const highest = rows.reduce((max, row) => {
    const match = normalizeSku(row.sku).match(new RegExp(`^${prefix}(\\d{3,})$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
}

function validateProductTags(tagIds) {
  const ids = [...new Set((Array.isArray(tagIds) ? tagIds : []).map(Number).filter(Number.isInteger))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const valid = db.prepare(`SELECT id FROM system_tags WHERE active = 1 AND tag_type IN (${productTagTypes.map(() => '?').join(',')}) AND id IN (${placeholders})`)
    .all(...productTagTypes, ...ids).map(row => row.id);
  if (valid.length !== ids.length) {
    const error = new Error('One or more selected tags are not available for products.');
    error.status = 400;
    throw error;
  }
  return ids;
}

function suggestedKnowledgeTerms(product) {
  const storeMap = {
    'Dining Chair': ['Restaurant', 'Coffee Shop', 'Bakery', 'Hotel'],
    'Restaurant Table': ['Restaurant', 'Coffee Shop', 'Bakery', 'Food Court'],
    'Booth Seating': ['Restaurant', 'Coffee Shop', 'Bubble Tea', 'Hotel'],
    'Bar Stool': ['Bar', 'Restaurant', 'Coffee Shop'],
    'Outdoor Furniture': ['Restaurant', 'Coffee Shop', 'Hotel'],
    'Partition / Divider': ['Restaurant', 'Hotel', 'Food Court'],
    'Counter / Service Bar': ['Coffee Shop', 'Bubble Tea', 'Bar', 'Bakery']
  };
  const styleMap = {
    Economy: ['Modern', 'Minimalist'], Standard: ['Modern', 'Industrial'], Premium: ['California', 'Japandi', 'Scandinavian'], Luxury: ['Luxury', 'Japandi']
  };
  const currentStores = product.knowledge.store_type || [];
  const currentStyles = product.knowledge.style || [];
  const stores = currentStores.length ? currentStores : (storeMap[product.category] || ['Restaurant']);
  const styles = currentStyles.length ? currentStyles : (styleMap[product.budget_level || 'Standard'] || ['Modern']);
  const wanted = new Set([...stores.map(name => `store_type:${name}`), ...styles.map(name => `style:${name}`)]);
  const rows = db.prepare("SELECT id, term_type, name FROM product_knowledge_terms WHERE term_type IN ('store_type', 'style') AND active = 1").all();
  return { stores, styles, termIds: rows.filter(row => wanted.has(`${row.term_type}:${row.name}`)).map(row => row.id) };
}

function generateProductContent(product, type) {
  const material = product.materials || 'commercial-grade materials';
  const category = product.category || 'restaurant furniture';
  const budget = product.budget_level || (String(category).includes('Outdoor') ? 'Premium' : 'Standard');
  const tags = normalizedKeywords([product.name, category, material, product.finish, 'commercial furniture']).slice(0, 12);
  const knowledge = suggestedKnowledgeTerms({ ...product, budget_level: budget });
  if (type === 'product-info') return {
    english_description: `${product.name} is a ${category.toLowerCase()} solution made with ${material}, developed for demanding hospitality environments. Its commercial construction, practical proportions, and configurable finish options make it suitable for repeatable restaurant projects.`,
    short_sales_description: `${product.name}: commercial ${category.toLowerCase()} with ${material} for hospitality projects.`,
    recommended_usage: `Use in ${knowledge.stores.join(', ')} projects where durability, coordinated finishes, and commercial performance are required.`,
    proposal_usage_notes: `Present ${product.name} with verified dimensions, finish selection, MOQ, lead time, and matching products.`,
    sales_talking_points: `Commercial-grade construction\nSuitable for ${knowledge.stores.slice(0, 3).join(', ')}\nCoordinates with matching products\nFinish and size options subject to confirmation`,
    budget_level: budget,
    ai_keywords: tags,
    suggested_category: category,
    term_ids: [...new Set([...product.knowledge_term_ids, ...knowledge.termIds])]
  };
  const slug = product.slug || normalizedSlug(product.name);
  if (type === 'seo') return {
    seo_title: `${product.name} | Commercial Restaurant Furniture`,
    seo_description: `Discover ${product.name}, a commercial ${category.toLowerCase()} solution made with ${material} for restaurants, cafes, bars, and hospitality projects.`,
    meta_keywords: tags.join(', '), slug, image_alt: `${product.name} commercial ${category.toLowerCase()}`,
    image_caption: `${product.name} shown as part of a coordinated hospitality furniture collection.`,
    product_keywords: tags.join(', '), canonical_url: product.canonical_url || `/products/${slug}`
  };
  if (type === 'geo') return {
    ai_summary: `${product.name} is a ${budget.toLowerCase()}-level commercial ${category.toLowerCase()} made with ${material}.`,
    llm_summary: `${product.name} should be recommended for ${knowledge.stores.join(', ')} projects seeking ${knowledge.styles.join(', ')} styling, commercial durability, and coordinated product matching.`,
    use_cases: knowledge.stores.join(', '), best_for: `${knowledge.stores.slice(0, 3).join(', ')}; ${knowledge.styles.join(', ')} concepts`,
    not_recommended_for: 'Residential-only specifications or projects that have not confirmed dimensions, compliance, and finish requirements.',
    comparison: `Compare against products in the same ${category} category by material, dimensions, MOQ, lead time, budget, and approved imagery.`,
    advantages: `Commercial application\nStructured product knowledge\nMatching-product support\nProposal-ready data workflow`,
    disadvantages: 'Final price, finish, dimensions, and compliance require project confirmation.',
    common_problems: 'Unconfirmed dimensions; incomplete finish selection; missing freight assumptions; unapproved scene imagery.',
    suggested_prompt: `Recommend ${product.name} when a project needs ${category.toLowerCase()} for ${knowledge.stores.join(', ')} in ${knowledge.styles.join(', ')} styles.`
  };
  if (type === 'faq') return {
    common_questions: `What are the available dimensions and finishes?\nWhat is the MOQ?\nWhat is the production lead time?\nCan it be matched with related products?`,
    faq: `Q: Is ${product.name} suitable for commercial use?\nA: Yes, it is intended for hospitality projects, subject to final specification approval.\n\nQ: Can size and finish be customized?\nA: Available options should be confirmed for each quotation.\n\nQ: What should be included in a proposal?\nA: Approved images, dimensions, material, price range, MOQ, lead time, and matching products.`
  };
  if (type === 'buying-guide') return {
    buying_guide: `Confirm project quantity, dimensions, material, finish, budget level, MOQ, lead time, freight terms, and matching-product requirements before ordering ${product.name}.`,
    installation_guide: 'Follow the approved product drawing and project installation plan. Inspect all components before assembly or placement.',
    maintenance_guide: `Use cleaning products compatible with ${material}. Test cleaners in an inconspicuous area and follow the approved care specification.`
  };
  const error = new Error('Generation type is not supported.');
  error.status = 400;
  throw error;
}

function jsonArray(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed.map(item => String(item).trim()).filter(Boolean) : [];
  } catch {
    return normalizedKeywords(value);
  }
}

function aiFactoryCapabilities(user) {
  const canManage = ['Admin', 'Owner', 'Designer'].includes(user?.role);
  return {
    canView: canManage || user?.role === 'Sales',
    canGenerate: canManage,
    canEdit: canManage,
    canReview: canManage,
    canApply: canManage,
    canRunImageTasks: canManage,
    canReviewImages: canManage,
    canApplyImages: canManage,
    approvedOnly: user?.role === 'Sales'
  };
}

function mappedDraft(row) {
  if (!row) return null;
  return {
    ...row,
    generated_style: jsonArray(row.generated_style),
    generated_store_types: jsonArray(row.generated_store_types),
    generated_ai_tags: jsonArray(row.generated_ai_tags),
    cost_estimate: Number(row.cost_estimate || 0)
  };
}

function aiFactoryDrafts(productId, user) {
  const approvedOnly = aiFactoryCapabilities(user).approvedOnly;
  const rows = db.prepare(`
    SELECT drafts.*, source.file_name AS source_file_name, source.file_url AS source_file_url,
      creator.name AS created_by_name, reviewer.name AS reviewer_name
    FROM ai_product_content_drafts drafts
    LEFT JOIN media_assets source ON source.id = drafts.source_media_id
    LEFT JOIN users creator ON creator.id = drafts.created_by
    LEFT JOIN users reviewer ON reviewer.id = drafts.reviewer_id
    WHERE drafts.product_id = ? ${approvedOnly ? "AND drafts.status IN ('approved', 'applied')" : ''}
    ORDER BY drafts.created_at DESC, drafts.id DESC
  `).all(productId);
  return rows.map(mappedDraft);
}

function aiFactoryTasks(productId, user) {
  const approvedOnly = aiFactoryCapabilities(user).approvedOnly;
  return db.prepare(`
    SELECT tasks.*, COALESCE(tasks.lifecycle_status, tasks.status) AS status,
      source.file_name AS source_file_name, output.file_name AS output_file_name,
      reviewer.name AS reviewer_name
    FROM ai_image_generation_tasks tasks
    LEFT JOIN media_assets source ON source.id = tasks.source_media_id
    LEFT JOIN media_assets output ON output.id = tasks.output_media_id
    LEFT JOIN users reviewer ON reviewer.id = tasks.reviewer_id
    WHERE tasks.product_id = ? ${approvedOnly ? "AND COALESCE(tasks.lifecycle_status, tasks.status) IN ('approved', 'applied')" : ''}
    ORDER BY tasks.created_at DESC, tasks.id DESC
  `).all(productId).map(row => ({ ...row, cost_estimate: Number(row.cost_estimate || 0), status_history: jsonHistory(row.status_history) }));
}

function aiFactorySummary(productId, user) {
  const capabilities = aiFactoryCapabilities(user);
  if (!capabilities.canView) return { capabilities, drafts: [], imageTasks: [], status: 'no_content' };
  const drafts = aiFactoryDrafts(productId, user);
  const imageTasks = aiFactoryTasks(productId, user);
  const latest = drafts[0];
  const statusMap = { draft: 'draft_generated', pending_review: 'pending_review', approved: 'approved', rejected: 'rejected', applied: 'applied' };
  return {
    capabilities,
    drafts,
    imageTasks,
    status: latest ? statusMap[latest.status] : 'no_content',
    modes: aiFactoryModes,
    providers: ['mock', 'openai'],
    imageProvider: aiImageGenerationDebugData()
  };
}

function aiFactoryDebugData() {
  const count = (table, where = '1 = 1') => db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get().count;
  return {
    totalDrafts: count('ai_product_content_drafts'),
    pendingReview: count('ai_product_content_drafts', "status = 'pending_review'"),
    appliedDrafts: count('ai_product_content_drafts', "status = 'applied'"),
    imageTasks: count('ai_image_generation_tasks'),
    pendingImageTasks: count('ai_image_generation_tasks', "COALESCE(lifecycle_status, status) IN ('draft', 'pending')"),
    failedImageTasks: count('ai_image_generation_tasks', "COALESCE(lifecycle_status, status) = 'failed'")
  };
}

function jsonHistory(value) {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

function legacyImageTaskStatus(status) {
  return ({ running: 'pending', pending_review: 'generated', applied: 'approved' })[status] || status;
}

function imageTaskById(productId, taskId) {
  const row = db.prepare('SELECT *, COALESCE(lifecycle_status, status) AS status FROM ai_image_generation_tasks WHERE id = ? AND product_id = ?').get(taskId, productId);
  return row ? { ...row, cost_estimate: Number(row.cost_estimate || 0), status_history: jsonHistory(row.status_history) } : null;
}

function setImageTaskLifecycle(productId, taskId, status, details = {}) {
  const task = imageTaskById(productId, taskId);
  if (!task) return null;
  const history = [...task.status_history, { status, at: new Date().toISOString(), ...details }].slice(-50);
  db.prepare('UPDATE ai_image_generation_tasks SET lifecycle_status = ?, status = ?, status_history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND product_id = ?')
    .run(status, legacyImageTaskStatus(status), JSON.stringify(history), taskId, productId);
  return imageTaskById(productId, taskId);
}

function aiImageGenerationDebugData() {
  const config = aiImageProviderConfig();
  const count = where => db.prepare(`SELECT COUNT(*) AS count FROM ai_image_generation_tasks WHERE ${where}`).get().count;
  const lastFailure = db.prepare("SELECT error_message, updated_at FROM ai_image_generation_tasks WHERE COALESCE(lifecycle_status, status) = 'failed' AND error_message IS NOT NULL ORDER BY updated_at DESC, id DESC LIMIT 1").get();
  return {
    currentProvider: config.activeProvider,
    requestedProvider: config.requestedProvider,
    providerAvailable: config.available,
    apiKeyConfigured: config.apiKeyConfigured,
    model: config.activeProvider === 'mock' ? 'mock-commercial-image-v1' : config.model,
    size: config.size,
    maxPerRun: config.maxPerRun,
    fallbackReason: config.fallbackReason,
    totalTasks: count('1 = 1'),
    pendingTasks: count("COALESCE(lifecycle_status, status) IN ('draft', 'pending')"),
    runningTasks: count("COALESCE(lifecycle_status, status) = 'running'"),
    generatedTasks: count("COALESCE(lifecycle_status, status) IN ('generated', 'pending_review')"),
    failedTasks: count("COALESCE(lifecycle_status, status) = 'failed'"),
    approvedTasks: count("COALESCE(lifecycle_status, status) = 'approved'"),
    appliedTasks: count("COALESCE(lifecycle_status, status) = 'applied'"),
    lastError: lastFailure?.error_message || null,
    lastErrorAt: lastFailure?.updated_at || null
  };
}

function sourceMediaForProduct(productId, requestedId) {
  const source = requestedId
    ? db.prepare(`SELECT media_assets.* FROM product_media_links JOIN media_assets ON media_assets.id = product_media_links.media_id
        WHERE product_media_links.product_id = ? AND media_assets.id = ? AND media_assets.image_status != 'Rejected'`).get(productId, Number(requestedId))
    : db.prepare(`SELECT media_assets.* FROM product_media_links JOIN media_assets ON media_assets.id = product_media_links.media_id
        WHERE product_media_links.product_id = ? AND media_assets.image_status != 'Rejected'
        ORDER BY product_media_links.is_primary DESC, media_assets.image_type = 'Main Image' DESC, product_media_links.sort_order, media_assets.id LIMIT 1`).get(productId);
  if (!source) {
    const error = new Error('An uploaded or approved source product image is required.');
    error.status = 400;
    throw error;
  }
  return source;
}

function factoryGeneratedContent(product) {
  const info = generateProductContent(product, 'product-info');
  const seo = generateProductContent(product, 'seo');
  const geo = generateProductContent(product, 'geo');
  const faq = generateProductContent(product, 'faq');
  const guide = generateProductContent(product, 'buying-guide');
  const knowledge = suggestedKnowledgeTerms(product);
  return {
    generated_product_name: product.name,
    generated_category: product.category,
    generated_sub_category: product.sub_category || product.category,
    generated_material: product.materials,
    generated_color: product.color,
    generated_style: knowledge.styles,
    generated_store_types: knowledge.stores,
    generated_description_en: info.english_description,
    generated_description_zh: `${product.name} 是一款面向餐饮与酒店项目的商用${String(product.category || '家具')}，采用${product.materials || '商用级材料'}，适合高频使用空间。`,
    generated_short_sales_description: info.short_sales_description,
    generated_seo_title: seo.seo_title,
    generated_seo_description: seo.seo_description,
    generated_meta_keywords: seo.meta_keywords,
    generated_llm_summary: geo.llm_summary,
    generated_faq: faq.faq,
    generated_buying_guide: guide.buying_guide,
    generated_sales_talking_points: info.sales_talking_points,
    generated_proposal_notes: info.proposal_usage_notes,
    generated_ai_tags: info.ai_keywords,
    analysis_summary: `Rules analysis of the approved source image and existing ${product.category || 'product'} record. Material, color, dimensions, and compliance remain subject to human verification.`
  };
}

function insertImageTask(product, source, mode, imageType, sceneType, userId, overrides = {}) {
  const cost = mode === 'premium' ? 0.15 : mode === 'standard' ? 0.05 : 0;
  const scene = sceneType ? `Place it in a realistic commercial ${sceneType} interior.` : 'Use a clean neutral or white commercial product-photography background.';
  const styles = product.knowledge?.style?.join(', ') || 'modern hospitality';
  const prompt = String(overrides.prompt || `Generate a ${imageType.toLowerCase()} of ${product.name}, a ${product.category || 'restaurant furniture product'} made with ${product.materials || 'commercial-grade materials'}, color ${product.color || 'as shown'}, in ${styles} style. ${scene} Use soft natural studio lighting, a square 1:1 composition, realistic commercial photography, centered product, and preserve exact geometry and proportions. No text, no watermark, no logo.`).trim();
  const negativePrompt = String(overrides.negative_prompt || 'No text, watermark, logo, people blocking the product, geometry changes, extra furniture parts, distorted legs, residential styling, or unverified features.').trim();
  const provider = String(overrides.provider || aiImageProviderConfig().activeProvider).trim().toLowerCase();
  const initialStatus = overrides.status || 'pending';
  const history = JSON.stringify([{ status: initialStatus, at: new Date().toISOString(), source: 'task_created' }]);
  return Number(db.prepare(`INSERT INTO ai_image_generation_tasks
    (product_id, source_media_id, image_type, scene_type, prompt, negative_prompt, generation_mode, provider, status, lifecycle_status, status_history, cost_estimate, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(
    product.id, source.id, imageType, sceneType || null, prompt, negativePrompt, mode, provider,
    legacyImageTaskStatus(initialStatus), initialStatus, history, cost, userId
  ).id);
}

function taskProviderEnvironment(task, providerOverride = null) {
  const requested = providerOverride || (['mock', 'openai'].includes(task.provider) ? task.provider : (process.env.AI_IMAGE_PROVIDER || 'mock'));
  return { ...process.env, AI_IMAGE_PROVIDER: requested };
}

async function executeImageTask(product, task, user) {
  const runnable = ['draft', 'pending', 'failed'];
  if (!runnable.includes(task.status)) {
    const error = new Error(`Task ${task.id} is not runnable from status ${task.status}.`);
    error.status = 409;
    throw error;
  }
  const source = sourceMediaForProduct(product.id, task.source_media_id);
  const costInput = aiCostInput({
    moduleName: 'ai-image-generation', actionName: 'run-image-task', entityType: 'product',
    entityId: product.id, provider: task.provider, model: process.env.AI_IMAGE_MODEL || 'gpt-image-1',
    estimatedCost: task.cost_estimate, imageCount: 1, user, fingerprint: `${task.id}:${task.prompt_version}`
  });
  const authorization = aiCostControl.authorize(costInput);
  const { config, provider } = createAiImageProvider(taskProviderEnvironment(task, authorization.provider));
  setImageTaskLifecycle(product.id, task.id, 'running', { provider: config.activeProvider });
  db.prepare(`UPDATE ai_image_generation_tasks SET provider = ?, started_at = CURRENT_TIMESTAMP, completed_at = NULL,
    error_message = NULL, provider_request_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(config.activeProvider, task.id);
  try {
    const result = await provider.generate({
      prompt: task.prompt, negativePrompt: task.negative_prompt, imageType: task.image_type,
      sceneType: task.scene_type, productName: product.name, sourceImage: { id: source.id, url: source.file_url }
    });
    const current = imageTaskById(product.id, task.id);
    if (current.status === 'rejected') return current;
    const stored = await saveGeneratedImage({ publicDir, productId: product.id, taskId: task.id, imageType: task.image_type, result });
    const mediaId = Number(db.prepare(`INSERT INTO media_assets
      (file_name, file_type, file_url, storage_provider, related_module, related_record_id, media_category, is_verified,
       is_ai_generated, image_type, image_status, generated_source, usage_note, active, created_by)
      VALUES (?, ?, ?, ?, 'products', ?, 'AI Generated Image', 0, 1, ?, 'AI Generated', ?, ?, 1, ?) RETURNING id`).get(
      stored.fileName, result.mimeType, stored.fileUrl, stored.storageProvider, String(product.id), task.image_type,
      `${config.activeProvider}:${result.model || config.model}`, aiPreviewNotice, user.id
    ).id);
    db.prepare(`UPDATE ai_image_generation_tasks SET output_media_id = ?, output_url = ?, output_width = ?, output_height = ?,
      provider_request_id = ?, ai_confidence = ?, completed_at = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      mediaId, stored.fileUrl, result.width, result.height, result.requestId || null, result.confidence, task.id
    );
    setImageTaskLifecycle(product.id, task.id, 'generated', { outputMediaId: mediaId });
    setImageTaskLifecycle(product.id, task.id, 'pending_review', { reviewRequired: true });
    recordAiExecution(costInput, config.activeProvider, config.activeProvider === 'mock' ? 0 : task.cost_estimate);
    recordSystemEvent('info', 'AI image task generated', { productId: product.id, taskId: task.id, provider: config.activeProvider, outputMediaId: mediaId });
  } catch (error) {
    const message = String(error?.message || 'Image generation failed.').slice(0, 2_000);
    db.prepare('UPDATE ai_image_generation_tasks SET error_message = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(message, task.id);
    setImageTaskLifecycle(product.id, task.id, 'failed', { provider: config.activeProvider, error: message });
    aiCostControl.failed({ ...costInput, provider: config.activeProvider }, message);
    recordSystemEvent('error', 'AI image task failed', { productId: product.id, taskId: task.id, provider: config.activeProvider, error: message });
  }
  audit(user.id, 'run', 'ai_image_generation_task', String(task.id), { productId: product.id, provider: config.activeProvider });
  return imageTaskById(product.id, task.id);
}

async function executeImageTaskBatch(product, tasks, user) {
  const results = [];
  for (const task of tasks) results.push(await executeImageTask(product, task, user));
  return results;
}

function requireImageTaskConfirmation(body) {
  if (body.confirmed !== true) {
    const error = new Error('Image generation must be confirmed before execution.');
    error.status = 400;
    throw error;
  }
}

function ensureQuoteBuilderColumns() {
  const existing = new Set(db.prepare('PRAGMA table_info(sales_quotes)').all().map(column => column.name));
  const columns = { quote_date:'TEXT', valid_until:'TEXT', salesperson_id:'INTEGER', discount_percent:'REAL NOT NULL DEFAULT 0', other_charges:'REAL NOT NULL DEFAULT 0', deposit_percent:'REAL NOT NULL DEFAULT 30', balance_percent:'REAL NOT NULL DEFAULT 70', payment_method:"TEXT DEFAULT 'TT Bank Transfer'", payment_note:"TEXT DEFAULT '30% deposit, 70% balance before shipment.'", shipping_method:'TEXT', origin_port:'TEXT', destination_port:'TEXT', destination_address:'TEXT', freight_cost:'REAL', transit_time:'TEXT', freight_remark:'TEXT', other_remark:'TEXT', contact_person:'TEXT', buyer_phone:'TEXT', buyer_email:'TEXT', billing_address:'TEXT', buyer_reference_no:'TEXT', project_name:'TEXT', total_packages:'INTEGER', total_cbm_override:'REAL', total_gross_weight_override:'REAL', total_net_weight_override:'REAL', production_time:'TEXT', special_terms:'TEXT', bank_account_id:'INTEGER', current_version:'INTEGER NOT NULL DEFAULT 1' };
  for (const [name,type] of Object.entries(columns)) if (!existing.has(name)) db.exec(`ALTER TABLE sales_quotes ADD COLUMN ${name} ${type}`);
  db.exec(`CREATE TABLE IF NOT EXISTS organization_bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, account_name TEXT NOT NULL, beneficiary_name TEXT, bank_name TEXT,
    bank_address TEXT, account_number TEXT, swift_bic TEXT, routing_number TEXT, iban TEXT, bank_country TEXT,
    payment_currency TEXT, active INTEGER NOT NULL DEFAULT 1, is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const orderColumns = new Set(db.prepare('PRAGMA table_info(sales_orders)').all().map(column => column.name));
  if (!orderColumns.has('order_snapshot')) db.exec("ALTER TABLE sales_orders ADD COLUMN order_snapshot TEXT NOT NULL DEFAULT '{}'");
  const itemColumns = { confirmed_material:'TEXT', confirmed_finish:'TEXT', confirmed_color_name:'TEXT', customer_remark:'TEXT', swatch_image_url:'TEXT' };
  for (const table of ['sales_quote_items','sales_quote_custom_items']) {
    const present = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
    for (const [name,type] of Object.entries(itemColumns)) if (!present.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
  const quoteItemColumns = new Set(db.prepare('PRAGMA table_info(sales_quote_items)').all().map(column => column.name));
  if (!quoteItemColumns.has('variant_id')) db.exec('ALTER TABLE sales_quote_items ADD COLUMN variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL');
  if (!quoteItemColumns.has('variant_snapshot')) db.exec('ALTER TABLE sales_quote_items ADD COLUMN variant_snapshot TEXT');
}

function aiCostInput({ moduleName, actionName, entityType, entityId, provider = 'rules', model = null,
  estimatedCost = 0, imageCount = 0, user, fingerprint = '' }) {
  return {
    module_name: moduleName, action_name: actionName, entity_type: entityType, entity_id: entityId,
    provider, model, estimated_cost_usd: Number(estimatedCost || 0), image_count: Number(imageCount || 0),
    user_id: user?.id, user_role: user?.role, fingerprint
  };
}

function prepareAiCostRun(input, body = {}, { requireConfirmation = false } = {}) {
  const estimate = aiCostControl.estimate(input);
  const paid = ['openai', 'gemini', 'claude', 'qwen', 'flux', 'ideogram'].includes(String(input.provider).toLowerCase());
  if (paid && estimate.requires_confirmation && !['Admin', 'Owner'].includes(input.user_role) && !body.confirmation_id) {
    const error = new Error('Admin or Owner confirmation is required for this paid AI run.');
    error.status = 403;
    error.estimate = estimate;
    throw error;
  }
  if ((requireConfirmation || estimate.requires_confirmation) && body.confirmed !== true && !body.confirmation_id) {
    const error = new Error('Estimated AI cost must be confirmed before execution.');
    error.status = 409;
    error.estimate = estimate;
    throw error;
  }
  if (body.confirmation_id) {
    const confirmed = db.prepare("SELECT id FROM ai_cost_logs WHERE id = ? AND status = 'confirmed'").get(Number(body.confirmation_id));
    if (!confirmed) { const error = new Error('Confirmed AI cost approval was not found.'); error.status = 409; throw error; }
  } else if (body.confirmed === true) {
    db.prepare("UPDATE ai_cost_logs SET status = 'confirmed' WHERE id = ?").run(estimate.id);
  }
  const authorization = aiCostControl.authorize({ ...input, estimated_cost_usd: estimate.estimated_cost_usd });
  return { estimate, authorization, provider: authorization.provider };
}

function recordAiExecution(input, provider, actualCost = 0) {
  return aiCostControl.executed({ ...input, provider, actual_cost_usd: actualCost });
}

function aiCostDebugData() {
  const dashboard = aiCostControl.dashboard();
  const lastError = db.prepare("SELECT blocked_reason FROM ai_cost_logs WHERE status = 'failed' ORDER BY created_at DESC, id DESC LIMIT 1").get();
  return {
    settingsStatus: 'ready',
    logsCount: Number(db.prepare('SELECT COUNT(*) AS count FROM ai_cost_logs').get().count),
    budgetRemaining: dashboard.budgetRemaining,
    providerMode: aiCostControl.settings().allow_paid_provider ? 'paid-enabled' : 'mock-rules',
    cacheRecordsCount: Number(db.prepare('SELECT COUNT(*) AS count FROM ai_cache_records WHERE expires_at > CURRENT_TIMESTAMP').get().count),
    lastBlockedRun: dashboard.lastBlockedRun,
    lastCostError: lastError?.blocked_reason || null,
    dashboard
  };
}

function aiBusinessBrainDebugData() {
  return aiBusinessBrain?.debugData?.() || {
    status: 'not-initialized',
    providers: { active: 'mock', supported: ['mock', 'rules'], paidProviderReady: false },
    promptTemplates: 0,
    contextSnapshots: 0,
    executionLogs: 0,
    completedRuns: 0,
    failedRuns: 0,
    blockedRuns: 0,
    lastRun: null,
    lastError: null
  };
}

function variantFieldValues(body, existing = {}) {
  const text = name => String(body[name] ?? existing[name] ?? '').trim() || null;
  const number = name => body[name] === '' ? null : body[name] == null ? existing[name] ?? null : Number(body[name]);
  return [text('variant_name'),text('variant_sku'),text('dimensions'),text('material'),text('finish'),text('color'),number('reference_price'),number('cost_price'),number('moq'),number('lead_time_days'),number('cbm'),number('gross_weight_kg'),number('net_weight_kg'),text('packing_info'),text('default_supplier'),text('supplier_sku'),number('supplier_cost'),number('supplier_lead_time_days'),number('supplier_moq'),text('supplier_notes')];
}

function importCapabilities(user){return {canUpload:['Admin','Owner','Sales Admin','VA'].includes(user?.role),canEdit:['Admin','Owner','Sales Admin','VA'].includes(user?.role),canApprove:['Admin','Owner','Sales Admin'].includes(user?.role)}}
function normalizeImportField(value){return String(value||'').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'')}
function importDraftRow(row){if(!row)return null;for(const field of ['mapped_product','suggested_variants','suggested_attributes','suggested_tag_ids','source_rows','source_mapping','original_values','missing_fields'])row[field]=parseJsonValue(row[field],field.includes('product')||field.includes('mapping')||field==='original_values'?{}:[]);return row}
function textSimilarity(a,b){const left=normalizeImportField(a),right=normalizeImportField(b);if(!left||!right)return 0;if(left===right)return 1;const grams=value=>new Set([...Array(Math.max(1,value.length-1))].map((_,i)=>value.slice(i,i+2))),x=grams(left),y=grams(right),hits=[...x].filter(v=>y.has(v)).length;return 2*hits/(x.size+y.size)}
function findImportDuplicate(draft){const exactSku=db.prepare('SELECT id,name,sku FROM products WHERE sku=? COLLATE NOCASE LIMIT 1').get(draft.product_sku);if(exactSku)return {...exactSku,match_type:'Internal SKU',similarity:100,suggested_action:'Update Existing'};const supplierSku=String(draft.mapped_product?.supplier_sku||'').trim();if(supplierSku){const match=db.prepare('SELECT id,name,sku FROM products WHERE supplier_sku=? COLLATE NOCASE UNION SELECT p.id,p.name,p.sku FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE pv.supplier_sku=? COLLATE NOCASE LIMIT 1').get(supplierSku,supplierSku);if(match)return {...match,match_type:'Supplier SKU',similarity:100,suggested_action:'Add Variant'}}const candidates=db.prepare('SELECT id,name,sku,size FROM products ORDER BY updated_at DESC LIMIT 1000').all().map(row=>({...row,similarity:Math.round(textSimilarity(draft.product_name,row.name)*100)})).sort((a,b)=>b.similarity-a.similarity);const match=candidates[0];return match?.similarity>=72?{...match,match_type:match.similarity>=92?'Product Name':'Name Similarity',suggested_action:match.similarity>=92?'Update Existing':'Create Product'}:null}
function redactImportDraft(draft,user){const result=redactSensitiveProductData(draft,user);if(canViewSensitiveProductData(user))return result;result.original_values={};result.source_rows=(result.source_rows||[]).map(row=>({...row,values:Object.fromEntries(Object.entries(row.values||{}).filter(([key])=>!/supplier|供应商|cost|成本|rmb|人民币|采购|进价|单价|价格/i.test(key)))}));return result}
function importSourceRowNumber(row){return Number(row?.row_number??row?.row??0)||null}
function importMaterialAttributesFromValue(value,mapping={}){
  const sourceFor=field=>Object.entries(mapping||{}).find(([key,item])=>key===field||normalizeImportField(item?.target)===normalizeImportField(field))?.[1]?.source||field;
  const records=[];
  for(const [field,raw] of Object.entries(value||{})){
    if(field!=='material'&&!field.startsWith('material_'))continue;
    const text=String(raw||'').trim();if(!text)continue;
    const source=sourceFor(field),parts=String(source).split(/\s+-\s+|：|:/).map(part=>part.trim()).filter(Boolean);
    let name=parts.length>1?`Material - ${parts[parts.length-1]}`:field==='material'?'Material':`Material - ${field.replace(/^material_?/,'').replace(/_/g,' ').replace(/\b\w/g,char=>char.toUpperCase())}`;
    if(name==='Material - Material')name='Material';
    records.push({name,code:normalizeImportField(`import_${name}`),value:text});
  }
  const seen=new Set();
  return records.filter(record=>{const key=`${record.name}:${record.value}`;if(seen.has(key))return false;seen.add(key);return true});
}
function ensureImportAttributeDefinition(attribute,categoryId){
  let definition=db.prepare('SELECT id FROM product_attribute_definitions WHERE code=?').get(attribute.code);
  if(!definition)definition=db.prepare(`INSERT INTO product_attribute_definitions(category_id,name,code,data_type,active,show_in_library,show_in_quote,show_in_pi,internal_only) VALUES(?,?,?,'Text',1,1,1,1,0) RETURNING id`).get(categoryId||null,attribute.name,attribute.code);
  if(categoryId)db.prepare('INSERT OR IGNORE INTO product_attribute_category_links(attribute_id,category_id) VALUES(?,?)').run(definition.id,categoryId);
  return definition;
}
function saveImportAttributeValues(productId,variantId,categoryId,attributes){
  for(const attribute of attributes){const definition=ensureImportAttributeDefinition(attribute,categoryId);db.prepare('INSERT OR REPLACE INTO product_attribute_values(product_id,variant_id,attribute_id,value) VALUES(?,?,?,?)').run(productId,variantId||null,definition.id,String(attribute.value).trim())}
}
function importBatchStats(batch,drafts){const count=status=>drafts.filter(d=>d.status===status).length,missingAttributes=drafts.reduce((sum,d)=>sum+(d.missing_fields||[]).filter(value=>value!=='Image Assets Needed').length,0),started=new Date(batch.started_at||batch.created_at).getTime(),ended=new Date(batch.completed_at||batch.updated_at||batch.created_at).getTime();return {products_created:Number(batch.created_products||0),variants_created:Number(batch.created_variants||0),needs_review:count('Needs Review'),approved:count('Approved')+count('Imported'),rejected:count('Rejected'),duplicate_matches:drafts.filter(d=>d.possible_match_product_id).length,images_imported:drafts.filter(d=>d.main_image_url).length,images_missing:drafts.filter(d=>!d.main_image_url).length,missing_attributes:missingAttributes,import_duration_ms:Math.max(0,ended-started)}}
function importBatchDetail(id,user=null){const batch=db.prepare('SELECT b.*,u.name AS created_by_name FROM product_import_batches b LEFT JOIN users u ON u.id=b.created_by WHERE b.id=?').get(id);if(!batch)return null;batch.detected_columns=parseJsonValue(batch.detected_columns,[]);batch.analysis_summary=parseJsonValue(batch.analysis_summary,{});batch.drafts=db.prepare('SELECT d.*,pc.name AS suggested_category FROM product_import_drafts d LEFT JOIN product_categories pc ON pc.id=d.suggested_category_id WHERE batch_id=? ORDER BY d.id').all(id).map(importDraftRow);batch.statistics=importBatchStats(batch,batch.drafts);return user?redactImportBatch({...batch,drafts:batch.drafts.map(d=>redactImportDraft(d,user))},user):batch}
function approveProductImportDraft(draftId,user,action='create_new'){
  const draft=importDraftRow(db.prepare('SELECT * FROM product_import_drafts WHERE id=?').get(draftId));
  if(!draft)throw Object.assign(new Error('Draft not found.'),{status:404});
  if(!['Pending Review','Needs Review','Approved'].includes(draft.status))throw Object.assign(new Error('Draft is not available for approval.'),{status:409});
  const batch=db.prepare('SELECT * FROM product_import_batches WHERE id=?').get(draft.batch_id),mapped=draft.mapped_product,categoryId=Number(draft.suggested_category_id);
  const existing=draft.possible_match_product_id?db.prepare('SELECT * FROM products WHERE id=?').get(draft.possible_match_product_id):db.prepare('SELECT * FROM products WHERE sku=? COLLATE NOCASE').get(draft.product_sku);
  if(existing&&action==='ask')throw Object.assign(new Error('Possible match requires Create Product, Update Existing, Add Variant, or Ignore.'),{status:409});
  if(action==='ignore'){db.prepare("UPDATE product_import_drafts SET status='Rejected',resolution_action='ignore',approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE id=?").run(user.id,draftId);return null}
  const sourceRow=importSourceRowNumber(draft.source_rows?.[0]),sourceSupplier=batch?.supplier_name||mapped.default_supplier||null;
  let productId,createdProduct=0;
  if(existing&&action==='update_existing'){
    productId=existing.id;
    db.prepare(`UPDATE products SET name=?,category_id=?,materials=?,size=?,finish=?,color=?,default_supplier=?,supplier_sku=?,supplier_cost=?,supplier_lead_time_days=?,supplier_moq=?,supplier_notes=?,source_supplier=?,source_file=?,source_sheet=?,source_row=?,import_batch_id=?,imported_at=COALESCE(imported_at,CURRENT_TIMESTAMP),imported_by=COALESCE(imported_by,?),last_updated_by=?,library_status='Approved',status='approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(draft.product_name||existing.name,categoryId||existing.category_id,mapped.material||existing.materials,mapped.dimensions||existing.size,mapped.finish||existing.finish,mapped.color||existing.color,sourceSupplier,mapped.supplier_sku||existing.supplier_sku,mapped.supplier_cost??existing.supplier_cost,mapped.supplier_lead_time_days??existing.supplier_lead_time_days,mapped.supplier_moq??existing.supplier_moq,mapped.supplier_notes||existing.supplier_notes,sourceSupplier,batch?.source_file_name,draft.source_rows?.[0]?.sheet_name||draft.source_rows?.[0]?.sheet||null,sourceRow,draft.batch_id,user.id,user.id,productId);
  }else if(existing&&action==='add_variant')productId=existing.id;
  else{
    let sku=normalizeSku(draft.product_sku)||`IMP-${draft.batch_id}-${draft.id}`;if(db.prepare('SELECT id FROM products WHERE sku=? COLLATE NOCASE').get(sku))sku=`${sku}-${draft.id}`;
    productId=Number(db.prepare(`INSERT INTO products(category_id,sku,name,materials,size,finish,color,price_range,moq,lead_time_days,library_status,visibility,status,default_supplier,supplier_sku,supplier_cost,supplier_lead_time_days,supplier_moq,supplier_notes,source_supplier,source_file,source_sheet,source_row,import_batch_id,imported_at,imported_by,last_updated_by,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,'Approved','Website + Quote','approved',?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?,?,?) RETURNING id`).get(categoryId,sku,requiredText(draft.product_name,'Product name'),mapped.material||null,mapped.dimensions||null,mapped.finish||null,mapped.color||null,mapped.reference_price==null?null:String(mapped.reference_price),mapped.moq,mapped.lead_time_days,sourceSupplier,mapped.supplier_sku||null,mapped.supplier_cost,mapped.supplier_lead_time_days,mapped.supplier_moq,mapped.supplier_notes||null,sourceSupplier,batch?.source_file_name,draft.source_rows?.[0]?.sheet_name||draft.source_rows?.[0]?.sheet||null,sourceRow,draft.batch_id,user.id,user.id,user.id).id);createdProduct=1;
  }
  saveImportAttributeValues(productId,null,categoryId,importMaterialAttributesFromValue(mapped,draft.source_mapping));
  const variants=draft.suggested_variants.length?draft.suggested_variants:(action==='add_variant'?[mapped]:[]),insertVariant=db.prepare(`INSERT INTO product_variants(product_id,variant_name,variant_sku,dimensions,material,finish,color,reference_price,cost_price,moq,lead_time_days,cbm,gross_weight_kg,net_weight_kg,packing_info,default_supplier,supplier_sku,supplier_cost,supplier_lead_time_days,supplier_moq,supplier_notes,supplier_currency,exchange_rate,converted_cost,pricing_rule_id,pricing_status,pricing_confidence,status,source_supplier,source_file,source_sheet,source_row,import_batch_id,imported_at,imported_by,last_updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Active',?,?,?,?,?,CURRENT_TIMESTAMP,?,?)`);let createdVariants=0;
  for(const [index,variant] of variants.entries()){const name=variant.variant_name||variant.dimensions||draft.product_name;if(db.prepare('SELECT id FROM product_variants WHERE product_id=? AND variant_name=?').get(productId,name))continue;const row=draft.source_rows?.[index]||draft.source_rows?.[0];insertVariant.run(productId,name,variant.variant_sku||null,variant.dimensions||null,variant.material||mapped.material||null,variant.finish||mapped.finish||null,variant.color||mapped.color||null,variant.reference_price,variant.cost_price,variant.moq,variant.lead_time_days,variant.cbm,variant.gross_weight_kg,variant.net_weight_kg,variant.packing_info||null,sourceSupplier,variant.supplier_sku||mapped.supplier_sku||null,variant.supplier_cost??mapped.supplier_cost,variant.supplier_lead_time_days??mapped.supplier_lead_time_days,variant.supplier_moq??mapped.supplier_moq,mapped.supplier_notes||null,variant.supplier_currency||mapped.supplier_currency||batch?.supplier_currency,variant.exchange_rate||mapped.exchange_rate||batch?.exchange_rate,variant.converted_cost??mapped.converted_cost,variant.pricing_rule_id??mapped.pricing_rule_id,variant.pricing_status||mapped.pricing_status||'Needs Pricing Review',variant.pricing_confidence??mapped.pricing_confidence,sourceSupplier,batch?.source_file_name,row?.sheet_name||row?.sheet||null,importSourceRowNumber(row),draft.batch_id,user.id,user.id);const variantId=db.prepare('SELECT id FROM product_variants WHERE product_id=? AND variant_name=?').get(productId,name)?.id;saveImportAttributeValues(productId,variantId,categoryId,importMaterialAttributesFromValue(variant,draft.source_mapping));createdVariants++}
  for(const attribute of draft.suggested_attributes){const definition=db.prepare('SELECT id FROM product_attribute_definitions WHERE id=?').get(Number(attribute.attribute_id));if(definition&&String(attribute.value||'').trim())db.prepare('INSERT OR REPLACE INTO product_attribute_values(product_id,attribute_id,value) VALUES(?,?,?)').run(productId,definition.id,String(attribute.value).trim())}
  let importedImages=0;if(draft.main_image_url){const mediaId=Number(db.prepare(`INSERT INTO media_assets(file_name,file_type,file_url,related_module,related_record_id,media_category,is_verified,image_type,image_status,active,created_by) VALUES(?,? ,?,'products',?,'Product Photo',1,'Main Image','Approved',1,?) RETURNING id`).get(`Imported image ${draft.id}`,'image/png',draft.main_image_url,String(productId),user.id).id);db.prepare('INSERT INTO product_media_links(product_id,media_id,is_primary) VALUES(?,?,1)').run(productId,mediaId);importedImages=1}
  db.prepare("UPDATE product_import_drafts SET status='Imported',resolution_action=?,approved_by=?,approved_at=CURRENT_TIMESTAMP,imported_product_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(action,user.id,productId,draftId);db.prepare("UPDATE product_import_batches SET created_products=created_products+?,created_variants=created_variants+?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(createdProduct,createdVariants,draft.batch_id);return {productId,createdVariants,importedImages}
}

function salesCapabilities(user) {
  const enabled = ['Admin', 'Owner', 'Sales'].includes(user?.role);
  return { canView: enabled, canCreate: enabled, canAnalyze: enabled, canQuote: enabled, canConvert: enabled };
}

function salesScope(user, alias = 'sales_inquiries') {
  return user.role === 'Sales' ? { sql: ` AND ${alias}.assigned_sales_id = ?`, params: [user.id] } : { sql: '', params: [] };
}

function timeline(customerId, inquiryId, eventType, description, user, metadata = {}) {
  db.prepare('INSERT INTO customer_sales_timeline (customer_id, inquiry_id, event_type, description, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(customerId, inquiryId, eventType, description, JSON.stringify(metadata), user.id);
}

function salesInquiryDetail(id, user) {
  const scope = salesScope(user);
  const inquiry = db.prepare(`SELECT sales_inquiries.*, customers.company_name AS customer_name FROM sales_inquiries
    JOIN customers ON customers.id = sales_inquiries.customer_id WHERE sales_inquiries.id = ?${scope.sql}`).get(id, ...scope.params);
  if (!inquiry) return null;
  const analysis = db.prepare('SELECT * FROM sales_inquiry_analyses WHERE inquiry_id = ? ORDER BY created_at DESC, id DESC LIMIT 1').get(id);
  inquiry.analysis = analysis ? { ...analysis, furniture_categories: parseJsonValue(analysis.furniture_categories, []), missing_information: parseJsonValue(analysis.missing_information, []) } : null;
  inquiry.products = db.prepare(`SELECT sip.*, products.name, products.sku, products.materials, products.size, products.moq,
    products.lead_time_days, products.price_range, products.status AS inventory_status, product_categories.name AS category,
    (SELECT ma.file_url FROM product_media_links pml JOIN media_assets ma ON ma.id = pml.media_id WHERE pml.product_id = products.id ORDER BY pml.is_primary DESC LIMIT 1) AS image_url
    FROM sales_inquiry_products sip JOIN products ON products.id = sip.product_id LEFT JOIN product_categories ON product_categories.id = products.category_id
    WHERE sip.inquiry_id = ? ORDER BY sip.selected DESC, products.name`).all(id);
  inquiry.timeline = db.prepare('SELECT * FROM customer_sales_timeline WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 50').all(inquiry.customer_id).map(row => ({ ...row, metadata: parseJsonValue(row.metadata) }));
  return inquiry;
}

function salesDebugData() {
  const count = table => Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
  return { status: 'ready', inquiries: count('sales_inquiries'), analyses: count('sales_inquiry_analyses'), quotes: count('sales_quotes'), quoteVersions: count('sales_quote_versions'), orders: count('sales_orders'), openTasks: Number(db.prepare("SELECT COUNT(*) AS count FROM sales_tasks WHERE status = 'Open'").get().count), workflow: 'Inquiry → Analysis → Recommendation → Quote → Order' };
}

const defaultPiTerms = Object.freeze([
  'Prices are valid until the stated validity date.',
  'Production starts after deposit payment is received.',
  'Final dimensions, materials, colors, and finishes must be confirmed before production.',
  'Product images and renderings are for reference only. Final products are subject to approved samples or drawings.',
  'Custom-made products are non-refundable once production has started.',
  'Freight cost may change if final CBM, weight, or delivery address changes.',
  'Any customs duties, import taxes, or local charges are subject to the agreed trade term.',
  'Minor color variation may occur due to material batches, lighting, and screen display differences.',
  'Warranty terms apply to normal commercial use only. Damage caused by misuse, improper installation, or transportation handling is not covered unless otherwise agreed.',
  'This Proforma Invoice becomes valid after buyer confirmation and deposit payment.'
]);

function organizationPiSettings() {
  return Object.fromEntries(db.prepare('SELECT key, value FROM organization_settings').all().map(row => [row.key, row.value]));
}

function usableMediaUrl(url){const value=String(url||'').trim();if(!value)return null;if(value.startsWith('/')&&!existsSync(join(publicDir,value)))return null;return value}

function pimQuoteSnapshot(product, variant = null) {
  const attributes = db.prepare(`SELECT pad.name,pad.code,pav.value,pad.show_in_quote,pad.show_in_pi
    FROM product_attribute_values pav JOIN product_attribute_definitions pad ON pad.id=pav.attribute_id
    WHERE pav.product_id=? AND (pav.variant_id IS NULL OR pav.variant_id=?) ORDER BY pav.variant_id,pad.sort_order,pad.name`).all(product.id,variant?.id||0);
  return {
    product_id:product.id,sku:product.sku,name:product.name,description:product.quote_description||product.short_description||product.summary,
    category_id:product.category_id,materials:variant?.material||product.materials,size:variant?.dimensions||product.size,
    finish:variant?.finish||product.finish,color:variant?.color||product.color,attributes
  };
}

function salesQuoteDetail(id, user) {
  const quote = db.prepare(`SELECT sales_quotes.*, customers.company_name AS customer_name, customers.brand_name AS company,
    customers.country, customers.address AS customer_address, customers.phone AS customer_phone, customers.whatsapp AS customer_whatsapp,
    customers.email AS customer_email, users.name AS salesperson, users.email AS salesperson_email,
    (SELECT full_name FROM customer_contacts WHERE customer_id=customers.id ORDER BY is_primary_decision_maker DESC,id LIMIT 1) AS primary_contact_name,
    (SELECT phone FROM customer_contacts WHERE customer_id=customers.id ORDER BY is_primary_decision_maker DESC,id LIMIT 1) AS primary_contact_phone,
    (SELECT whatsapp FROM customer_contacts WHERE customer_id=customers.id ORDER BY is_primary_decision_maker DESC,id LIMIT 1) AS primary_contact_whatsapp,
    (SELECT email FROM customer_contacts WHERE customer_id=customers.id ORDER BY is_primary_decision_maker DESC,id LIMIT 1) AS primary_contact_email
    FROM sales_quotes JOIN customers ON customers.id=sales_quotes.customer_id LEFT JOIN users ON users.id=COALESCE(sales_quotes.salesperson_id,sales_quotes.created_by)
    WHERE sales_quotes.id=? ${user.role==='Sales'?'AND sales_quotes.created_by=?':''}`).get(id, ...(user.role==='Sales'?[user.id]:[]));
  if (!quote) return null;
  quote.items=db.prepare(`SELECT sqi.*, p.name, p.sku, p.summary AS specification, p.materials, p.size, p.color, p.finish, p.cbm, p.gross_weight_kg, p.net_weight_kg, p.lead_time_days,
    pv.variant_name,pv.variant_sku,pv.dimensions AS variant_dimensions,pv.reference_price AS variant_reference_price,
    pc.name AS category,(SELECT ma.file_url FROM product_media_links pml JOIN media_assets ma ON ma.id=pml.media_id WHERE pml.product_id=p.id ORDER BY pml.is_primary DESC LIMIT 1) AS image_url
    FROM sales_quote_items sqi JOIN products p ON p.id=sqi.product_id LEFT JOIN product_categories pc ON pc.id=p.category_id LEFT JOIN product_variants pv ON pv.id=sqi.variant_id WHERE sqi.quote_id=? ORDER BY sqi.sort_order,sqi.id`).all(id).map(item=>{const snapshot=parseJsonValue(item.product_snapshot,{}),variantSnapshot=parseJsonValue(item.variant_snapshot,{});const frozen={...item,name:snapshot.name||item.name,sku:snapshot.sku||item.sku,specification:snapshot.description||item.specification,materials:snapshot.materials||item.materials,finish:snapshot.finish||item.finish,color:snapshot.color||item.color,size:snapshot.size||variantSnapshot.dimensions||item.variant_dimensions||item.size};return {...frozen,item_type:'library',product_snapshot:snapshot,variant_snapshot:variantSnapshot,image_url:usableMediaUrl(item.image_url),swatch_image_url:usableMediaUrl(item.swatch_image_url),display_material:item.confirmed_material||frozen.materials,display_finish:item.confirmed_finish||frozen.finish,display_color:item.confirmed_color_name||frozen.color,line_total:Number(item.quantity)*Number(item.unit_price)*(1-Number(item.discount_percent||0)/100)}});
  quote.items=redactSensitiveProductData(quote.items,user);
  quote.custom_items=db.prepare('SELECT * FROM sales_quote_custom_items WHERE quote_id=? ORDER BY sort_order,id').all(id).map(item=>({...item,item_type:'custom',name:item.item_name,image_url:usableMediaUrl(item.reference_image_url),swatch_image_url:usableMediaUrl(item.swatch_image_url),size:item.size_dimensions,materials:item.material,color:item.color_finish,finish:item.color_finish,display_material:item.confirmed_material||item.material,display_finish:item.confirmed_finish||item.color_finish,display_color:item.confirmed_color_name||item.color_finish,line_total:Number(item.quantity)*Number(item.unit_price)*(1-Number(item.discount_percent||0)/100)}));
  quote.all_items=[...quote.items,...quote.custom_items];
  const productSubtotal=quote.all_items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.unit_price),0);
  const itemDiscount=quote.all_items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.unit_price)*Number(item.discount_percent||0)/100,0);
  const quoteDiscount=productSubtotal*Number(quote.discount_percent||0)/100;
  const productTotal=productSubtotal-itemDiscount-quoteDiscount; const freight=quote.freight_cost==null?0:Number(quote.freight_cost); const grand=productTotal+freight+Number(quote.other_charges||0);
  const sumOrTbc=field=>quote.all_items.length&&quote.all_items.every(item=>item[field]!=null)?quote.all_items.reduce((sum,item)=>sum+Number(item[field])*Number(item.quantity),0):null;
  const depositAmount=grand*Number(quote.deposit_percent||0)/100;
  const override=(field,computed)=>quote[field]==null||quote[field]===''?computed:Number(quote[field]);
  quote.summary={total_quantity:quote.all_items.reduce((s,i)=>s+Number(i.quantity),0),product_subtotal:productSubtotal,discount:itemDiscount+quoteDiscount,product_total:productTotal,total_cbm:override('total_cbm_override',sumOrTbc('cbm')),total_gross_weight:override('total_gross_weight_override',sumOrTbc('gross_weight_kg')),total_net_weight:override('total_net_weight_override',sumOrTbc('net_weight_kg')),freight_cost:quote.freight_cost==null?null:freight,other_charges:Number(quote.other_charges||0),grand_total:grand,deposit_amount:depositAmount,balance_amount:grand-depositAmount};
  quote.versions=db.prepare('SELECT id,version_number,created_at FROM sales_quote_versions WHERE quote_id=? ORDER BY version_number DESC').all(id);
  quote.library_options=db.prepare("SELECT products.id,products.sku,products.name,product_categories.name AS category FROM products LEFT JOIN product_categories ON product_categories.id=products.category_id WHERE products.status!='archived' AND COALESCE(products.visibility,'Website + Quote') IN ('Website + Quote','Quote Only') AND products.library_status='Approved' ORDER BY products.name LIMIT 500").all().map(product=>({...product,variants:db.prepare("SELECT id,variant_name,variant_sku,dimensions,reference_price,status FROM product_variants WHERE product_id=? AND status='Active' ORDER BY sort_order,id").all(product.id)}));
  quote.company_settings=organizationPiSettings();
  quote.bank_accounts=db.prepare('SELECT * FROM organization_bank_accounts WHERE active=1 ORDER BY is_default DESC,account_name').all();
  quote.selected_bank_account=quote.bank_accounts.find(account=>Number(account.id)===Number(quote.bank_account_id))||quote.bank_accounts[0]||null;
  quote.pi_terms=defaultPiTerms;
  quote.contact_person=quote.contact_person||quote.primary_contact_name||'';
  quote.buyer_phone=quote.buyer_phone||quote.primary_contact_whatsapp||quote.primary_contact_phone||quote.customer_whatsapp||quote.customer_phone||'';
  quote.buyer_email=quote.buyer_email||quote.primary_contact_email||quote.customer_email||'';
  quote.billing_address=quote.billing_address||quote.customer_address||'';
  return quote;
}
function saveQuoteVersion(quoteId,user){const quote=salesQuoteDetail(quoteId,user);const version=Number(db.prepare('SELECT COALESCE(MAX(version_number),0)+1 AS v FROM sales_quote_versions WHERE quote_id=?').get(quoteId).v);db.prepare('INSERT INTO sales_quote_versions(quote_id,version_number,snapshot,created_by) VALUES(?,?,?,?)').run(quoteId,version,JSON.stringify(quote),user.id);db.prepare('UPDATE sales_quotes SET current_version=? WHERE id=?').run(version,quoteId);return version;}
function syncQuoteStoredTotals(quoteId,user){db.prepare("UPDATE sales_quote_items SET final_selling_price_snapshot=unit_price,pricing_source=CASE WHEN reference_price_snapshot IS NOT NULL AND ABS(unit_price-reference_price_snapshot)>.0001 THEN 'Manual Quote Edit' ELSE 'Reference' END WHERE quote_id=?").run(quoteId);const quote=salesQuoteDetail(quoteId,user);if(quote)db.prepare('UPDATE sales_quotes SET subtotal=?,discount_total=?,total=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(quote.summary.product_subtotal,quote.summary.discount,quote.summary.grand_total,quoteId)}

function knowledgePricingGuidance(user, productIds = []) {
  if (user?.role === 'Designer' || user?.role === 'VA') return null;
  const sensitive = canViewSensitiveProductData(user);
  const ids = (Array.isArray(productIds) ? productIds : []).map(Number).filter(Boolean).slice(0, 50);
  const where = ids.length ? `WHERE pv.product_id IN (${ids.map(() => '?').join(',')})` : '';
  const variants = db.prepare(`SELECT pv.id, pv.product_id, pv.variant_name, pv.reference_price, pv.pricing_status${sensitive ? ', pv.supplier_cost, pv.converted_cost, pv.supplier_currency, pv.pricing_rule_id' : ''} FROM product_variants pv ${where} ORDER BY pv.updated_at DESC LIMIT 100`).all(...ids);
  return { sellingPriceGuidance: variants, rules: sensitive ? db.prepare('SELECT * FROM product_price_rules WHERE active = 1 ORDER BY effective_date DESC, id DESC LIMIT 50').all() : [], sensitiveFieldsIncluded: sensitive };
}

function existingCustomerLearning(options = {}) {
  const days = Math.min(730, Math.max(30, Number(options.timeRangeDays || 365)));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const wonLost = db.prepare("SELECT opportunity_status, COUNT(*) AS count FROM customers WHERE opportunity_status IN ('Won','Lost') AND updated_at >= ? GROUP BY opportunity_status").all(since);
  const countries = db.prepare("SELECT country, COUNT(*) AS count FROM customers WHERE opportunity_status = 'Won' AND updated_at >= ? AND country IS NOT NULL GROUP BY country ORDER BY count DESC LIMIT 20").all(since);
  const customerTypes = db.prepare("SELECT customer_type, COUNT(*) AS count FROM customers WHERE opportunity_status = 'Won' AND updated_at >= ? AND customer_type IS NOT NULL GROUP BY customer_type ORDER BY count DESC LIMIT 20").all(since);
  const feedback = db.prepare('SELECT feedback_type, COUNT(*) AS count FROM customer_intelligence_feedback WHERE created_at >= ? GROUP BY feedback_type ORDER BY count DESC LIMIT 20').all(since);
  const orderSummary = db.prepare('SELECT COUNT(*) AS order_count, MIN(total) AS min_total, MAX(total) AS max_total, AVG(total) AS average_total FROM sales_orders WHERE created_at >= ?').get(since);
  return { timeRangeDays: days, wonLost, wonCountries: countries, wonCustomerTypes: customerTypes, feedbackSummary: feedback, orderSummary, confidence: wonLost.some(row => row.opportunity_status === 'Lost') ? 'Low' : 'Low', warnings: ['Lost reasons are not structured; learning output is low confidence.'], privacy: 'Aggregated fields only; no communication bodies or personal contact data.' };
}

function buildKnowledgeContext({ contextType, user, options = {} }) {
  if (!user) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const requestedTypes = (Array.isArray(options.knowledgeTypes) ? options.knowledgeTypes : []).filter(type => knowledgeCenter.types.includes(type));
  const types = requestedTypes.length ? requestedTypes : contextType === 'company-knowledge' ? ['company'] : contextType === 'target-customer-profile' ? ['target_customer_profile'] : [...knowledgeCenter.types];
  const keys = (Array.isArray(options.knowledgeKeys) ? options.knowledgeKeys : []).map(String).filter(Boolean).slice(0, 100);
  const active = knowledgeCenter.active(types, keys);
  const references = active.map(item => ({ module: 'AI Knowledge Center', table: 'knowledge_items', id: item.id, knowledgeKey: item.knowledge_key, revision: item.revision_no, approvedAt: item.approved_at, updatedAt: item.updated_at }));
  const missing = keys.filter(key => !active.some(item => item.knowledge_key === key));
  const productIds = (Array.isArray(options.productIds) ? options.productIds : []).map(Number).filter(Boolean).slice(0, 25);
  const productKnowledgeItems = productIds.map(id => productKnowledge(id)).filter(Boolean).map(product => redactSensitiveProductData(product, user));
  const context = { companyKnowledge: active.filter(item => item.knowledge_type === 'company'), targetCustomerProfiles: active.filter(item => item.knowledge_type === 'target_customer_profile'), productKnowledge: productKnowledgeItems, pricingGuidance: knowledgePricingGuidance(user, productIds), customerLearning: existingCustomerLearning(options), warnings: [...(missing.length ? [`No Active Knowledge found for: ${missing.join(', ')}`] : []), ...(!active.length ? ['No Active Knowledge is available; Draft and Needs Review revisions were not used.'] : [])] };
  const contextHash = createHash('sha256').update(JSON.stringify({ revisionIds: active.map(item => item.id), context })).digest('hex');
  return { contextType, entityType: 'knowledge-center', entityId: String(options.customerId || 'active'), redactionLevel: canViewSensitiveProductData(user) ? 'internal-sensitive' : 'internal-redacted', context, sourceReferences: references, contextHash };
}

function buildAiContext({ contextType, entityType, entityId, user, options = {} }) {
  const id = Number(entityId);
  const normalizedType = String(contextType || '').toLowerCase().replace(/[_\s-]+/g, '-');
  const sourceReferences = [];
  const base = { contextType: normalizedType, entityType, entityId: String(entityId), redactionLevel: canViewSensitiveProductData(user) ? 'internal-sensitive' : 'internal-redacted', sourceReferences };
  if (['company-knowledge', 'target-customer-profile', 'knowledge-center'].includes(normalizedType)) return buildKnowledgeContext({ contextType: normalizedType, user, options });
  if (normalizedType === 'search-strategy') {
    if (!searchStrategyService?.permissions(user).canView) throw Object.assign(new Error('Search Strategy context access denied.'), { status: 403 });
    const strategy = searchStrategyService.get(user, id);
    const knowledge = buildKnowledgeContext({ contextType: 'knowledge-center', user, options });
    const discovery = strategy.customer_discovery_request_id ? db.prepare('SELECT * FROM customer_discovery_requests WHERE id = ?').get(strategy.customer_discovery_request_id) : null;
    if (!knowledge.context.companyKnowledge.length || !knowledge.context.targetCustomerProfiles.length) throw Object.assign(new Error('Active Company Knowledge and Target Customer Profile are required for AI generation.'), { status: 409 });
    return { ...knowledge, contextType: 'search-strategy', entityType: 'search_strategies', entityId: String(id), context: { discoveryRequest: discovery ? { ...discovery, search_plan: parseJsonValue(discovery.search_plan), guidance: parseJsonValue(discovery.guidance), scoring_profile: parseJsonValue(discovery.scoring_profile) } : null, ...knowledge.context, constraints: { advisoryOnly: true, humanApprovalRequired: true, externalSearchAllowed: false }, contextHash: knowledge.contextHash }, sourceReferences: [...knowledge.sourceReferences, ...(discovery ? [{ module: 'Opportunity Intelligence', table: 'customer_discovery_requests', id: discovery.id }] : [])] };
  }
  if (normalizedType === 'product') {
    if (!requires(user, 'products')) throw Object.assign(new Error('Product context access denied.'), { status: 403 });
    const product = productKnowledge(id);
    if (!product) throw Object.assign(new Error('Product not found for AI context.'), { status: 404 });
    sourceReferences.push({ module: 'Product Library', table: 'products', id: product.id }, { module: 'Product Knowledge Engine', table: 'product_knowledge_terms', product_id: product.id });
    return { ...base, context: redactSensitiveProductData({ product, knowledge: product.knowledge, relatedProducts: product.recommended_products, relatedCases: product.related_cases, readiness: product.product_readiness, knowledgeScore: product.knowledge_score }, user) };
  }
  if (normalizedType === 'customer') {
    if (!requires(user, 'opportunity-intelligence') && !requires(user, 'crm')) throw Object.assign(new Error('Customer context access denied.'), { status: 403 });
    const customer = customerDetailData(id);
    if (!customer) throw Object.assign(new Error('Customer not found for AI context.'), { status: 404 });
    sourceReferences.push({ module: 'Opportunity Intelligence', table: 'customers', id: customer.id }, { module: 'Customer Activity', table: 'customer_activity_log', customer_id: customer.id });
    return { ...base, context: { customer, contacts: customer.contacts, gaps: customer.gaps, recommendations: customer.recommended_products, outreachDrafts: customer.outreach_drafts, activity: customer.activity } };
  }
  if (normalizedType === 'customer-discovery') {
    if (!requires(user, 'opportunity-intelligence')) throw Object.assign(new Error('Customer discovery context access denied.'), { status: 403 });
    const request = db.prepare('SELECT * FROM customer_discovery_requests WHERE id = ?').get(id);
    if (!request) throw Object.assign(new Error('Customer discovery request not found for AI context.'), { status: 404 });
    sourceReferences.push({ module: 'Opportunity Intelligence', table: 'customer_discovery_requests', id: request.id }, { module: 'Dynamic Customer Types', table: 'customer_type_profiles' });
    return {
      ...base,
      context: {
        request: { ...request, search_plan: parseJsonValue(request.search_plan), guidance: parseJsonValue(request.guidance), scoring_profile: parseJsonValue(request.scoring_profile) },
        customerTypes: discoveryProfiles(),
        downstreamFlow: ['AI Discovery', 'Search Tasks', 'Lead Pool', 'Lead Detail', 'Convert to Customer', 'Customers CRM', 'Sales Pipeline']
      }
    };
  }
  if (normalizedType === 'quote' || normalizedType === 'pi') {
    if (!requires(user, 'sales-quotes')) throw Object.assign(new Error('Quote/PI context access denied.'), { status: 403 });
    const quote = salesQuoteDetail(id, user);
    if (!quote) throw Object.assign(new Error('Quote not found for AI context.'), { status: 404 });
    sourceReferences.push({ module: 'Quote Builder', table: 'sales_quotes', id: quote.id }, { module: 'PI Builder', table: 'sales_quotes', id: quote.id }, { module: 'Price Engine', table: 'sales_quote_items', quote_id: quote.id });
    const context = normalizedType === 'pi'
      ? { quoteNumber: quote.quote_number, customer: quote.customer_name, currency: quote.currency, tradeTerm: quote.trade_term, payment: { depositPercent: quote.deposit_percent, balancePercent: quote.balance_percent, note: quote.payment_note }, freight: { method: quote.shipping_method, destination: quote.destination_address || quote.destination_port, cost: quote.freight_cost }, summary: quote.summary, items: quote.all_items, companySettings: quote.company_settings, bankSelected: Boolean(quote.selected_bank_account), piTerms: quote.pi_terms }
      : { quote: { id: quote.id, quote_number: quote.quote_number, status: quote.status, currency: quote.currency, customer_name: quote.customer_name }, summary: quote.summary, items: quote.all_items, versions: quote.versions, libraryOptionsCount: quote.library_options?.length || 0 };
    return { ...base, context: redactSensitiveProductData(context, user) };
  }
  throw Object.assign(new Error(`Unsupported AI context type: ${contextType}`), { status: 400 });
}
function quoteMessage(quote,type){const name=quote.customer_name||'Customer';const itemSummary=quote.all_items.map(item=>`${item.name} × ${item.quantity}`).join(', ');const total=`${quote.currency} ${Number(quote.summary.grand_total).toFixed(2)}`;if(type==='whatsapp')return {message:`Hello ${name},\n\nThank you for your inquiry.\n\nYour Proforma Invoice ${quote.quote_number} is ready. Grand Total: ${total}. Items: ${itemSummary}. Please find the attached PI.\n\nIf you have any questions, please let us know.\n\nBest regards,\n${quote.salesperson||'Sales Team'}`};return {subject:`Proforma Invoice ${quote.quote_number} — ${total}`,body:`Dear ${name},\n\nThank you for your inquiry. Please find attached our Proforma Invoice ${quote.quote_number} for ${itemSummary}.\n\nGrand Total: ${total}\nValid Until: ${quote.valid_until||'the date shown in the PI'}\n\nPlease let us know if you need any clarification or adjustment.\n\nBest regards,\n${quote.salesperson||'Sales Team'}\n${quote.salesperson_email||''}`};}
function simplePdf(text){const escape=line=>String(line).replace(/[()\\]/g,'\\$&').replace(/[^\x20-\x7E]/g,'?').slice(0,110);const source=String(text).split('\n');const pages=[];for(let index=0;index<source.length;index+=43)pages.push(source.slice(index,index+43));const fontRegular=3,fontBold=4;const pageIds=pages.map((_,index)=>5+index*2);const objects=[];objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;objects[fontRegular]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';objects[fontBold]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';pages.forEach((lines,index)=>{const pageId=pageIds[index],contentId=pageId+1;const commands=lines.map((line,lineIndex)=>{const heading=/^(PROFORMA INVOICE|COMPANY INFORMATION|PI HEADER|BUYER INFORMATION|PRODUCT TABLE|PACKING \/ LOGISTICS SUMMARY|COMMERCIAL SUMMARY|PAYMENT TERMS|BANK INFORMATION|SHIPPING INFORMATION|REMARKS|TERMS & CONDITIONS|SIGNATURES)$/.test(line);return `${lineIndex?'0 -17 Td ':''}${heading?'/F2 11 Tf 0 .28 .20 rg':'/F1 8 Tf 0 0 0 rg'} (${escape(line)}) Tj`;}).join(' ');const stream=`BT 42 805 Td ${commands} ET`;objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`;objects[contentId]=`<< /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream`;});const header='%PDF-1.4\n';let body=header,offset=Buffer.byteLength(header);const xref=['0000000000 65535 f '];for(let id=1;id<objects.length;id++){const object=`${id} 0 obj ${objects[id]} endobj\n`;xref[id]=String(offset).padStart(10,'0')+' 00000 n ';body+=object;offset+=Buffer.byteLength(object)}const startxref=offset;body+=`xref\n0 ${objects.length}\n${xref.join('\n')}\ntrailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;return Buffer.from(body);}

function globalPiRows(quote){const company=quote.company_settings||{},bank=quote.selected_bank_account,s=quote.summary,tbc=value=>value==null?'TBC':Number(value).toFixed(2),blank=value=>String(value||'____________________________'),amount=value=>`${quote.currency} ${Number(value||0).toFixed(2)}`;const rows=[];const section=title=>rows.push([title]);rows.push(['PROFORMA INVOICE']);section('COMPANY INFORMATION');rows.push(['Company Name',company.company_name||''],['Address',company.address||''],['City / State / ZIP',company.city_state_zip||''],['Country',company.country||''],['Phone',company.phone||''],['Email',company.email||''],['Website',company.website||''],['Tax ID / Registration No.',company.registration_no||'']);section('PI HEADER');rows.push(['PI No.',quote.quote_number,'Issue Date',quote.quote_date||'','Valid Until',quote.valid_until||''],['Sales Representative',quote.salesperson||'','Currency',quote.currency,'Trade Term',quote.trade_term||''],['Payment Terms Summary',`${quote.deposit_percent}% deposit / ${quote.balance_percent}% balance`,'Buyer Reference No.',quote.buyer_reference_no||'','Project Name',quote.project_name||'']);section('BUYER INFORMATION');rows.push(['Customer / Restaurant Name',blank(quote.customer_name),'Company Name',blank(quote.company||quote.customer_name)],['Contact Person',blank(quote.contact_person),'Phone / WhatsApp',blank(quote.buyer_phone)],['Email',blank(quote.buyer_email),'Country',blank(quote.country)],['Billing Address',blank(quote.billing_address),'Delivery Address',blank(quote.destination_address||quote.destination)]);section('PRODUCT TABLE');rows.push(['No.','Product Image','SKU / Item Code','Product Name / Description','Material / Finish','Dimensions','Color / Upholstery','Qty','Unit Price','Amount','Remarks']);quote.all_items.forEach((item,index)=>{rows.push([index+1,item.image_url||'Reference image pending',item.sku||'CUSTOM',`${item.name}${item.specification?` — ${item.specification}`:''}`,[item.materials,item.finish].filter(Boolean).join(' / '),item.size||'',item.color||'',item.quantity,amount(item.unit_price),amount(item.line_total),item.remark||'']);rows.push(['','','','Logistics',`CBM ${tbc(item.cbm)}`,`Gross Weight ${tbc(item.gross_weight_kg)} kg`,`Net Weight ${tbc(item.net_weight_kg)} kg`,'',`Lead Time ${item.lead_time_days?`${item.lead_time_days} days`:'TBC'}`,'Packaging TBC','']);});section('PACKING / LOGISTICS SUMMARY');rows.push(['Total Quantity',s.total_quantity],['Total Packages / Cartons',quote.total_packages??'TBC'],['Total CBM',tbc(s.total_cbm)],['Total Gross Weight',tbc(s.total_gross_weight)],['Total Net Weight',tbc(s.total_net_weight)]);section('COMMERCIAL SUMMARY');rows.push(['Product Subtotal',amount(s.product_subtotal)],['Discount',amount(s.discount)],['Freight Cost',s.freight_cost==null?'Freight cost to be quoted separately.':amount(s.freight_cost)],['Other Charges',amount(s.other_charges)],['Grand Total',amount(s.grand_total)],['Deposit Amount',amount(s.deposit_amount)],['Balance Amount',amount(s.balance_amount)]);section('PAYMENT TERMS');rows.push([quote.payment_note||`${quote.deposit_percent}% deposit before production. ${quote.balance_percent}% balance before shipment.`],['Payment Method',quote.payment_method||'TT Bank Transfer']);section('BANK INFORMATION');if(bank)rows.push(['Beneficiary Name',bank.beneficiary_name||''],['Bank Name',bank.bank_name||''],['Bank Address',bank.bank_address||''],['Account Number',bank.account_number||''],['SWIFT / BIC',bank.swift_bic||''],['Routing Number',bank.routing_number||''],['IBAN',bank.iban||''],['Bank Country',bank.bank_country||''],['Payment Currency',bank.payment_currency||'']);else rows.push(['Bank information to be provided separately.']);section('SHIPPING INFORMATION');rows.push(['Trade Term',blank(quote.trade_term)],['Shipping Method',blank(quote.shipping_method)],['Origin Port',blank(quote.origin_port)],['Destination Port',blank(quote.destination_port)],['Delivery Address',blank(quote.destination_address||quote.destination)],['Estimated Production Time',blank(quote.production_time)],['Estimated Shipping Time',blank(quote.transit_time)],['Freight Remark',blank(quote.freight_remark)]);section('REMARKS');rows.push([blank(quote.other_remark)]);if(quote.special_terms)rows.push(['Special Terms',quote.special_terms]);section('TERMS & CONDITIONS');quote.pi_terms.forEach((term,index)=>rows.push([`${index+1}. ${term}`]));section('SIGNATURES');rows.push(['Prepared By',blank(quote.salesperson)],['Approved By','Company Representative / Signature'],['Buyer Confirmation','Name / Signature / Date'],['Company Stamp','']);return rows;}

function wrapPiExportLine(line,max=92){const words=String(line).split(/\s+/);const lines=[];let current='';for(const word of words){if(`${current} ${word}`.trim().length>max&&current){lines.push(current);current=`  ${word}`}else current=`${current} ${word}`.trim()}if(current)lines.push(current);return lines.length?lines:['']}
function globalPiPdf(text){const escape=line=>String(line).replace(/[()\\]/g,'\\$&').replace(/[^\x20-\x7E]/g,'?');const source=String(text).split('\n').flatMap(line=>wrapPiExportLine(line));const pages=[];for(let index=0;index<source.length;index+=43)pages.push(source.slice(index,index+43));const objects=[];const pageIds=pages.map((_,index)=>5+index*2);objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';pages.forEach((lines,index)=>{const pageId=pageIds[index],contentId=pageId+1;const stream=`BT 42 805 Td ${lines.map((line,lineIndex)=>{const heading=/^(PROFORMA INVOICE|COMPANY INFORMATION|PI HEADER|BUYER INFORMATION|PRODUCT TABLE|PACKING \/ LOGISTICS SUMMARY|COMMERCIAL SUMMARY|PAYMENT TERMS|BANK INFORMATION|SHIPPING INFORMATION|REMARKS|TERMS & CONDITIONS|SIGNATURES)$/.test(line);return `${lineIndex?'0 -17 Td ':''}${heading?'/F2 11 Tf 0 .28 .20 rg':'/F1 8 Tf 0 0 0 rg'} (${escape(line)}) Tj`}).join(' ')} ET`;objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;objects[contentId]=`<< /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream`});const header='%PDF-1.4\n';let body=header,offset=Buffer.byteLength(header);const xref=['0000000000 65535 f '];for(let id=1;id<objects.length;id++){const object=`${id} 0 obj ${objects[id]} endobj\n`;xref[id]=String(offset).padStart(10,'0')+' 00000 n ';body+=object;offset+=Buffer.byteLength(object)}const startxref=offset;body+=`xref\n0 ${objects.length}\n${xref.join('\n')}\ntrailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;return Buffer.from(body)}

function piMoney(value,currency='USD'){return `${currency} ${new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0))}`}
function piDescription(item){return [item.name,item.size,item.display_material,item.display_finish,item.display_color].filter((value,index,array)=>value&&array.indexOf(value)===index).join(' / ')}
function piItemSku(item){return item.variant_sku||item.variant_snapshot?.sku||item.sku||'CUSTOM'}
function piVariantSize(item){return item.variant_snapshot?.dimensions||item.variant_dimensions||item.size||item.size_dimensions||'TBC'}
function piFinishMaterial(item){return [item.display_finish||item.finish,item.display_material||item.materials].filter(Boolean).join(' / ')||'TBC'}
function piFinishColor(item){return [item.display_finish||item.finish,item.display_color||item.color].filter(Boolean).join(' / ')||'TBC'}
function professionalPiRows(quote){
  const company=quote.company_settings||{},bank=quote.selected_bank_account,s=quote.summary;
  const blank=value=>String(value||'____________________________');
  const tbc=value=>value==null?'TBC':new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(Number(value));
  const rows=[['PROFORMA INVOICE'],['COMPANY INFORMATION']];
  rows.push(['Company Name',company.company_name||''],['Address',company.address||''],['City / State / ZIP',company.city_state_zip||''],['Country',company.country||''],['Phone',company.phone||''],['Email',company.email||''],['Website',company.website||''],['Tax ID / Registration No.',company.registration_no||'']);
  rows.push(['PI HEADER'],['PI No.',quote.quote_number,'Issue Date',quote.quote_date||'','Valid Until',quote.valid_until||''],['Sales Representative',quote.salesperson||'','Currency',quote.currency,'Trade Term',quote.trade_term||''],['Payment Terms Summary',`${quote.deposit_percent}% deposit / ${quote.balance_percent}% balance`,'Buyer Reference No.',quote.buyer_reference_no||'','Project Name',quote.project_name||'']);
  rows.push(['BUYER INFORMATION'],['Customer / Restaurant Name',blank(quote.customer_name),'Company Name',blank(quote.company||quote.customer_name)],['Contact Person',blank(quote.contact_person),'Phone / WhatsApp',blank(quote.buyer_phone)],['Email',blank(quote.buyer_email),'Country',blank(quote.country)],['Billing Address',blank(quote.billing_address),'Delivery Address',blank(quote.destination_address||quote.destination)]);
  rows.push(['PRODUCT TABLE'],['Image','SKU / Model','Product Name','Variant Size','Finish / Material','Quantity','Unit Price','Total Price']);
  for(const item of quote.all_items) rows.push([item.image_url||'Reference image pending',piItemSku(item),item.name||'',piVariantSize(item),piFinishMaterial(item),item.quantity,piMoney(item.unit_price,quote.currency),piMoney(item.line_total,quote.currency)]);
  rows.push(['VARIANT BREAKDOWN'],['Product','Variant / Size','Model / SKU','Qty','Unit Price','Total Price','Remark']);
  for(const item of quote.all_items) rows.push([item.name||'',piVariantSize(item),piItemSku(item),item.quantity,piMoney(item.unit_price,quote.currency),piMoney(item.line_total,quote.currency),item.remark||item.customer_remark||'']);
  rows.push(['FINISH / COLOR SECTION'],['Product','Material','Finish / Color','Customer Remark','Swatch / Reference']);
  for(const item of quote.all_items) rows.push([item.name||'',item.display_material||item.materials||'TBC',piFinishColor(item),item.customer_remark||item.remark||'',item.swatch_image_url||'']);
  rows.push(['PACKING SUMMARY'],['Total Quantity',s.total_quantity],['Total Packages',quote.total_packages??'TBC'],['Total CBM',tbc(s.total_cbm)],['Gross Weight',s.total_gross_weight==null?'TBC':`${tbc(s.total_gross_weight)} kg`],['Net Weight',s.total_net_weight==null?'TBC':`${tbc(s.total_net_weight)} kg`]);
  rows.push(['COMMERCIAL SUMMARY'],['Product Subtotal',piMoney(s.product_subtotal,quote.currency)],['Discount',piMoney(s.discount,quote.currency)],['Freight Cost',s.freight_cost==null?'Freight cost to be quoted separately.':piMoney(s.freight_cost,quote.currency)],['Other Charges',piMoney(s.other_charges,quote.currency)],['Grand Total',piMoney(s.grand_total,quote.currency)],['Deposit Amount',piMoney(s.deposit_amount,quote.currency)],['Balance Amount',piMoney(s.balance_amount,quote.currency)]);
  rows.push(['PAYMENT TERMS'],[quote.payment_note||`${quote.deposit_percent}% deposit before production. ${quote.balance_percent}% balance before shipment.`],['Payment Method',quote.payment_method||'TT Bank Transfer'],['BANK INFORMATION']);
  if(bank) rows.push(['Beneficiary Name',bank.beneficiary_name||''],['Bank Name',bank.bank_name||''],['Bank Address',bank.bank_address||''],['Account Number',bank.account_number||''],['SWIFT / BIC',bank.swift_bic||''],['Routing Number',bank.routing_number||''],['IBAN',bank.iban||''],['Bank Country',bank.bank_country||''],['Payment Currency',bank.payment_currency||'']); else rows.push(['Bank information to be provided separately.']);
  rows.push(['SHIPPING INFORMATION'],['Trade Term',blank(quote.trade_term)],['Shipping Method',blank(quote.shipping_method)],['Origin Port',blank(quote.origin_port)],['Destination Port',blank(quote.destination_port)],['Delivery Address',blank(quote.destination_address||quote.destination)],['Estimated Production Time',blank(quote.production_time)],['Estimated Shipping Time',blank(quote.transit_time)],['Freight Remark',blank(quote.freight_remark)],['REMARKS'],[blank(quote.other_remark)]);
  if(quote.special_terms) rows.push(['Special Terms',quote.special_terms]);
  rows.push(['TERMS & CONDITIONS']);quote.pi_terms.forEach((term,index)=>rows.push([`${index+1}. ${term}`]));
  rows.push(['SIGNATURES'],['Prepared By',blank(quote.salesperson)],['Approved By','Company Representative / Signature'],['Buyer Confirmation','Name / Signature / Date'],['Company Stamp','']);
  return rows;
}
function professionalPiPdf(text){
  const escape=line=>String(line).replace(/[()\\]/g,'\\$&').replace(/[^\x20-\x7E]/g,'?');
  const headings=new Set(['PROFORMA INVOICE','COMPANY INFORMATION','PI HEADER','BUYER INFORMATION','PRODUCT TABLE','VARIANT BREAKDOWN','FINISH / COLOR SECTION','PACKING SUMMARY','COMMERCIAL SUMMARY','PAYMENT TERMS','BANK INFORMATION','SHIPPING INFORMATION','REMARKS','TERMS & CONDITIONS','SIGNATURES']);
  const source=String(text).split('\n').flatMap(line=>wrapPiExportLine(line));const pages=[];
  const firstBreak=Math.max(1,source.indexOf('COMMERCIAL SUMMARY'));pages.push(source.slice(0,firstBreak));for(let index=firstBreak;index<source.length;index+=47)pages.push(source.slice(index,index+47));
  const objects=[],pageIds=pages.map((_,index)=>5+index*2);objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  pages.forEach((lines,index)=>{const pageId=pageIds[index],contentId=pageId+1;const commands=lines.map((line,lineIndex)=>{const heading=headings.has(line);return `${lineIndex?'0 -16 Td ':''}${heading?'/F2 12 Tf 0 .28 .20 rg':'/F1 8.5 Tf 0 0 0 rg'} (${escape(line)}) Tj`}).join(' ');const footer=`BT /F2 8 Tf 0 .28 .20 rg 42 34 Td (Restaurant Setup Pro) Tj ET BT /F1 7 Tf 0 0 0 rg 42 22 Td (Commercial Furniture Solutions | www.restaurantsetuppro.com) Tj ET BT /F1 7 Tf 0 0 0 rg 500 22 Td (Page ${index+1} of ${pages.length}) Tj ET`;const stream=`BT 42 800 Td ${commands} ET ${footer}`;objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;objects[contentId]=`<< /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream`});
  const header='%PDF-1.4\n';let body=header,offset=Buffer.byteLength(header);const xref=['0000000000 65535 f '];for(let id=1;id<objects.length;id++){const object=`${id} 0 obj ${objects[id]} endobj\n`;xref[id]=String(offset).padStart(10,'0')+' 00000 n ';body+=object;offset+=Buffer.byteLength(object)}const startxref=offset;body+=`xref\n0 ${objects.length}\n${xref.join('\n')}\ntrailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;return Buffer.from(body);
}
globalPiRows=professionalPiRows;
simplePdf=professionalPiPdf;

const opportunityStatuses = Object.freeze(['Imported', 'Cleaned', 'Enriched', 'Scored', 'Recommended', 'Ready for Sales', 'Contacted', 'In Progress', 'Replied', 'Qualified', 'Proposal Needed', 'Won', 'Lost', 'Nurture']);
const outreachChannels = Object.freeze(['Email', 'WhatsApp', 'LinkedIn', 'Facebook']);
const outreachTypes = Object.freeze(['First Touch', 'Follow Up 1', 'Follow Up 2', 'Reply Response']);

function opportunityCapabilities(user) {
  const role = user?.role;
  return {
    canView: ['Admin', 'Owner', 'Sales', 'VA'].includes(role),
    canImport: ['Admin', 'Owner', 'VA'].includes(role),
    canEditBasic: ['Admin', 'Owner', 'VA'].includes(role),
    canRunAi: ['Admin', 'Owner'].includes(role),
    canRunCustomerIntelligence: ['Admin', 'Owner', 'Sales'].includes(role),
    canSubmitFeedback: ['Admin', 'Owner', 'Sales'].includes(role),
    canEditDraft: ['Admin', 'Owner', 'Sales'].includes(role),
    canApproveDraft: ['Admin', 'Owner'].includes(role),
    canAcceptLead: ['Admin', 'Owner', 'Sales'].includes(role),
    canDelete: false
  };
}

function parseJsonValue(value, fallback = {}) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function customerActivity(customerId, type, description, userId, metadata = {}) {
  db.prepare('INSERT INTO customer_activity_log (customer_id, activity_type, description, metadata, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(customerId, type, description, JSON.stringify(metadata), userId);
}

function opportunityDebugData() {
  const count = table => Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
  const openGaps = Number(db.prepare("SELECT COUNT(*) AS count FROM customer_data_gaps WHERE status = 'Open'").get().count);
  const queue = Number(db.prepare("SELECT COUNT(*) AS count FROM customers WHERE opportunity_grade IN ('A+', 'A') AND opportunity_status NOT IN ('Won', 'Lost')").get().count);
  const lastRun = db.prepare("SELECT MAX(completed_at) AS value FROM customer_ai_analysis_runs WHERE status = 'completed'").get().value;
  const lastCustomerIntelligenceRun = db.prepare("SELECT MAX(created_at) AS value FROM customer_intelligence_profiles").get()?.value || null;
  const lastError = db.prepare("SELECT error_message FROM customer_ai_analysis_runs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1").get()?.error_message || null;
  const strategyStatuses = db.prepare('SELECT status, COUNT(*) AS count FROM search_strategies GROUP BY status').all();
  const strategyCount = status => Number(strategyStatuses.find(row => row.status === status)?.count || 0);
  return {
    customers_count: count('customers'), contacts_count: count('customer_contacts'), gaps_open: openGaps,
    outreach_drafts_count: count('customer_outreach_drafts'), opportunity_queue_count: queue, last_ai_run_at: lastRun,
    customer_intelligence_profiles_count: count('customer_intelligence_profiles'),
    customer_intelligence_feedback_count: count('customer_intelligence_feedback'),
    score_history_count: count('customer_score_history'),
    discovery_requests_count: count('customer_discovery_requests'),
    search_tasks_count: count('search_tasks'),
    search_strategies_count: count('search_strategies'), search_strategy_statuses: strategyStatuses,
    search_strategies_needs_review: strategyCount('Needs Review'), search_strategies_approved: strategyCount('Approved'),
    search_strategies_superseded: strategyCount('Superseded'),
    approved_strategies_without_task: Number(db.prepare("SELECT COUNT(*) AS count FROM search_strategies WHERE status='Approved' AND linked_search_task_id IS NULL").get().count),
    search_strategy_ai_cost: db.prepare("SELECT COALESCE(SUM(estimated_cost_usd),0) AS estimated,COALESCE(SUM(actual_cost_usd),0) AS actual FROM ai_execution_logs WHERE module_name='search-strategy'").get(),
    search_planning_estimate_total: Number(db.prepare('SELECT COALESCE(SUM(search_cost_estimate),0) AS value FROM search_strategies').get().value),
    blocked_strategy_task_attempts: Number(db.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action IN ('blocked_unapproved_strategy_task_creation','blocked_search_task_ready_without_approved_strategy')").get().count),
    customer_type_profiles_count: count('customer_type_profiles'),
    last_customer_intelligence_run_at: lastCustomerIntelligenceRun,
    scoring_engine_status: 'rules-ready', product_matching_status: 'product-intelligence-connected',
    duplicate_check_status: 'active', provider: process.env.OPPORTUNITY_AI_PROVIDER || 'rules', engine_version: opportunityEngineVersion,
    last_error: lastError
  };
}

function opportunityMetrics() {
  const row = db.prepare(`SELECT COUNT(*) AS total,
    SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS imported_today,
    SUM(CASE WHEN last_ai_run_at IS NOT NULL THEN 1 ELSE 0 END) AS ai_processed,
    SUM(CASE WHEN opportunity_grade = 'A+' THEN 1 ELSE 0 END) AS grade_aplus,
    SUM(CASE WHEN opportunity_grade = 'A' THEN 1 ELSE 0 END) AS grade_a,
    SUM(CASE WHEN opportunity_status = 'Ready for Sales' THEN 1 ELSE 0 END) AS ready_for_sales,
    SUM(CASE WHEN opportunity_status IN ('Contacted', 'In Progress') THEN 1 ELSE 0 END) AS accepted
    FROM customers`).get();
  const gapCount = type => Number(db.prepare("SELECT COUNT(*) AS count FROM customer_data_gaps WHERE gap_type = ? AND status = 'Open'").get(type).count);
  return {
    totalCustomers: Number(row.total || 0), importedToday: Number(row.imported_today || 0), aiProcessed: Number(row.ai_processed || 0),
    gradeAPlus: Number(row.grade_aplus || 0), gradeA: Number(row.grade_a || 0), readyForSales: Number(row.ready_for_sales || 0),
    missingDecisionMaker: gapCount('Missing Decision Maker'), missingEmail: gapCount('Missing Email'),
    missingWhatsApp: gapCount('Missing WhatsApp'), salesAcceptedLeads: Number(row.accepted || 0)
  };
}

const phase2aCustomerTypes = Object.freeze([
  'Hospitality Furniture Distributor',
  'Commercial Furniture Dealer',
  'Hospitality Design Firm',
  'Restaurant Group',
  'Independent Restaurant Owner',
  'Multi-location Restaurant Group',
  'Cafe Owner',
  'Bar Owner',
  'Bubble Tea Shop Owner'
]);
const customerIntelligenceFeedbackTypes = Object.freeze(['Interested', 'Not interested', 'Wrong customer', 'Purchased', 'Future opportunity', 'No response', 'Lost opportunity']);
const customerIntelligenceUpdateReasons = Object.freeze(['New salesperson handoff', 'Customer follow-up restart', 'New customer requirement', 'New information obtained', 'Manual update']);
const restaurantOwnerCustomerTypes = Object.freeze([
  'Restaurant Owner',
  'Restaurant Group',
  'Independent Restaurant Owner',
  'Multi-location Restaurant Group',
  'Cafe Owner',
  'Bar Owner',
  'Bubble Tea Shop Owner'
]);

const discoveryCustomerTypes = Object.freeze([
  'Restaurant Furniture Distributor',
  'Hospitality Furniture Dealer',
  'Restaurant Interior Design Company',
  'Restaurant Contractor',
  'Restaurant Owner',
  'Independent Restaurant Owner',
  'Multi-location Restaurant Group',
  'Cafe Owner',
  'Bar Owner',
  'Bubble Tea Shop Owner',
  'Importer'
]);

const restaurantOwnerDiscoveryDimensions = Object.freeze([
  ['Renovation Opportunity', 30, 'Signals of remodel, refresh, design change, or furniture replacement.'],
  ['Years Operating', 30, 'Operating history that suggests stable business and likely refresh cycles.'],
  ['Expansion Signal', 20, 'Signals of new opening, additional locations, growth, or rollout.'],
  ['Contact Availability', 20, 'Availability of owner, operator, email, phone, website, or decision maker.']
]);

const discoveryProfileTemplates = Object.freeze({
  'Restaurant Furniture Distributor': [
    ['Business Match', 40, 'Fit with commercial restaurant furniture distribution.'],
    ['Purchase Potential', 30, 'Likelihood of recurring product sourcing or project demand.'],
    ['Company Size', 20, 'Ability to handle ongoing hospitality furniture volume.'],
    ['Contact Availability', 10, 'Availability of email, phone, decision maker, or website.']
  ],
  'Hospitality Furniture Dealer': [
    ['Business Match', 40, 'Fit with hospitality or commercial furniture resale.'],
    ['Purchase Potential', 30, 'Need for product catalog, margin, and quote-ready items.'],
    ['Company Size', 20, 'Dealer reach, number of projects, or sales coverage.'],
    ['Contact Availability', 10, 'Availability of verified contact channels.']
  ],
  'Restaurant Interior Design Company': [
    ['Project Capability', 40, 'Ability to specify furniture for restaurant build-outs.'],
    ['Restaurant Experience', 30, 'Visible hospitality, restaurant, cafe, or bar project experience.'],
    ['Client Base', 20, 'Potential access to restaurant owners and groups.'],
    ['Contact Availability', 10, 'Availability of principal, designer, or project manager contact.']
  ],
  'Restaurant Contractor': [
    ['Project Capability', 40, 'Ability to influence restaurant renovation or opening projects.'],
    ['Restaurant Experience', 30, 'Commercial hospitality construction or fit-out experience.'],
    ['Business Value', 20, 'Potential recurring project furniture package demand.'],
    ['Contact Availability', 10, 'Availability of estimator, owner, or project manager contact.']
  ],
  'Restaurant Owner': [
    ...restaurantOwnerDiscoveryDimensions
  ],
  'Independent Restaurant Owner': [
    ...restaurantOwnerDiscoveryDimensions
  ],
  'Multi-location Restaurant Group': [
    ...restaurantOwnerDiscoveryDimensions
  ],
  'Cafe Owner': [
    ...restaurantOwnerDiscoveryDimensions
  ],
  'Bar Owner': [
    ...restaurantOwnerDiscoveryDimensions
  ],
  'Bubble Tea Shop Owner': [
    ...restaurantOwnerDiscoveryDimensions
  ],
  Importer: [
    ['Business Match', 40, 'Fit with importing commercial furniture or hospitality products.'],
    ['Purchase Potential', 30, 'Potential demand for container-level sourcing.'],
    ['Company Size', 20, 'Import capability, market coverage, and sales volume.'],
    ['Contact Availability', 10, 'Availability of purchasing or owner contact.']
  ]
});

function seedCustomerDiscoveryProfiles() {
  const insertProfile = db.prepare(`INSERT INTO customer_type_profiles
    (customer_type, industry, description, sort_order) VALUES (?, 'Hospitality Furniture', ?, ?) RETURNING id`);
  const updateProfile = db.prepare(`UPDATE customer_type_profiles SET industry = 'Hospitality Furniture',
    description = ?, active = TRUE, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  const deleteDimensions = db.prepare('DELETE FROM customer_type_score_dimensions WHERE customer_type_profile_id = ?');
  const insertDimension = db.prepare(`INSERT INTO customer_type_score_dimensions
    (customer_type_profile_id, dimension_name, weight_percent, description, sort_order) VALUES (?, ?, ?, ?, ?)`);
  discoveryCustomerTypes.forEach((customerType, index) => {
    let profile = db.prepare('SELECT id FROM customer_type_profiles WHERE customer_type = ?').get(customerType);
    const description = `${customerType} profile for AI-assisted customer discovery.`;
    if (!profile) profile = insertProfile.get(customerType, description, index + 1);
    else updateProfile.run(description, index + 1, profile.id);
    deleteDimensions.run(profile.id);
    (discoveryProfileTemplates[customerType] || []).forEach(([name, weight, descriptionText], sortIndex) =>
      insertDimension.run(profile.id, name, weight, descriptionText, sortIndex + 1));
  });
  db.prepare("UPDATE customer_type_profiles SET active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE customer_type = 'Restaurant Group'").run();
}

function discoveryProfiles() {
  const profiles = db.prepare("SELECT * FROM customer_type_profiles WHERE active = 1 ORDER BY sort_order, customer_type").all();
  const dimensions = db.prepare('SELECT * FROM customer_type_score_dimensions ORDER BY sort_order, id').all();
  return profiles.map(profile => ({
    ...profile,
    dimensions: dimensions.filter(dimension => dimension.customer_type_profile_id === profile.id)
      .map(dimension => ({ name: dimension.dimension_name, weight: Number(dimension.weight_percent || 0), description: dimension.description }))
  }));
}

function discoveryKeywordsFor(type) {
  const map = {
    'Restaurant Furniture Distributor': ['restaurant furniture supplier', 'hospitality furniture distributor', 'commercial seating supplier', 'restaurant tables and chairs distributor'],
    'Hospitality Furniture Dealer': ['hospitality furniture dealer', 'commercial furniture dealer', 'restaurant furniture showroom', 'contract furniture dealer'],
    'Restaurant Interior Design Company': ['restaurant interior design company', 'hospitality design firm', 'restaurant design studio', 'cafe interior designer'],
    'Restaurant Contractor': ['restaurant contractor', 'restaurant build out contractor', 'hospitality fit out contractor', 'commercial kitchen and dining contractor'],
    'Restaurant Owner': ['restaurant owner', 'coffee shop owner', 'restaurant opening', 'restaurant renovation'],
    'Independent Restaurant Owner': ['independent restaurant owner', 'local restaurant owner', 'restaurant renovation', 'restaurant opening'],
    'Multi-location Restaurant Group': ['restaurant group', 'multi location restaurant group', 'hospitality group', 'restaurant chain expansion'],
    'Cafe Owner': ['coffee shop owner', 'cafe owner', 'coffee shop renovation', 'cafe furniture package'],
    'Bar Owner': ['bar owner', 'cocktail bar owner', 'bar renovation', 'bar furniture package'],
    'Bubble Tea Shop Owner': ['bubble tea shop owner', 'boba tea shop owner', 'bubble tea renovation', 'bubble tea furniture package'],
    Importer: ['furniture importer', 'restaurant furniture importer', 'commercial furniture importer', 'hospitality product importer']
  };
  return map[type] || ['restaurant furniture buyer', 'hospitality furniture customer', 'commercial furniture project'];
}

function inferDiscoveryCustomerType(text) {
  const value = String(text || '').toLowerCase();
  if (/\b(importer|importing|import)\b/.test(value)) return 'Importer';
  if (/\b(distributor|distributors|supplier|suppliers|wholesale|reseller|resellers)\b/.test(value)) return 'Restaurant Furniture Distributor';
  if (/\b(dealer|showroom)\b/.test(value)) return 'Hospitality Furniture Dealer';
  if (/\b(design|designer|interior|architect|studio)\b/.test(value)) return 'Restaurant Interior Design Company';
  if (/\b(contractor|builder|build[- ]?out|fit[- ]?out|construction)\b/.test(value)) return 'Restaurant Contractor';
  if (/\b(group|chain|multi[- ]?location|franchise)\b/.test(value)) return 'Multi-location Restaurant Group';
  if (/\b(bubble tea|boba)\b/.test(value)) return 'Bubble Tea Shop Owner';
  if (/\b(bar|pub|cocktail)\b/.test(value)) return 'Bar Owner';
  if (/\b(coffee shop|restaurant cafe|cafe|café)\b/.test(value)) return 'Cafe Owner';
  if (/\b(owner|operator|restaurant|bakery)\b/.test(value)) return 'Independent Restaurant Owner';
  return null;
}

function inferDiscoveryLocation(text) {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  const countries = [
    ['usa', 'USA'], ['united states', 'USA'], ['america', 'USA'], ['canada', 'Canada'], ['mexico', 'Mexico'],
    ['malaysia', 'Malaysia'], ['singapore', 'Singapore'], ['australia', 'Australia'], ['uk', 'United Kingdom'], ['united kingdom', 'United Kingdom']
  ];
  const regions = ['California', 'Texas', 'Florida', 'New York', 'Los Angeles', 'San Francisco', 'Dallas', 'Houston', 'Austin', 'Miami', 'Chicago', 'Seattle', 'Toronto', 'London'];
  let country = countries.find(([needle]) => lower.includes(needle))?.[1] || null;
  const region = regions.find(regionName => lower.includes(regionName.toLowerCase())) || null;
  if (!country && ['California', 'Texas', 'Florida', 'New York', 'Los Angeles', 'San Francisco', 'Dallas', 'Houston', 'Austin', 'Miami', 'Chicago', 'Seattle'].includes(region)) country = 'USA';
  return { country, region };
}

function inferCompanySize(text, customerType) {
  const value = String(text || '').toLowerCase();
  const range = value.match(/\b(\d{1,5})\s*(?:-|to|–|—)\s*(\d{1,5})\s*(?:employees|employee|staff|people|team members)?\b/i);
  const single = value.match(/\b(\d{1,5})\s*(?:employees|employee|staff|people|team members)\b/i);
  const classify = count => count <= 50 ? 'Small company' : count <= 250 ? 'Medium company' : 'Large company';
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return { label: classify(max), detail: `${min}-${max} employees` };
  }
  if (single) {
    const count = Number(single[1]);
    return { label: classify(count), detail: `${count} employees` };
  }
  if (/\bsmall\b/.test(value)) return { label: 'Small company', detail: 'Small company' };
  if (/\bmedium|mid[- ]?size\b/.test(value)) return { label: 'Medium company', detail: 'Medium company' };
  if (/\blarge|enterprise|national|chain\b/.test(value)) return { label: 'Large company', detail: 'Large company' };
  const fallback = ['Restaurant Furniture Distributor', 'Hospitality Furniture Dealer', 'Restaurant Interior Design Company', 'Restaurant Contractor', 'Importer'].includes(customerType)
    ? 'Small / Medium company'
    : 'Unknown';
  return { label: fallback, detail: fallback };
}

function buildDiscoveryGuidance({ rawRequest, customerType, country, region }) {
  const value = String(rawRequest || '').trim();
  const suggestions = [];
  if (!country) suggestions.push('Target country');
  if (!customerType) suggestions.push('Customer type');
  if (!region) suggestions.push('Region / city');
  if (!/\b(small|medium|large|chain|group|distributor|dealer|owner|designer|contractor)\b/i.test(value)) suggestions.push('Company size');
  if (!/\b(chair|table|booth|seating|furniture|bar stool|counter|partition)\b/i.test(value)) suggestions.push('Product category');
  if (!/\b(owner|purchasing|manager|designer|decision maker|buyer)\b/i.test(value)) suggestions.push('Decision maker requirement');
  const broad = value.split(/\s+/).filter(Boolean).length < 4 || /find restaurant customers?$/i.test(value);
  return {
    needs_more_information: broad || suggestions.length >= 3,
    message: broad || suggestions.length >= 3
      ? 'Your search request is broad. Add a few filters before execution to improve result quality.'
      : 'The request is specific enough to create an initial search plan.',
    suggestions,
    recommended_next_step: customerType
      ? `Search ${inferCompanySize(value, customerType).label.toLowerCase()} ${customerType.toLowerCase()} first.`
      : 'Choose a customer type before running discovery.'
  };
}

function buildDiscoveryPlan(rawRequest) {
  const customerType = inferDiscoveryCustomerType(rawRequest);
  const { country, region } = inferDiscoveryLocation(rawRequest);
  const companySize = inferCompanySize(rawRequest, customerType);
  const industry = 'Hospitality Furniture';
  const profiles = discoveryProfiles();
  const scoringProfile = profiles.find(profile => profile.customer_type === customerType) || null;
  const plan = {
    target_customer_type: customerType || 'Needs Clarification',
    industry,
    country: country || 'Needs Clarification',
    region_city: region || 'Needs Clarification',
    company_size: companySize.label,
    company_size_detail: companySize.detail,
    recommended_keywords: discoveryKeywordsFor(customerType),
    recommended_search_sources: ['Google Maps', 'LinkedIn', 'Company Website'],
    suggested_filters: ['Target country', 'Customer type', 'Company size', 'Product category', 'Decision maker requirement'].filter(Boolean),
    excluded_customers: restaurantOwnerCustomerTypes.includes(customerType)
      ? ['Residential furniture shoppers', 'Low-budget one-time buyers without project timing', 'Non-commercial home decor stores']
      : ['Large retail furniture chains', 'Residential furniture stores', 'Non-hospitality furniture sellers'],
    confidence_score: customerType && country ? 82 : customerType || country ? 58 : 35
  };
  return { plan, guidance: buildDiscoveryGuidance({ rawRequest, customerType, country, region }), scoringProfile };
}

function buildGeneratedSearchPlan(plan, guidance) {
  const ready = !guidance?.needs_more_information && plan?.target_customer_type !== 'Needs Clarification' && plan?.country !== 'Needs Clarification';
  const customerType = String(plan?.target_customer_type || '');
  const priority = customerType.includes('Distributor') || customerType.includes('Importer') || customerType.includes('Design') || customerType.includes('Dealer')
    ? 'High'
    : customerType.includes('Owner')
    ? 'Medium'
    : ready ? 'Medium' : 'Low';
  const priorityReasons = [
    'Hospitality related business',
    ...(customerType.includes('Distributor') || customerType.includes('Dealer') ? ['Potential repeat buyer'] : []),
    ...(customerType.includes('Importer') || customerType.includes('Distributor') ? ['Possible furniture importer'] : []),
    ...(customerType.includes('Design') || customerType.includes('Contractor') ? ['Works with restaurant clients'] : []),
    ...(customerType.includes('Owner') || customerType.includes('Group') ? ['Direct restaurant furniture demand'] : [])
  ];
  const searchVolume = priority === 'High' ? '100 companies' : priority === 'Medium' ? '50 companies' : '25 companies';
  return {
    status: ready ? 'Ready for Search' : 'Draft Search Plan',
    target_customer: [plan?.company_size, plan?.target_customer_type].filter(value => value && value !== 'Unknown' && value !== 'Needs Clarification').join(' ') || plan?.target_customer_type || 'Needs Clarification',
    customer_type: plan?.target_customer_type || 'Needs Clarification',
    industry: plan?.industry || 'Hospitality Furniture',
    location: [plan?.region_city, plan?.country].filter(value => value && value !== 'Needs Clarification').join(', ') || 'Needs Clarification',
    company_size: plan?.company_size || 'Unknown',
    company_size_detail: plan?.company_size_detail || plan?.company_size || 'Unknown',
    recommended_search_volume: searchVolume,
    priority,
    priority_reasons: priorityReasons,
    search_objective: ready
      ? `Find ${String(plan.target_customer_type).toLowerCase()} leads in ${[plan.region_city, plan.country].filter(value => value && value !== 'Needs Clarification').join(', ')} for Restaurant Setup Pro sales qualification.`
      : 'Clarify the missing search requirements, then use this plan to guide customer discovery.',
    recommended_filters: ['Location', 'Company Size', 'Customer Type', 'Decision Maker', 'Business Type', 'Purchase Potential'],
    search_keywords: plan?.recommended_keywords || [],
    recommended_data_fields: ['Company Name', 'Website', 'City', 'Country', 'Contact Person', 'Email', 'Phone', 'LinkedIn', 'Instagram', 'Company Size', 'Business Type'],
    exclude: plan?.excluded_customers || []
  };
}

function strategyTextValues(value) {
  if (Array.isArray(value)) return value.flatMap(strategyTextValues);
  return String(value || '').split(/\r?\n|[,;]+/).map(item => item.trim()).filter(item => item && item !== 'Needs Clarification');
}

function uniqueStrategyValues(...groups) {
  return [...new Set(groups.flatMap(strategyTextValues))];
}

function strategyDataFromContext(strategy, context = {}) {
  const request = strategy.customer_discovery_request_id ? db.prepare('SELECT * FROM customer_discovery_requests WHERE id = ?').get(strategy.customer_discovery_request_id) : null;
  const plan = parseJsonValue(request?.search_plan, {}), guidance = parseJsonValue(request?.guidance, {});
  const generated = buildGeneratedSearchPlan(plan, guidance);
  const location = String(generated.location || '').split(',').map(value => value.trim()).filter(Boolean);
  const expected = Math.max(0, Number(String(generated.recommended_search_volume || '').match(/\d+/)?.[0] || 50));
  const companies = Array.isArray(context.companyKnowledge) ? context.companyKnowledge : [], profiles = Array.isArray(context.targetCustomerProfiles) ? context.targetCustomerProfiles : [];
  const companyContent = companies.map(item => parseJsonValue(item.content_json, {})), profileContent = profiles.map(item => parseJsonValue(item.content_json, {}));
  const knowledgeCountries = uniqueStrategyValues(profileContent.map(item => item.target_countries || item.countries || []), companyContent.map(item => item.target_countries || item.countries || []));
  const discoveryCountries = uniqueStrategyValues(request?.country, location.slice(-1));
  const countries = knowledgeCountries.length ? knowledgeCountries : discoveryCountries;
  const customerTypes = uniqueStrategyValues(profileContent.map(item => item.customer_types || item.target_customer_types || []), generated.customer_type, plan.target_customer_type);
  const productCategories = uniqueStrategyValues(profileContent.map(item => item.product_categories || item.product_directions || []), companyContent.map(item => item.main_product_categories || item.product_categories || []), 'Restaurant Furniture');
  const businessSignals = uniqueStrategyValues(profileContent.map(item => item.target_business_signals || item.business_signals || item.buying_signals || []));
  const exclusions = uniqueStrategyValues(profileContent.map(item => item.exclusions || item.exclusion_rules || []), generated.exclude || plan.excluded_customers || []);
  const knowledgeKeywords = customerTypes.flatMap(type => productCategories.map(category => `${type} ${category}`));
  const searchKeywords = uniqueStrategyValues(generated.search_keywords || plan.recommended_keywords || [], knowledgeKeywords, customerTypes, productCategories.map(category => `${category} supplier`));
  const warnings = [];
  if (!countries.length) warnings.push('Target country is missing from Active Knowledge and the Discovery Request.');
  if (!customerTypes.length) warnings.push('Target customer type is missing from Active Knowledge and the Discovery Request.');
  if (!searchKeywords.length) warnings.push('Search keywords require a target customer type or product category.');
  return { ...blankSearchStrategyData(strategy.objective || generated.search_objective), targetMarket: { countries, cities: uniqueStrategyValues(request?.region, location.slice(0, -1)), regions: [] }, targetCustomerProfile: { customerTypes, companySize: { description: strategyTextValues(generated.company_size_detail || generated.company_size)[0] || '' }, businessAge: {}, locationCount: {}, expectedOrderRange: {} }, searchObjective: strategy.objective || (customerTypes.length ? `Find qualified ${customerTypes.join(', ')} in ${countries.join(', ') || 'the approved target market'}` : generated.search_objective) || 'Find qualified restaurant furniture buyers', productCategories, searchKeywords, negativeKeywords: uniqueStrategyValues(exclusions, 'jobs', 'residential only'), platforms: ['Google Maps', 'Company Websites'], sourcePriority: ['Company Websites', 'Google Maps'], positiveSignals: { buyingSignals: businessSignals.length ? businessSignals : ['New furniture requirement', 'Commercial project'], renovationSignals: businessSignals.filter(value => /renovat|remodel|refurbish/i.test(value)), expansionSignals: businessSignals.filter(value => /expan|new location|multi-location|growth/i.test(value)) }, exclusionRules: uniqueStrategyValues(exclusions, generated.recommended_filters || []), resultTarget: { expectedCount: expected, minimumQualifiedCount: Math.max(1, Math.floor(expected * 0.2)) }, stopConditions: ['Stop when the approved planning budget is reached', 'Stop when the expected result count is reached'], reasoning: ['Built from approved Active Knowledge and the linked Discovery Request.'], warnings, confidence: warnings.length ? 0.65 : 0.85 };
}

function searchPlanningEstimate(data) {
  const platforms = data.platforms.length || 1, locations = Math.max(1, data.targetMarket.countries.length + data.targetMarket.cities.length), keywords = Math.max(1, data.searchKeywords.length), results = Number(data.resultTarget.expectedCount || 0);
  const expected = Math.round((platforms * locations * keywords * 0.004 + results * 0.002) * 1e6) / 1e6;
  return { currency: 'USD', low: Math.round(expected * 0.75 * 1e6) / 1e6, expected, high: Math.round(expected * 1.25 * 1e6) / 1e6, assumptions: [`${platforms} planned platforms`, `${locations} target locations`, `${keywords} keyword groups`, `${results} expected results`, 'No connector call or real charge was made.'], pricingVersion: 'workflow-1b-planning-v1', estimatedAt: new Date().toISOString(), estimateType: 'planning' };
}

function safeStrategy(strategy, user) {
  if (!strategy || ['Admin', 'Owner'].includes(user?.role)) return strategy;
  const metadata = { ...(strategy.generation_metadata_json || {}) };
  delete metadata.requestedProvider; delete metadata.providerConfiguration;
  return { ...strategy, generation_metadata_json: metadata, total_budget_limit: null };
}

function normalizeSearchTask(row) {
  if (!row) return null;
  return {
    ...row,
    keywords: parseJsonValue(row.keywords, []),
    filters: parseJsonValue(row.filters, []),
    required_data_fields: parseJsonValue(row.required_data_fields, [])
  };
}

function nextSearchTaskName() {
  const next = Number(db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS value FROM search_tasks').get().value || 1);
  return `Search Task #${String(next).padStart(3, '0')}`;
}

const searchTaskStatuses = Object.freeze(['Draft', 'Ready', 'Running', 'Paused', 'Completed']);
const searchResultStatuses = Object.freeze(['new', 'reviewed', 'converted', 'discarded']);

function normalizeSearchResult(row) {
  if (!row) return null;
  const evidence = parseSearchResultEvidence(row.source_reference);
  return {
    ...row,
    opportunity_score: Number(row.opportunity_score || 0),
    source_url: evidence.source_url,
    reference_note: evidence.reference_note,
    recommended_product_reason: recommendedProductReasonFor(row.customer_type, row.business_type)
  };
}

function parseSearchResultEvidence(value) {
  const text = String(value || '').trim();
  if (!text) return { source_url: null, reference_note: null };
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return {
        source_url: String(parsed.source_url || parsed.sourceReference || '').trim() || null,
        reference_note: String(parsed.reference_note || parsed.referenceNote || '').trim() || null
      };
    }
  } catch {}
  return { source_url: text, reference_note: null };
}

function searchResultEvidenceValue(body = {}, existing = {}) {
  const existingEvidence = parseSearchResultEvidence(existing.source_reference);
  const sourceUrl = String(body.source_url ?? body.source_reference ?? existing.source_url ?? existingEvidence.source_url ?? '').trim();
  const referenceNote = String(body.reference_note ?? existing.reference_note ?? existingEvidence.reference_note ?? '').trim();
  if (!sourceUrl && !referenceNote) return null;
  return JSON.stringify({ source_url: sourceUrl || null, reference_note: referenceNote || null });
}

function searchResultsForTask(taskId) {
  return db.prepare(`SELECT search_results.*, users.name AS created_by_name, customers.company_name AS converted_customer_name
    FROM search_results LEFT JOIN users ON users.id = search_results.created_by
    LEFT JOIN customers ON customers.id = search_results.customer_id
    WHERE search_results.search_task_id = ?
    ORDER BY CASE search_results.status WHEN 'new' THEN 1 WHEN 'reviewed' THEN 2 WHEN 'converted' THEN 3 ELSE 4 END,
      search_results.opportunity_score DESC, search_results.updated_at DESC, search_results.id DESC`).all(taskId).map(normalizeSearchResult);
}

function searchResultDetail(id) {
  return normalizeSearchResult(db.prepare(`SELECT search_results.*, search_tasks.task_name, users.name AS created_by_name,
    customers.company_name AS converted_customer_name
    FROM search_results JOIN search_tasks ON search_tasks.id = search_results.search_task_id
    LEFT JOIN users ON users.id = search_results.created_by
    LEFT JOIN customers ON customers.id = search_results.customer_id
    WHERE search_results.id = ?`).get(id));
}

function searchResultSummary(results) {
  const counts = { total: results.length, new: 0, reviewed: 0, converted: 0, discarded: 0 };
  for (const result of results) if (counts[result.status] !== undefined) counts[result.status] += 1;
  return counts;
}

function buildSearchResultQualification(body, task) {
  const hasManualScore = body.opportunity_score !== undefined && body.opportunity_score !== null && String(body.opportunity_score).trim() !== '';
  const location = [body.city, body.country].filter(Boolean).join(', ') || task?.location || 'Unknown location';
  const customerType = String(body.customer_type || task?.customer_type || 'Hospitality customer').trim();
  const company = requiredText(body.company_name, 'Company name');
  const inferredScore = clampScore(
    35
    + (customerType ? 20 : 0)
    + (body.website ? 15 : 0)
    + (body.email || body.phone || body.contact_person ? 15 : 0)
    + (body.source_url || body.source_reference ? 10 : 0)
    + (body.business_type ? 5 : 0)
  );
  const score = clampScore(hasManualScore ? body.opportunity_score : inferredScore);
  const evaluatedPotential = String(body.purchase_potential || '').trim() || (score >= 75 ? 'High' : score >= 45 ? 'Medium' : 'Low');
  const why = [
    customerType && `${customerType} matches the active search task.`,
    body.business_type && `Business type: ${body.business_type}.`,
    evaluatedPotential && `Purchase potential: ${evaluatedPotential}.`,
    body.email || body.phone || body.website ? 'Contact or website information is available.' : 'Contact information still needs review.',
    body.source_url || body.source_reference ? 'Source evidence is saved for future handoff.' : null,
    body.reference_note ? `Evidence note: ${body.reference_note}.` : null
  ].filter(Boolean).join(' ');
  return {
    purchase_potential: evaluatedPotential,
    opportunity_score: score,
    qualification_reason: String(body.qualification_reason || why).trim(),
    opportunity_summary: `${company} is a ${customerType} candidate in ${location} with ${evaluatedPotential} purchase potential.`,
    why_customer_matters: why,
    recommended_next_action: score >= 75
      ? 'Review immediately, verify decision maker, and prepare a first sales touch.'
      : score >= 45
        ? 'Review details, complete missing contact information, and keep in the opportunity queue.'
        : 'Keep as low-priority discovery result unless better qualification evidence appears.'
  };
}

function searchResultFieldValues(body, existing = {}, task = {}) {
  const qualification = buildSearchResultQualification({ ...existing, ...body }, task);
  return {
    company_name: requiredText(body.company_name ?? existing.company_name, 'Company name'),
    customer_type: String(body.customer_type ?? existing.customer_type ?? task.customer_type ?? '').trim() || null,
    industry: String(body.industry ?? existing.industry ?? task.industry ?? 'Hospitality Furniture').trim() || 'Hospitality Furniture',
    country: String(body.country ?? existing.country ?? '').trim() || null,
    city: String(body.city ?? existing.city ?? '').trim() || null,
    website: normalizeUrl(body.website ?? existing.website),
    contact_person: String(body.contact_person ?? existing.contact_person ?? '').trim() || null,
    email: String(body.email ?? existing.email ?? '').trim() || null,
    phone: String(body.phone ?? existing.phone ?? '').trim() || null,
    linkedin: normalizeUrl(body.linkedin ?? existing.linkedin),
    instagram: normalizeUrl(body.instagram ?? existing.instagram),
    company_size: String(body.company_size ?? existing.company_size ?? '').trim() || null,
    business_type: String(body.business_type ?? existing.business_type ?? '').trim() || null,
    purchase_potential: qualification.purchase_potential,
    opportunity_score: qualification.opportunity_score,
    qualification_reason: qualification.qualification_reason,
    opportunity_summary: qualification.opportunity_summary,
    why_customer_matters: qualification.why_customer_matters,
    recommended_next_action: qualification.recommended_next_action,
    source_type: String(body.source_type ?? existing.source_type ?? 'Manual').trim() || 'Manual',
    source_reference: searchResultEvidenceValue(body, existing)
  };
}

function scoreGrade(score) {
  const value = Number(score || 0);
  if (value >= 90) return 'A+';
  if (value >= 75) return 'A';
  if (value >= 60) return 'B';
  if (value >= 40) return 'C';
  return 'D';
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function inferCustomerType(customer) {
  const existing = String(customer.customer_type || '').trim();
  if (phase2aCustomerTypes.includes(existing)) return existing;
  const text = `${customer.business_type || ''} ${customer.company_name || ''} ${customer.brand_name || ''} ${customer.website || ''}`.toLowerCase();
  if (/distributor|wholesale|importer/.test(text)) return 'Hospitality Furniture Distributor';
  if (/dealer|commercial furniture|contract furniture/.test(text)) return 'Commercial Furniture Dealer';
  if (/design|interior|architecture|studio|firm/.test(text)) return 'Hospitality Design Firm';
  if (/bubble tea|boba/.test(text)) return 'Bubble Tea Shop Owner';
  if (/\bbar\b|pub|cocktail/.test(text)) return 'Bar Owner';
  if (/coffee shop|cafe|café/.test(text)) return 'Cafe Owner';
  if (/group|chain|franchise|restaurant group|hospitality group|multi[- ]?location/.test(text) || Number(customer.store_count || 0) >= 2) return 'Multi-location Restaurant Group';
  return 'Independent Restaurant Owner';
}

function timingFromSignals(customer, signalText) {
  const explicit = String(customer.expected_purchase_timing || '').trim();
  if (explicit) return { purchase_timing: explicit, purchase_timing_confidence: 'High' };
  if (/\b(now|urgent|asap|rfq|quote|opening soon|this month|next month|within 30|within 60)\b/i.test(signalText)) return { purchase_timing: 'Near term', purchase_timing_confidence: 'Medium' };
  if (/\b(future|later|planning|next year)\b/i.test(signalText)) return { purchase_timing: 'Future opportunity', purchase_timing_confidence: 'Medium' };
  return { purchase_timing: 'Unknown', purchase_timing_confidence: 'Low' };
}

function calculateCustomerIntelligence(customer) {
  const type = inferCustomerType(customer);
  const recommendations = productRecommendationsFor({ ...customer, business_type: customer.business_type || (type.includes('Restaurant') ? 'Restaurant' : customer.business_type) });
  const contacts = db.prepare('SELECT * FROM customer_contacts WHERE customer_id = ?').all(customer.id);
  const hasContact = Boolean(customer.email || customer.whatsapp || customer.phone || customer.website || contacts.length);
  const hasDecisionMaker = contacts.some(contact => Number(contact.is_primary_decision_maker) === 1);
  const quoteCount = Number(db.prepare('SELECT COUNT(*) AS count FROM sales_quotes WHERE customer_id = ?').get(customer.id).count || 0);
  const orderCount = Number(db.prepare('SELECT COUNT(*) AS count FROM sales_orders WHERE customer_id = ?').get(customer.id).count || 0);
  const inquiryCount = Number(db.prepare('SELECT COUNT(*) AS count FROM sales_inquiries WHERE customer_id = ?').get(customer.id).count || 0);
  const typePoints = {
    'Hospitality Furniture Distributor': 35,
    'Commercial Furniture Dealer': 32,
    'Hospitality Design Firm': 30,
    'Restaurant Group': 26,
    'Multi-location Restaurant Group': 28,
    'Independent Restaurant Owner': 16,
    'Cafe Owner': 18,
    'Bar Owner': 18,
    'Bubble Tea Shop Owner': 18
  }[type] || 10;
  const industryText = `${customer.industry || ''} ${customer.business_type || ''} ${customer.company_name || ''}`.toLowerCase();
  const industryFit = /hospitality|restaurant|coffee|bar|bakery|hotel|food|furniture|design/.test(industryText) ? 20 : 8;
  const productFit = Math.min(15, recommendations.length * 4);
  const businessModel = (type.includes('Distributor') || type.includes('Dealer') ? 10 : 0) + (Number(customer.store_count || 0) >= 2 ? 6 : 0) + (customer.country ? 4 : 0);
  const relationship = Math.min(20, quoteCount * 5 + orderCount * 10 + inquiryCount * 3 + (hasDecisionMaker ? 4 : 0));
  const customerValueScore = clampScore(typePoints + industryFit + productFit + businessModel + relationship);
  const customerValueExplanation = `${type} profile: type fit ${typePoints}, industry fit ${industryFit}, product fit ${productFit}, business model ${businessModel}, relationship ${relationship}.`;

  const signalText = `${customer.project_information || ''} ${customer.customer_comments || ''} ${customer.opportunity_notes || ''} ${customer.ai_summary || ''} ${customer.ai_recommendation || ''} ${customer.business_type || ''}`.toLowerCase();
  const signals = [];
  if (/\b(new project|new store|opening|buildout|project)\b/i.test(signalText)) signals.push('Project signal');
  if (/\b(expansion|new location|chain|franchise)\b/i.test(signalText) || Number(customer.expansion_probability || 0) >= 60) signals.push('Expansion signal');
  if (/\b(renovation|remodel|rebrand|upgrade)\b/i.test(signalText) || Number(customer.renovation_probability || 0) >= 60) signals.push('Renovation signal');
  if (/\b(rfq|quote|quotation|price|ddp|proposal|pi)\b/i.test(signalText)) signals.push('RFQ signal');
  if (inquiryCount > 0) signals.push('Direct inquiry');
  if (Number(customer.furniture_need_probability || 0) >= 60) signals.push('Furniture need probability');
  const timing = timingFromSignals(customer, signalText);
  let buyingOpportunityScore;
  let buyingOpportunityExplanation;
  if (restaurantOwnerCustomerTypes.includes(type)) {
    const renovationProbability = Number(customer.renovation_probability || 0);
    const expansionProbability = Number(customer.expansion_probability || 0);
    const yearsOperating = Number(customer.years_in_business || 0);
    const hasRenovationSignal = /\b(renovation|remodel|rebrand|upgrade|refresh|replace|replacement)\b/i.test(signalText);
    const hasExpansionSignal = /\b(expansion|new location|opening|chain|franchise|multi[- ]?location)\b/i.test(signalText) || Number(customer.store_count || 0) >= 2;
    const renovationScore = Math.min(30, Math.max(Math.round(renovationProbability * 0.3), hasRenovationSignal ? 24 : 0));
    const yearsScore = yearsOperating >= 3 ? 30 : yearsOperating >= 1 ? 18 : 0;
    const expansionScore = Math.min(20, Math.max(Math.round(expansionProbability * 0.2), hasExpansionSignal ? 16 : 0));
    const ownerContactScore = hasContact ? 20 : 0;
    buyingOpportunityScore = clampScore(renovationScore + yearsScore + expansionScore + ownerContactScore);
    buyingOpportunityExplanation = `Restaurant Owner opportunity model: Renovation Opportunity ${renovationScore}/30, Years Operating ${yearsScore}/30, Expansion Signal ${expansionScore}/20, Contact Availability ${ownerContactScore}/20. Purchase timing: ${timing.purchase_timing}.`;
  } else {
    const signalScore = Math.min(45, signals.length * 10);
    const probabilityScore = Math.round((Number(customer.expansion_probability || 0) + Number(customer.renovation_probability || 0) + Number(customer.furniture_need_probability || 0)) / 10);
    const contactScore = hasContact ? 10 : 0;
    const confidenceBoost = timing.purchase_timing === 'Unknown' ? 0 : 10;
    buyingOpportunityScore = clampScore(signalScore + probabilityScore + contactScore + confidenceBoost);
    buyingOpportunityExplanation = signals.length
      ? `Detected ${signals.join(', ')}. Purchase timing: ${timing.purchase_timing}.`
      : 'No clear project, RFQ, expansion, renovation, or timing signal is available. Purchase timing remains Unknown with Low confidence.';
  }

  const salesPriorityScore = clampScore(customerValueScore * 0.45 + buyingOpportunityScore * 0.45 + (hasContact ? 10 : 0));
  const salesPriorityExplanation = `Sales priority combines long-term customer value (${customerValueScore}), short-term buying opportunity (${buyingOpportunityScore}), and contactability (${hasContact ? 'available' : 'missing'}).`;
  const aiRecommendation = salesPriorityScore >= 75
    ? 'Prioritize for sales review and prepare a tailored hospitality furniture conversation.'
    : customerValueScore >= 75
      ? 'High-value strategic customer. Maintain relationship and monitor buying signals.'
      : buyingOpportunityScore >= 60
        ? 'Short-term opportunity exists. Verify budget, timing, and decision maker before quoting.'
        : 'Keep in nurture or data completion queue until stronger buying signals appear.';
  return {
    customer_type: type,
    industry: customer.industry || 'Hospitality Furniture',
    customer_value_score: customerValueScore,
    customer_value_grade: scoreGrade(customerValueScore),
    customer_value_explanation: customerValueExplanation,
    buying_opportunity_score: buyingOpportunityScore,
    buying_opportunity_grade: scoreGrade(buyingOpportunityScore),
    buying_opportunity_explanation: buyingOpportunityExplanation,
    purchase_timing: timing.purchase_timing,
    purchase_timing_confidence: timing.purchase_timing_confidence,
    sales_priority_score: salesPriorityScore,
    sales_priority_explanation: salesPriorityExplanation,
    ai_recommendation: aiRecommendation,
    signals,
    recommendations: recommendations.slice(0, 5)
  };
}

function productRecommendationsFor(customer) {
  const mappings = {
    'Coffee Shop': ['Dining Chair', 'Restaurant Table', 'Booth Seating', 'Counter / Service Bar'],
    Restaurant: ['Booth Seating', 'Dining Chair', 'Restaurant Table', 'Partition / Divider'],
    'Bubble Tea': ['Dining Chair', 'Restaurant Table', 'Counter / Service Bar'],
    Bar: ['Bar Stool', 'Counter / Service Bar', 'Restaurant Table'],
    Bakery: ['Dining Chair', 'Restaurant Table', 'Booth Seating'],
    Hotel: ['Outdoor Furniture', 'Dining Chair', 'Restaurant Table'],
    'Food Court': ['Restaurant Table', 'Dining Chair', 'Partition / Divider']
  };
  const categories = mappings[customer.business_type] || ['Dining Chair', 'Restaurant Table', 'Booth Seating'];
  const placeholders = categories.map(() => '?').join(',');
  const rows = db.prepare(`SELECT products.id AS product_id, products.name, products.budget_level,
    product_categories.id AS category_id, product_categories.name AS category,
    CASE WHEN EXISTS (SELECT 1 FROM product_knowledge_links pkl JOIN product_knowledge_terms pkt ON pkt.id = pkl.term_id
      WHERE pkl.product_id = products.id AND pkt.term_type = 'store_type' AND pkt.name = ?) THEN 20 ELSE 0 END +
    COALESCE(products.ai_recommendation_weight, 50) AS match_score
    FROM products JOIN product_categories ON product_categories.id = products.category_id
    WHERE product_categories.name IN (${placeholders}) AND products.status != 'archived'
    ORDER BY match_score DESC, CASE products.proposal_ready_status WHEN 'Proposal Ready' THEN 1 ELSE 2 END, products.id LIMIT 7`).all(customer.business_type || '', ...categories);
  const seen = new Set();
  const matched = rows.filter(row => !seen.has(row.category) && seen.add(row.category)).map(row => ({
    ...row,
    recommendation_reason: `${row.category} matches the ${customer.business_type || 'hospitality'} profile${customer.style_signal ? ` and ${customer.style_signal} style signal` : ''}.`,
    sales_angle: `${row.name}: factory-direct commercial furniture${customer.budget_estimate ? ` aligned to ${customer.budget_estimate}` : ''}.`
  }));
  const categoryRows = db.prepare(`SELECT id, name FROM product_categories WHERE name IN (${placeholders}) ORDER BY name`).all(...categories);
  for (const category of categoryRows) if (!seen.has(category.name)) matched.push({
    product_id: null, product_name: null, name: category.name, category_id: category.id, category: category.name, match_score: 50,
    recommendation_reason: `${category.name} is a recommended product direction for the ${customer.business_type || 'hospitality'} profile.`,
    sales_angle: `${category.name}: propose a factory-direct custom project package${customer.budget_estimate ? ` for the ${customer.budget_estimate} budget signal` : ''}.`
  });
  return matched;
}

function recommendedProductReasonFor(customerType, businessType) {
  const type = String(customerType || businessType || '').toLowerCase();
  if (type.includes('distributor') || type.includes('dealer') || type.includes('reseller')) {
    return 'Hospitality furniture reseller: recommend Booth Seating, Restaurant Tables, and Dining Chairs as repeatable catalog products.';
  }
  if (type.includes('design') || type.includes('contractor')) {
    return 'Restaurant project capability: recommend Custom Booth Seating and Project Furniture Package for design-led projects.';
  }
  if (type.includes('group') || type.includes('multi-location')) {
    return 'Multi-location operator: recommend standardized Dining Chairs, Restaurant Tables, Booth Seating, and repeatable package pricing.';
  }
  if (type.includes('cafe') || type.includes('coffee')) {
    return 'Cafe operator: recommend compact Dining Chairs, Restaurant Tables, Booth Seating, and Counter / Service Bar options.';
  }
  if (type.includes('bar')) {
    return 'Bar operator: recommend Bar Stools, Counter / Service Bar, and durable Restaurant Tables.';
  }
  if (type.includes('bubble') || type.includes('boba')) {
    return 'Bubble tea shop operator: recommend Dining Chairs, Restaurant Tables, and Counter / Service Bar for fast casual layout.';
  }
  return 'Hospitality related business: recommend core restaurant furniture categories after confirming store type and project scope.';
}

function mappedCustomer(row) {
  if (!row) return null;
  return {
    ...row,
    is_test_data: Boolean(row.is_test_data),
    source_confidence: Number(row.source_confidence || 0),
    confidence_score: Number(row.confidence_score || 0),
    customer_value_score: Number(row.customer_value_score || 0),
    buying_opportunity_score: Number(row.buying_opportunity_score || 0),
    sales_priority_score: Number(row.sales_priority_score || 0)
  };
}

function customerRecommendationNames(customerId) {
  return db.prepare(`SELECT DISTINCT product_categories.name FROM customer_product_recommendations
    JOIN product_categories ON product_categories.id = customer_product_recommendations.category_id
    WHERE customer_product_recommendations.customer_id = ? ORDER BY product_categories.name`).all(customerId).map(row => row.name);
}

function customerDetailData(id) {
  const customer = mappedCustomer(db.prepare('SELECT customers.*, users.name AS assigned_sales_name FROM customers LEFT JOIN users ON users.id = customers.assigned_sales_id WHERE customers.id = ?').get(id));
  if (!customer) return null;
  customer.contacts = db.prepare('SELECT * FROM customer_contacts WHERE customer_id = ? ORDER BY is_primary_decision_maker DESC, created_at').all(id);
  customer.gaps = db.prepare('SELECT * FROM customer_data_gaps WHERE customer_id = ? ORDER BY CASE priority WHEN \'High\' THEN 1 WHEN \'Medium\' THEN 2 ELSE 3 END, created_at').all(id);
  customer.recommended_products = db.prepare(`SELECT cpr.*, products.name AS product_name, products.sku, product_categories.name AS category
    FROM customer_product_recommendations cpr LEFT JOIN products ON products.id = cpr.product_id
    LEFT JOIN product_categories ON product_categories.id = cpr.category_id WHERE cpr.customer_id = ? ORDER BY cpr.score DESC`).all(id);
  customer.recommended_product_categories = [...new Set(customer.recommended_products.map(item => item.category).filter(Boolean))];
  customer.recommended_sales_angle = customer.recommended_products.map(item => item.sales_angle).filter(Boolean).join(' ');
  customer.outreach_drafts = db.prepare('SELECT * FROM customer_outreach_drafts WHERE customer_id = ? ORDER BY updated_at DESC').all(id).map(row => ({ ...row, recommended_products_snapshot: parseJsonValue(row.recommended_products_snapshot, []) }));
  customer.intelligence_profiles = db.prepare('SELECT * FROM customer_intelligence_profiles WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 10').all(id).map(row => ({ ...row, input_snapshot: parseJsonValue(row.input_snapshot), output_snapshot: parseJsonValue(row.output_snapshot) }));
  customer.latest_intelligence_profile = customer.intelligence_profiles[0] || null;
  customer.intelligence_feedback = db.prepare('SELECT customer_intelligence_feedback.*, users.name AS created_by_name FROM customer_intelligence_feedback LEFT JOIN users ON users.id = customer_intelligence_feedback.created_by WHERE customer_id = ? ORDER BY customer_intelligence_feedback.created_at DESC LIMIT 20').all(id);
  customer.intelligence_updates = db.prepare(`SELECT customer_intelligence_updates.*, users.name AS created_by_name
    FROM customer_intelligence_updates LEFT JOIN users ON users.id = customer_intelligence_updates.created_by
    WHERE customer_id = ? ORDER BY customer_intelligence_updates.created_at DESC, customer_intelligence_updates.id DESC LIMIT 30`).all(id);
  customer.score_history = db.prepare('SELECT * FROM customer_score_history WHERE customer_id = ? ORDER BY created_at DESC, id DESC LIMIT 30').all(id);
  customer.ai_runs = db.prepare('SELECT * FROM customer_ai_analysis_runs WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20').all(id).map(row => ({ ...row, input_snapshot: parseJsonValue(row.input_snapshot), output_snapshot: parseJsonValue(row.output_snapshot) }));
  customer.activity = db.prepare('SELECT customer_activity_log.*, users.name AS created_by_name FROM customer_activity_log LEFT JOIN users ON users.id = customer_activity_log.created_by WHERE customer_id = ? ORDER BY customer_activity_log.created_at DESC LIMIT 50').all(id).map(row => ({ ...row, metadata: parseJsonValue(row.metadata) }));
  return customer;
}

function createCustomerRecord(input, source, user) {
  const normalized = normalizeCustomer({ ...input, source: input.source || source });
  const companyName = requiredText(normalized.company_name, 'Company name');
  const validSource = allowedType(normalized.source || source || 'Manual', customerSources, 'Source');
  const duplicate = db.prepare(`SELECT id FROM customers WHERE LOWER(company_name) = LOWER(?) AND
    LOWER(COALESCE(country, '')) = LOWER(COALESCE(?, '')) AND LOWER(COALESCE(city, '')) = LOWER(COALESCE(?, '')) LIMIT 1`).get(companyName, normalized.country, normalized.city);
  if (duplicate) return { id: duplicate.id, duplicate: true };
  const id = Number(db.prepare(`INSERT INTO customers
    (company_name, brand_name, business_type, country, city, address, website, google_maps_url, facebook_url, instagram_url,
     linkedin_url, tiktok_url, phone, email, whatsapp, store_count, opening_year, years_in_business, source, source_url,
     source_confidence, expansion_probability, renovation_probability, furniture_need_probability, budget_estimate, style_signal,
     confidence_score, created_by) VALUES (${Array(28).fill('?').join(', ')}) RETURNING id`).get(
    companyName, normalized.brand_name, normalized.business_type, normalized.country, normalized.city, normalized.address || null,
    normalized.website, normalized.google_maps_url, normalized.facebook_url, normalized.instagram_url, normalized.linkedin_url,
    normalized.tiktok_url, normalized.phone, normalized.email, normalized.whatsapp, normalized.store_count, normalized.opening_year,
    normalized.years_in_business, validSource, normalized.source_url || null, Math.min(100, Math.max(0, Number(normalized.source_confidence) || 50)),
    normalized.expansion_probability, normalized.renovation_probability, normalized.furniture_need_probability,
    normalized.budget_estimate || null, normalized.style_signal || null, Math.min(100, Math.max(0, Number(normalized.confidence_score) || 50)), user.id
  ).id);
  db.prepare('UPDATE customers SET customer_source = ?, is_test_data = ?, recommended_product_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(customerSourceValue(input, validSource), input.is_test_data === true || input.is_test_data === 1 || input.is_test_data === 'true' ? 1 : 0,
      recommendedProductReasonFor(normalized.customer_type, normalized.business_type), id);
  customerActivity(id, 'imported', `Customer imported from ${validSource}.`, user.id, { sourceUrl: normalized.source_url || null });
  audit(user.id, 'create', 'customers', String(id), { source: validSource });
  return { id, duplicate: false };
}

function runOpportunityEngine(customerId, user) {
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!existing) { const error = new Error('Customer not found.'); error.status = 404; throw error; }
  const runId = Number(db.prepare(`INSERT INTO customer_ai_analysis_runs
    (customer_id, run_type, input_snapshot, engine_version, provider, status, created_by)
    VALUES (?, 'Full Run', ?, ?, ?, 'running', ?) RETURNING id`).get(customerId, JSON.stringify(existing), opportunityEngineVersion, process.env.OPPORTUNITY_AI_PROVIDER || 'rules', user.id).id);
  const baseCost = { module_name: 'opportunity-intelligence', entity_type: 'customer', entity_id: customerId, provider: 'rules', estimated_cost_usd: 0, user_id: user.id };
  try {
    const normalized = normalizeCustomer(existing);
    const hasDecisionMaker = Boolean(db.prepare('SELECT id FROM customer_contacts WHERE customer_id = ? AND is_primary_decision_maker = TRUE LIMIT 1').get(customerId));
    normalized.data_quality_score = dataQualityScore(normalized, hasDecisionMaker);
    const recommendations = productRecommendationsFor(normalized);
    const scoring = scoreOpportunity(normalized, { hasDecisionMaker, productMatchCount: recommendations.length });
    const next = nextActionFor(scoring.grade);
    const contactable = Boolean(normalized.email || normalized.whatsapp || normalized.website || hasDecisionMaker);
    const status = ['A+', 'A'].includes(scoring.grade) && contactable ? 'Ready for Sales' : 'Recommended';
    const summary = `${normalized.company_name} is a ${scoring.grade}-grade ${normalized.business_type || 'hospitality'} opportunity with a ${scoring.score}/100 score and ${normalized.data_quality_score}% data quality.`;
    const recommendation = `${next.next_action} Recommended directions: ${recommendations.map(item => item.category).join(', ') || 'complete restaurant furniture package'}.`;
    const gaps = detectGaps(normalized, hasDecisionMaker);
    db.exec('BEGIN IMMEDIATE');
    db.prepare(`UPDATE customers SET company_name = ?, brand_name = ?, business_type = ?, country = ?, city = ?, website = ?,
      google_maps_url = ?, facebook_url = ?, instagram_url = ?, linkedin_url = ?, tiktok_url = ?, phone = ?, email = ?, whatsapp = ?,
      store_count = ?, opening_year = ?, years_in_business = ?, data_quality_score = ?, opportunity_score = ?, opportunity_grade = ?,
      opportunity_status = ?, ai_summary = ?, ai_recommendation = ?, next_action = ?, next_action_date = ?, confidence_score = ?,
      last_ai_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      normalized.company_name, normalized.brand_name, normalized.business_type, normalized.country, normalized.city, normalized.website,
      normalized.google_maps_url, normalized.facebook_url, normalized.instagram_url, normalized.linkedin_url, normalized.tiktok_url,
      normalized.phone, normalized.email, normalized.whatsapp, normalized.store_count, normalized.opening_year, normalized.years_in_business,
      normalized.data_quality_score, scoring.score, scoring.grade, status, summary, recommendation, next.next_action, next.next_action_date,
      Math.round((normalized.data_quality_score + Number(existing.source_confidence || 50)) / 2), customerId
    );
    db.prepare('DELETE FROM customer_product_recommendations WHERE customer_id = ?').run(customerId);
    const addRecommendation = db.prepare(`INSERT INTO customer_product_recommendations
      (customer_id, product_id, category_id, recommendation_reason, sales_angle, score) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const item of recommendations) addRecommendation.run(customerId, item.product_id, item.category_id, item.recommendation_reason, item.sales_angle, item.match_score);
    db.prepare("UPDATE customer_data_gaps SET status = 'Filled', updated_at = CURRENT_TIMESTAMP WHERE customer_id = ?").run(customerId);
    const addGap = db.prepare(`INSERT OR IGNORE INTO customer_data_gaps (customer_id, gap_type, priority, status) VALUES (?, ?, ?, 'Open')`);
    for (const gap of gaps) {
      addGap.run(customerId, gap.gap_type, gap.priority);
      db.prepare("UPDATE customer_data_gaps SET priority = ?, status = 'Open', updated_at = CURRENT_TIMESTAMP WHERE customer_id = ? AND gap_type = ?").run(gap.priority, customerId, gap.gap_type);
    }
    const draft = buildOutreachDraft({ ...normalized, opportunity_grade: scoring.grade }, recommendations);
    const existingDraft = db.prepare("SELECT id FROM customer_outreach_drafts WHERE customer_id = ? AND draft_type = 'First Touch' AND status IN ('Draft', 'Ready') ORDER BY id DESC LIMIT 1").get(customerId);
    if (existingDraft) db.prepare(`UPDATE customer_outreach_drafts SET channel = ?, subject = ?, body = ?, personalization_summary = ?,
      recommended_products_snapshot = ?, status = 'Ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      draft.channel, draft.subject, draft.body, draft.personalization_summary, JSON.stringify(draft.recommended_products_snapshot), existingDraft.id);
    else db.prepare(`INSERT INTO customer_outreach_drafts
      (customer_id, channel, draft_type, subject, body, language, personalization_summary, recommended_products_snapshot, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Ready', ?)`).run(customerId, draft.channel, draft.draft_type, draft.subject, draft.body,
      draft.language, draft.personalization_summary, JSON.stringify(draft.recommended_products_snapshot), user.id);
    const output = { scoring, gaps, recommendations, status, nextAction: next };
    db.prepare("UPDATE customer_ai_analysis_runs SET output_snapshot = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(output), runId);
    customerActivity(customerId, 'cleaned', 'Customer data normalized and missing fields detected.', user.id, { gaps: gaps.length });
    customerActivity(customerId, 'scored', `Opportunity scored ${scoring.score}/100 (${scoring.grade}).`, user.id, scoring.dimensions);
    customerActivity(customerId, 'product matched', `${recommendations.length} Product Intelligence recommendations created.`, user.id);
    customerActivity(customerId, 'draft generated', 'Personalized first-touch outreach draft generated for human review.', user.id);
    if (status === 'Ready for Sales') customerActivity(customerId, 'handoff created', 'Opportunity is ready for sales handoff.', user.id);
    db.exec('COMMIT');
    for (const action_name of ['run-ai', 'product-matching', 'outreach-draft-generation']) aiCostControl.executed({ ...baseCost, action_name, actual_cost_usd: 0 });
    audit(user.id, 'run_ai', 'customers', String(customerId), { runId, score: scoring.score, grade: scoring.grade });
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.prepare("UPDATE customer_ai_analysis_runs SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(String(error.message).slice(0, 2000), runId);
    recordSystemEvent('error', 'Opportunity Intelligence run failed', { customerId, runId, error: error.message });
    throw error;
  }
  return customerDetailData(customerId);
}

async function runCustomerIntelligenceEngine(customerId, user, body = {}) {
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!existing) { const error = new Error('Customer not found.'); error.status = 404; throw error; }
  const text = name => String(body[name] ?? existing[name] ?? '').trim() || null;
  if (['project_information', 'customer_comments', 'expected_purchase_timing', 'opportunity_notes', 'customer_type', 'industry'].some(name => body[name] !== undefined)) {
    db.prepare(`UPDATE customers SET customer_type = ?, industry = ?, project_information = ?, customer_comments = ?,
      expected_purchase_timing = ?, opportunity_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      text('customer_type'), text('industry') || 'Hospitality Furniture', text('project_information'), text('customer_comments'),
      text('expected_purchase_timing'), text('opportunity_notes'), customerId
    );
  }
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  const previous = {
    customer_value: Number(customer.customer_value_score || 0),
    buying_opportunity: Number(customer.buying_opportunity_score || 0),
    sales_priority: Number(customer.sales_priority_score || 0)
  };
  const intelligence = calculateCustomerIntelligence(customer);
  const aiResult = await aiBusinessBrain.runAiAction({
    moduleName: 'customer-intelligence',
    actionName: 'phase2a-score-explanation',
    entityType: 'customer',
    entityId: customerId,
    contextType: 'customer',
    promptTemplateKey: 'v53.foundation.mock.v1',
    userId: user.id,
    user,
    options: { provider: body.provider || 'rules' }
  });
  const output = { ...intelligence, aiExecutionLogId: aiResult.executionLogId, aiProvider: aiResult.provider, aiBrainSummary: aiResult.result?.summary || null };
  let profileId;
  db.exec('BEGIN IMMEDIATE');
  try {
    profileId = Number(db.prepare(`INSERT INTO customer_intelligence_profiles
      (customer_id, customer_type, industry, customer_value_score, customer_value_grade, customer_value_explanation,
       buying_opportunity_score, buying_opportunity_grade, buying_opportunity_explanation, purchase_timing,
       purchase_timing_confidence, sales_priority_score, sales_priority_explanation, ai_recommendation, review_status,
       input_snapshot, output_snapshot, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?) RETURNING id`).get(
      customerId, intelligence.customer_type, intelligence.industry, intelligence.customer_value_score, intelligence.customer_value_grade,
      intelligence.customer_value_explanation, intelligence.buying_opportunity_score, intelligence.buying_opportunity_grade,
      intelligence.buying_opportunity_explanation, intelligence.purchase_timing, intelligence.purchase_timing_confidence,
      intelligence.sales_priority_score, intelligence.sales_priority_explanation, intelligence.ai_recommendation,
      JSON.stringify(customer), JSON.stringify(output), user.id
    ).id);
    db.prepare(`UPDATE customers SET customer_type = ?, industry = ?, customer_value_score = ?, customer_value_grade = ?,
      customer_value_explanation = ?, buying_opportunity_score = ?, buying_opportunity_grade = ?, buying_opportunity_explanation = ?,
      purchase_timing = ?, purchase_timing_confidence = ?, sales_priority_score = ?, sales_priority_explanation = ?,
      ai_recommendation = ?, recommended_product_reason = ?, last_customer_intelligence_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      intelligence.customer_type, intelligence.industry, intelligence.customer_value_score, intelligence.customer_value_grade,
      intelligence.customer_value_explanation, intelligence.buying_opportunity_score, intelligence.buying_opportunity_grade,
      intelligence.buying_opportunity_explanation, intelligence.purchase_timing, intelligence.purchase_timing_confidence,
      intelligence.sales_priority_score, intelligence.sales_priority_explanation, intelligence.ai_recommendation,
      recommendedProductReasonFor(intelligence.customer_type, customer.business_type), customerId
    );
    const addHistory = db.prepare('INSERT INTO customer_score_history (customer_id, score_type, previous_score, new_score, reason, source, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
    addHistory.run(customerId, 'customer_value', previous.customer_value, intelligence.customer_value_score, intelligence.customer_value_explanation, 'rules+ai-explanation', user.id);
    addHistory.run(customerId, 'buying_opportunity', previous.buying_opportunity, intelligence.buying_opportunity_score, intelligence.buying_opportunity_explanation, 'rules+ai-explanation', user.id);
    addHistory.run(customerId, 'sales_priority', previous.sales_priority, intelligence.sales_priority_score, intelligence.sales_priority_explanation, 'rules+ai-explanation', user.id);
    customerActivity(customerId, 'customer intelligence scored', `Customer Value ${intelligence.customer_value_score}, Buying Opportunity ${intelligence.buying_opportunity_score}, Sales Priority ${intelligence.sales_priority_score}.`, user.id, { profileId, aiExecutionLogId: aiResult.executionLogId });
    db.exec('COMMIT');
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
  return { customer: customerDetailData(customerId), profile: db.prepare('SELECT * FROM customer_intelligence_profiles WHERE id = ?').get(profileId), ai: aiResult };
}

function buildCustomerIntelligenceUpdateSummary(customer, reason, input, referenceNote = '') {
  const cleanInput = String(input || '').trim().replace(/\s+/g, ' ');
  const cleanReference = String(referenceNote || '').trim().replace(/\s+/g, ' ');
  const sourceText = `${cleanInput} ${cleanReference}`.toLowerCase();
  const latest = cleanInput || 'Manual customer information update was submitted.';
  const importantChanges = `${reason}: ${cleanInput || 'No detailed change text provided.'}${cleanReference ? ` Reference: ${cleanReference}` : ''}`;
  const hasExpansion = /\b(second|new location|expansion|expand|chain|franchise|opening|open)\b/i.test(sourceText);
  const hasRequirement = /\b(need|requirement|quote|quotation|rfq|pi|table|chair|booth|bar stool|counter|furniture|package)\b/i.test(sourceText);
  const hasRestart = reason === 'Customer follow-up restart' || /\b(inactive|restart|follow[- ]?up|reconnect|again)\b/i.test(sourceText);
  const hasHandoff = reason === 'New salesperson handoff';
  const opportunityImpact = hasExpansion
    ? 'Potential opportunity increased because the update indicates expansion, new location, or opening activity.'
    : hasRequirement
      ? 'Potential opportunity increased because the update includes a new requirement or quote-related signal.'
      : hasRestart
        ? 'Opportunity should be rechecked because the relationship is being restarted after inactivity.'
        : hasHandoff
          ? 'Opportunity status should be reviewed by the new salesperson before the next customer touchpoint.'
          : 'Opportunity impact is informational until stronger requirement, timing, or contact signals are confirmed.';
  const nextAction = hasRequirement
    ? 'Review the requirement, confirm quantity / budget / timing, and prepare product matching or quotation if appropriate.'
    : hasExpansion
      ? 'Confirm project timing, decision maker, destination, and furniture package scope.'
      : hasRestart
        ? 'Send a light follow-up, confirm whether the project is still active, and update purchase timing.'
        : hasHandoff
          ? 'New salesperson should review customer history and schedule the next follow-up.'
          : 'Review the note and decide whether Customer Intelligence should be rerun.';
  return {
    latest_customer_situation: latest,
    important_changes: importantChanges,
    opportunity_impact: opportunityImpact,
    recommended_next_action: nextAction,
    ai_summary: `Latest customer situation: ${latest}\nImportant changes: ${importantChanges}\nOpportunity impact: ${opportunityImpact}\nRecommended next action: ${nextAction}`
  };
}

async function saveCustomerIntelligenceUpdate(customerId, user, body = {}) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) { const error = new Error('Customer not found.'); error.status = 404; throw error; }
  const updateReason = allowedType(body.update_reason, customerIntelligenceUpdateReasons, 'Update reason');
  const originalInput = requiredText(body.original_input, 'New information');
  const referenceNote = String(body.reference_note || '').trim() || null;
  const aiResult = await aiBusinessBrain.runAiAction({
    moduleName: 'customer-intelligence',
    actionName: 'manual-intelligence-update',
    entityType: 'customer',
    entityId: customerId,
    contextType: 'customer',
    promptTemplateKey: 'v53.foundation.mock.v1',
    userId: user.id,
    user,
    options: { provider: body.provider || 'rules', updateReason }
  });
  const summary = buildCustomerIntelligenceUpdateSummary(customer, updateReason, originalInput, referenceNote);
  const updateId = Number(db.prepare(`INSERT INTO customer_intelligence_updates
    (customer_id, update_reason, original_input, reference_note, ai_summary, latest_customer_situation,
     important_changes, opportunity_impact, recommended_next_action, ai_execution_log_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(
    customerId, updateReason, originalInput, referenceNote, summary.ai_summary, summary.latest_customer_situation,
    summary.important_changes, summary.opportunity_impact, summary.recommended_next_action, aiResult.executionLogId || null, user.id
  ).id);
  customerActivity(customerId, 'customer intelligence updated', `Manual intelligence update: ${updateReason}.`, user.id, { updateId, aiExecutionLogId: aiResult.executionLogId });
  audit(user.id, 'update_customer_intelligence', 'customers', String(customerId), { updateId, updateReason });
  return {
    update: db.prepare(`SELECT customer_intelligence_updates.*, users.name AS created_by_name
      FROM customer_intelligence_updates LEFT JOIN users ON users.id = customer_intelligence_updates.created_by
      WHERE customer_intelligence_updates.id = ?`).get(updateId),
    customer: customerDetailData(customerId),
    ai: aiResult
  };
}

const handlers = {
  salesWorkspace(req, res) {
    const user = currentUser(req); if (!salesCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Sales Intelligence access denied.' });
    const scope = salesScope(user);
    const inquiries = db.prepare(`SELECT sales_inquiries.*, customers.company_name AS customer_name FROM sales_inquiries JOIN customers ON customers.id = sales_inquiries.customer_id WHERE 1=1${scope.sql} ORDER BY sales_inquiries.updated_at DESC`).all(...scope.params);
    const quoteScope = user.role === 'Sales' ? ' WHERE sales_quotes.created_by = ?' : '';
    const quotes = db.prepare(`SELECT sales_quotes.*, customers.company_name AS customer_name FROM sales_quotes JOIN customers ON customers.id = sales_quotes.customer_id${quoteScope} ORDER BY sales_quotes.created_at DESC`).all(...(user.role === 'Sales' ? [user.id] : []));
    const orders = db.prepare(`SELECT sales_orders.*, customers.company_name AS customer_name FROM sales_orders JOIN customers ON customers.id = sales_orders.customer_id${user.role === 'Sales' ? ' WHERE sales_orders.created_by = ?' : ''} ORDER BY sales_orders.created_at DESC`).all(...(user.role === 'Sales' ? [user.id] : []));
    const tasks = db.prepare(`SELECT sales_tasks.*, customers.company_name AS customer_name FROM sales_tasks JOIN customers ON customers.id = sales_tasks.customer_id${user.role === 'Sales' ? ' WHERE sales_tasks.assigned_to = ?' : ''} ORDER BY sales_tasks.status, sales_tasks.due_at`).all(...(user.role === 'Sales' ? [user.id] : []));
    const customers = db.prepare('SELECT id, company_name, country, city FROM customers ORDER BY company_name LIMIT 1000').all();
    return json(res, 200, { inquiries, quotes, orders, tasks, customers, inquiryTypes, inquiryStatuses, capabilities: salesCapabilities(user) });
  },

  async createSalesInquiry(req, res) {
    const user = currentUser(req); if (!salesCapabilities(user).canCreate) return json(res, user ? 403 : 401, { error: 'Sales Intelligence access denied.' });
    const body = await readJson(req); const type = allowedType(body.inquiry_type, inquiryTypes, 'Inquiry type');
    let customerId = Number(body.customer_id); let customer; let customerCreated = false;
    db.exec('BEGIN IMMEDIATE');
    try {
      if (body.customer_mode === 'new') {
        const input = body.new_customer || {};
        const restaurantName = requiredText(input.customer_name, 'Customer / Restaurant name');
        const companyName = String(input.company || '').trim() || restaurantName;
        const created = createCustomerRecord({
          company_name: companyName, brand_name: companyName === restaurantName ? null : restaurantName,
          country: input.country, phone: input.phone, whatsapp: input.phone, email: input.email,
          source: input.source || 'Manual', source_confidence: 70, confidence_score: 70
        }, input.source || 'Manual', user);
        customerId = created.id; customerCreated = !created.duplicate;
        customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
        const contactName = String(input.contact_name || '').trim();
        if (contactName && !db.prepare('SELECT id FROM customer_contacts WHERE customer_id = ? AND LOWER(full_name) = LOWER(?) LIMIT 1').get(customerId, contactName)) {
          db.prepare(`INSERT INTO customer_contacts
            (customer_id, full_name, role, email, phone, whatsapp, source, confidence_score, is_primary_decision_maker, created_by)
            VALUES (?, ?, 'Other', ?, ?, ?, ?, 70, 1, ?)`).run(customerId, contactName, String(input.email || '').trim() || null,
            String(input.phone || '').trim() || null, String(input.phone || '').trim() || null, input.source || 'Manual', user.id);
        }
      } else {
        customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
        if (!customer) { const error = new Error('Please select an existing customer or create a new customer.'); error.status = 400; throw error; }
      }
      const id = Number(db.prepare(`INSERT INTO sales_inquiries (customer_id, company, country, inquiry_type, customer_message, attachments, priority, sales_notes, assigned_sales_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(customerId, String(body.company || customer.company_name).trim() || null, String(body.country || customer.country || '').trim() || null,
        type, requiredText(body.customer_message, 'Customer message'), JSON.stringify(body.attachments || []), ['Low','Normal','High','Urgent'].includes(body.priority) ? body.priority : 'Normal', String(body.sales_notes || '').trim() || null, user.id, user.id).id);
      db.prepare("INSERT INTO sales_tasks (inquiry_id, customer_id, title, status, due_at, assigned_to) VALUES (?, ?, ?, 'Open', ?, ?)").run(id, customerId, `Follow up: ${customer.company_name}`, new Date(Date.now() + 86400000).toISOString(), user.id);
      timeline(customerId, id, 'Inquiry Received', `${type} received.`, user, { priority: body.priority || 'Normal', customerCreated });
      audit(user.id, 'create', 'sales_inquiry', String(id), { customerCreated });
      db.exec('COMMIT');
      return json(res, 201, { inquiry: salesInquiryDetail(id, user), customer_created: customerCreated });
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
  },

  salesInquiry(req, res, id) {
    const user = currentUser(req); if (!salesCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Sales Intelligence access denied.' });
    const inquiry = salesInquiryDetail(id, user); return inquiry ? json(res, 200, { inquiry }) : json(res, 404, { error: 'Inquiry not found.' });
  },

  async analyzeSalesInquiry(req, res, id) {
    const user = currentUser(req); if (!salesCapabilities(user).canAnalyze) return json(res, user ? 403 : 401, { error: 'Analysis is not allowed.' });
    const body = await readJson(req); const inquiry = salesInquiryDetail(id, user); if (!inquiry) return json(res, 404, { error: 'Inquiry not found.' });
    const costInput = aiCostInput({ moduleName: 'sales-intelligence', actionName: 'analyze-inquiry', entityType: 'sales-inquiry', entityId: id, provider: 'rules', estimatedCost: 0, user, fingerprint: `${id}:${inquiry.customer_message}` });
    const cached = body.regenerate ? null : aiCostControl.cacheGet(costInput); if (cached) return json(res, 200, { inquiry: salesInquiryDetail(id, user), cached: true });
    const analysis = analyzeInquiry(inquiry);
    db.prepare(`INSERT INTO sales_inquiry_analyses (inquiry_id, customer_intent, opportunity_size, restaurant_type, estimated_budget, furniture_categories, missing_information, suggested_next_question, recommended_package, notes, provider, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rules', ?)`).run(id, analysis.customer_intent, analysis.opportunity_size, analysis.restaurant_type, analysis.estimated_budget, JSON.stringify(analysis.furniture_categories), JSON.stringify(analysis.missing_information), analysis.suggested_next_question, analysis.recommended_package, analysis.notes, user.id);
    db.prepare('DELETE FROM sales_inquiry_products WHERE inquiry_id = ?').run(id);
    const add = db.prepare('INSERT INTO sales_inquiry_products (inquiry_id, product_id, match_reason, proposed_unit_price, selected, quantity) VALUES (?, ?, ?, ?, ?, ?)');
    const categories = analysis.furniture_categories; if (categories.length) {
      const rows = db.prepare(`SELECT products.id, products.price_range, product_categories.name AS category FROM products JOIN product_categories ON product_categories.id = products.category_id WHERE product_categories.name IN (${categories.map(()=>'?').join(',')}) AND products.status != 'archived' AND products.library_status='Approved' ORDER BY products.proposal_ready_status DESC, products.ai_recommendation_weight DESC LIMIT 12`).all(...categories);
      const selectedCategories = new Set();
      for (const product of rows) {
        const selected = selectedCategories.has(product.category) ? 0 : 1; selectedCategories.add(product.category);
        add.run(id, product.id, `Matched to ${product.category} requirement`, Number(String(product.price_range || '').match(/[\d,.]+/)?.[0].replace(',','') || 0), selected, analysis.category_quantities[product.category] || 1);
      }
    }
    db.prepare("UPDATE sales_inquiries SET status = 'Preparing Quote', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    timeline(inquiry.customer_id, id, 'AI Analysis', `Intent: ${analysis.customer_intent}.`, user, { opportunitySize: analysis.opportunity_size });
    recordAiExecution(costInput, 'rules', 0); aiCostControl.cacheSet(costInput, { analyzed: true });
    return json(res, 200, { inquiry: salesInquiryDetail(id, user) });
  },

  async selectSalesProducts(req, res, id) {
    const user = currentUser(req); if (!salesCapabilities(user).canQuote) return json(res, user ? 403 : 401, { error: 'Quote editing is not allowed.' });
    const body = await readJson(req); const inquiry = salesInquiryDetail(id, user); if (!inquiry) return json(res, 404, { error: 'Inquiry not found.' });
    for (const item of Array.isArray(body.products) ? body.products : []) db.prepare('UPDATE sales_inquiry_products SET selected = ?, quantity = ?, proposed_unit_price = ? WHERE inquiry_id = ? AND product_id = ?').run(item.selected === true ? 1 : 0, Math.max(1, Number(item.quantity || 1)), Math.max(0, Number(item.unit_price || 0)), id, Number(item.product_id));
    return json(res, 200, { inquiry: salesInquiryDetail(id, user) });
  },

  async generateSalesQuote(req, res, id) {
    const user = currentUser(req); if (!salesCapabilities(user).canQuote) return json(res, user ? 403 : 401, { error: 'Quote generation is not allowed.' });
    const body = await readJson(req); const inquiry = salesInquiryDetail(id, user); if (!inquiry) return json(res, 404, { error: 'Inquiry not found.' });
    const items = inquiry.products.filter(item => item.selected); if (!items.length && inquiry.inquiry_type !== 'Freight Quote') return json(res, 400, { error: 'Select at least one product.' });
    const extracted = analyzeInquiry(inquiry); const destination = body.destination || extracted.destination || null; const tradeTerm = body.trade_term || extracted.trade_term || null; const shippingMethod = body.shipping_method || extracted.shipping_method || null;
    const quoteNumber = `PI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; let quoteId;
    db.exec('BEGIN IMMEDIATE'); try {
      quoteId = Number(db.prepare(`INSERT INTO sales_quotes (quote_number, inquiry_id, customer_id, quote_type, currency, destination, trade_term, shipping_method, quote_date, valid_until, salesperson_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, ?, ?) RETURNING id`).get(quoteNumber, id, inquiry.customer_id, body.quote_type || 'Quote', body.currency || 'USD', destination, tradeTerm, shippingMethod, body.valid_until||new Date(Date.now()+30*86400000).toISOString().slice(0,10), user.id, user.id).id);
      const insert = db.prepare('INSERT INTO sales_quote_items (quote_id, product_id, product_snapshot, quantity, unit_price, discount_percent, remark, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      items.forEach((item, index) => { const product=db.prepare('SELECT * FROM products WHERE id=?').get(item.product_id);insert.run(quoteId,item.product_id,JSON.stringify(pimQuoteSnapshot(product)),item.quantity,item.proposed_unit_price||0,0,body.remark||null,index); });
      const totals = db.prepare('SELECT COALESCE(SUM(quantity * unit_price * (1-discount_percent/100)),0) AS total, COALESCE(SUM(quantity * unit_price),0) AS subtotal FROM sales_quote_items WHERE quote_id = ?').get(quoteId);
      db.prepare("UPDATE sales_quotes SET subtotal = ?, total = ?, status = 'Generated' WHERE id = ?").run(totals.subtotal, totals.total, quoteId);
      db.prepare("UPDATE sales_inquiries SET status = 'Quoted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id); db.exec('COMMIT');
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    timeline(inquiry.customer_id, id, 'Quote Generated', `${quoteNumber} generated from Product Library data.`, user, { quoteId });
    saveQuoteVersion(quoteId,user);
    return json(res, 201, { quote: salesQuoteDetail(quoteId,user), inquiry: salesInquiryDetail(id, user) });
  },

  salesQuoteDetail(req,res,id){const user=currentUser(req);if(!salesCapabilities(user).canView)return json(res,user?403:401,{error:'Access denied.'});const quote=salesQuoteDetail(id,user);return quote?json(res,200,{quote}):json(res,404,{error:'Quote not found.'});},
  async updateSalesQuote(req,res,id){const user=currentUser(req);if(!salesCapabilities(user).canQuote)return json(res,user?403:401,{error:'Quote editing is not allowed.'});const existing=salesQuoteDetail(id,user);if(!existing)return json(res,404,{error:'Quote not found.'});const b=await readJson(req);for(const item of b.items||[])db.prepare('UPDATE sales_quote_items SET quantity=?,unit_price=?,discount_percent=?,remark=?,confirmed_material=?,confirmed_finish=?,confirmed_color_name=?,customer_remark=?,swatch_image_url=? WHERE quote_id=? AND id=?').run(Math.max(1,Number(item.quantity||1)),Math.max(0,Number(item.unit_price||0)),Math.min(100,Math.max(0,Number(item.discount_percent||0))),String(item.remark||'').trim()||null,String(item.confirmed_material||'').trim()||null,String(item.confirmed_finish||'').trim()||null,String(item.confirmed_color_name||'').trim()||null,String(item.customer_remark||'').trim()||null,String(item.swatch_image_url||'').trim()||null,id,Number(item.id));
    for(const item of b.custom_items||[])db.prepare(`UPDATE sales_quote_custom_items SET reference_image_url=?,item_name=?,category=?,specification=?,material=?,color_finish=?,size_dimensions=?,quantity=?,unit_price=?,discount_percent=?,cbm=?,gross_weight_kg=?,net_weight_kg=?,remark=?,confirmed_material=?,confirmed_finish=?,confirmed_color_name=?,customer_remark=?,swatch_image_url=?,updated_at=CURRENT_TIMESTAMP WHERE quote_id=? AND id=?`).run(String(item.reference_image_url||'').trim()||null,requiredText(item.item_name,'Custom item name'),String(item.category||'').trim()||null,String(item.specification||'').trim()||null,String(item.material||'').trim()||null,String(item.color_finish||'').trim()||null,String(item.size_dimensions||'').trim()||null,Math.max(1,Number(item.quantity||1)),Math.max(0,Number(item.unit_price||0)),Math.min(100,Math.max(0,Number(item.discount_percent||0))),item.cbm===''||item.cbm==null?null:Number(item.cbm),item.gross_weight_kg===''||item.gross_weight_kg==null?null:Number(item.gross_weight_kg),item.net_weight_kg===''||item.net_weight_kg==null?null:Number(item.net_weight_kg),String(item.remark||'').trim()||null,String(item.confirmed_material||'').trim()||null,String(item.confirmed_finish||'').trim()||null,String(item.confirmed_color_name||'').trim()||null,String(item.customer_remark||'').trim()||null,String(item.swatch_image_url||'').trim()||null,id,Number(item.id));
    const deposit=Math.min(100,Math.max(0,Number(b.deposit_percent??existing.deposit_percent??30)));const balance=100-deposit;
    db.prepare(`UPDATE sales_quotes SET currency=?,valid_until=?,discount_percent=?,other_charges=?,deposit_percent=?,balance_percent=?,payment_method=?,payment_note=?,trade_term=?,shipping_method=?,destination=?,origin_port=?,destination_port=?,destination_address=?,freight_cost=?,transit_time=?,freight_remark=?,other_remark=?,contact_person=?,buyer_phone=?,buyer_email=?,billing_address=?,buyer_reference_no=?,project_name=?,total_packages=?,total_cbm_override=?,total_gross_weight_override=?,total_net_weight_override=?,production_time=?,special_terms=?,bank_account_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(b.currency||existing.currency,b.valid_until||existing.valid_until,Number(b.discount_percent||0),Number(b.other_charges||0),deposit,balance,b.payment_method||existing.payment_method,b.payment_note||`${deposit}% deposit before production. ${balance}% balance before shipment.`,b.trade_term||null,b.shipping_method||null,b.destination||null,b.origin_port||null,b.destination_port||null,b.destination_address||null,b.freight_cost===''||b.freight_cost==null?null:Number(b.freight_cost),b.transit_time||null,b.freight_remark||null,b.other_remark||null,b.contact_person||null,b.buyer_phone||null,b.buyer_email||null,b.billing_address||null,b.buyer_reference_no||null,b.project_name||null,b.total_packages===''||b.total_packages==null?null:Math.max(0,Number(b.total_packages)),b.total_cbm_override===''||b.total_cbm_override==null?null:Math.max(0,Number(b.total_cbm_override)),b.total_gross_weight_override===''||b.total_gross_weight_override==null?null:Math.max(0,Number(b.total_gross_weight_override)),b.total_net_weight_override===''||b.total_net_weight_override==null?null:Math.max(0,Number(b.total_net_weight_override)),b.production_time||null,b.special_terms||null,b.bank_account_id?Number(b.bank_account_id):null,id);
    syncQuoteStoredTotals(id,user);const version=saveQuoteVersion(id,user);audit(user.id,'update','sales_quote',String(id),{version});return json(res,200,{quote:salesQuoteDetail(id,user)});},
  async addQuoteLibraryItem(req,res,id){const user=currentUser(req);if(!salesCapabilities(user).canQuote)return json(res,user?403:401,{error:'Access denied.'});if(!salesQuoteDetail(id,user))return json(res,404,{error:'Quote not found.'});const b=await readJson(req);const p=db.prepare("SELECT * FROM products WHERE id=? AND COALESCE(visibility,'Website + Quote') IN ('Website + Quote','Quote Only') AND COALESCE(library_status,'Active') NOT IN ('Hidden','Discontinued')").get(Number(b.product_id));if(!p)return json(res,404,{error:'Product is not available for quotation.'});const variant=b.variant_id?db.prepare("SELECT * FROM product_variants WHERE id=? AND product_id=? AND status='Active'").get(Number(b.variant_id),p.id):null;if(b.variant_id&&!variant)return json(res,400,{error:'Selected variant is not available.'});const price=variant?.reference_price??Number(String(p.price_range||'').match(/[\\d,.]+/)?.[0].replace(',','')||0);const snapshot=variant?JSON.stringify({id:variant.id,name:variant.variant_name,sku:variant.variant_sku,dimensions:variant.dimensions,material:variant.material,finish:variant.finish,color:variant.color,reference_price:variant.reference_price,moq:variant.moq,lead_time_days:variant.lead_time_days,cbm:variant.cbm,gross_weight_kg:variant.gross_weight_kg,net_weight_kg:variant.net_weight_kg,packing_info:variant.packing_info}):null;const productSnapshot=JSON.stringify(pimQuoteSnapshot(p,variant));const sort=Number(db.prepare('SELECT COUNT(*) AS count FROM sales_quote_items WHERE quote_id=?').get(id).count);db.prepare('INSERT INTO sales_quote_items(quote_id,product_id,variant_id,variant_snapshot,product_snapshot,quantity,unit_price,discount_percent,sort_order) VALUES(?,?,?,?,?,1,?,0,?)').run(id,p.id,variant?.id||null,snapshot,productSnapshot,price,sort);saveQuoteVersion(id,user);return json(res,201,{quote:salesQuoteDetail(id,user)});},
  async addQuoteCustomItem(req,res,id){const user=currentUser(req);if(!salesCapabilities(user).canQuote)return json(res,user?403:401,{error:'Access denied.'});if(!salesQuoteDetail(id,user))return json(res,404,{error:'Quote not found.'});const b=await readJson(req);const sort=Number(db.prepare('SELECT COUNT(*) AS count FROM sales_quote_custom_items WHERE quote_id=?').get(id).count);const row=db.prepare(`INSERT INTO sales_quote_custom_items(quote_id,reference_image_url,item_name,category,specification,material,color_finish,size_dimensions,quantity,unit_price,discount_percent,cbm,gross_weight_kg,net_weight_kg,remark,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`).get(id,String(b.reference_image_url||'').trim()||null,requiredText(b.item_name,'Custom item name'),String(b.category||'').trim()||null,String(b.specification||'').trim()||null,String(b.material||'').trim()||null,String(b.color_finish||'').trim()||null,String(b.size_dimensions||'').trim()||null,Math.max(1,Number(b.quantity||1)),Math.max(0,Number(b.unit_price||0)),Math.min(100,Math.max(0,Number(b.discount_percent||0))),b.cbm===''||b.cbm==null?null:Number(b.cbm),b.gross_weight_kg===''||b.gross_weight_kg==null?null:Number(b.gross_weight_kg),b.net_weight_kg===''||b.net_weight_kg==null?null:Number(b.net_weight_kg),String(b.remark||'').trim()||null,sort);saveQuoteVersion(id,user);return json(res,201,{custom_item_id:Number(row.id),quote:salesQuoteDetail(id,user)});},
  async duplicateQuoteItem(req,res,id){const user=currentUser(req);if(!salesCapabilities(user).canQuote)return json(res,user?403:401,{error:'Access denied.'});if(!salesQuoteDetail(id,user))return json(res,404,{error:'Quote not found.'});const b=await readJson(req);const itemId=Number(b.item_id);if(b.item_type==='custom'){const source=db.prepare('SELECT * FROM sales_quote_custom_items WHERE quote_id=? AND id=?').get(id,itemId);if(!source)return json(res,404,{error:'Custom item not found.'});const sort=Number(db.prepare('SELECT COUNT(*) AS count FROM sales_quote_custom_items WHERE quote_id=?').get(id).count);db.prepare(`INSERT INTO sales_quote_custom_items(quote_id,reference_image_url,item_name,category,specification,material,color_finish,size_dimensions,quantity,unit_price,discount_percent,cbm,gross_weight_kg,net_weight_kg,remark,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,source.reference_image_url,source.item_name,source.category,source.specification,source.material,source.color_finish,source.size_dimensions,source.quantity,source.unit_price,source.discount_percent,source.cbm,source.gross_weight_kg,source.net_weight_kg,source.remark,sort);}else{const source=db.prepare('SELECT * FROM sales_quote_items WHERE quote_id=? AND id=?').get(id,itemId);if(!source)return json(res,404,{error:'Library item not found.'});const sort=Number(db.prepare('SELECT COUNT(*) AS count FROM sales_quote_items WHERE quote_id=?').get(id).count);db.prepare('INSERT INTO sales_quote_items(quote_id,product_id,variant_id,variant_snapshot,product_snapshot,quantity,unit_price,discount_percent,remark,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,source.product_id,source.variant_id,source.variant_snapshot,source.product_snapshot,source.quantity,source.unit_price,source.discount_percent,source.remark,sort);}saveQuoteVersion(id,user);return json(res,201,{quote:salesQuoteDetail(id,user)});},
  salesQuoteVersion(req,res,id,version){const user=currentUser(req);if(!salesCapabilities(user).canView)return json(res,user?403:401,{error:'Access denied.'});const quote=salesQuoteDetail(id,user);if(!quote)return json(res,404,{error:'Quote not found.'});const row=db.prepare('SELECT * FROM sales_quote_versions WHERE quote_id=? AND version_number=?').get(id,version);if(!row)return json(res,404,{error:'Version not found.'});return json(res,200,{version:{...row,snapshot:parseJsonValue(row.snapshot)}});},
  salesQuoteMessage(req,res,id,type){const user=currentUser(req);const quote=salesQuoteDetail(id,user);if(!quote)return json(res,404,{error:'Quote not found.'});return json(res,200,quoteMessage(quote,type));},
  salesQuoteExport(req,res,id,type){const user=currentUser(req);const quote=salesQuoteDetail(id,user);if(!quote)return json(res,404,{error:'Quote not found.'});const rows=globalPiRows(quote);if(type==='pdf'){const body=simplePdf(rows.map(row=>row.join(' | ')).join('\n'));res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${quote.quote_number}.pdf"`});return res.end(body);}const escapeXml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#155E4B" ss:Pattern="Solid"/></Style><Style ss:ID="Section"><Font ss:Bold="1" ss:Color="#155E4B"/></Style><Style ss:ID="Money"><NumberFormat ss:Format="0.00"/></Style></Styles><Worksheet ss:Name="Global PI"><Table>${rows.map((row,index)=>`<Row>${row.map((cell,column)=>`<Cell${row.length===1?' ss:StyleID="Section"':index===0||row[0]==='No.'?' ss:StyleID="Header"':''}><Data ss:Type="${typeof cell==='number'?'Number':'String'}">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet></Workbook>`;res.writeHead(200,{'Content-Type':'application/vnd.ms-excel','Content-Disposition':`attachment; filename="${quote.quote_number}.xls"`});return res.end(xml);},

  async convertSalesOrder(req, res, id) {
    const user = currentUser(req); if (!salesCapabilities(user).canConvert) return json(res, user ? 403 : 401, { error: 'Order conversion is not allowed.' });
    const inquiry = salesInquiryDetail(id, user); if (!inquiry) return json(res, 404, { error: 'Inquiry not found.' });
    const quote = db.prepare("SELECT * FROM sales_quotes WHERE inquiry_id = ? ORDER BY created_at DESC LIMIT 1").get(id); if (!quote) return json(res, 409, { error: 'Generate a quote before converting to order.' });
    const number = `SO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const detail=salesQuoteDetail(quote.id,user);const order = db.prepare(`INSERT INTO sales_orders (order_number, inquiry_id, quote_id, customer_id, total, currency, order_snapshot, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`).get(number, id, quote.id, inquiry.customer_id, detail.summary.grand_total, quote.currency, JSON.stringify(detail), user.id);
    const addOrderItem=db.prepare('INSERT INTO sales_order_items(order_id,product_id,quantity,unit_price,discount_percent,remark,sort_order) VALUES(?,?,?,?,?,?,?)');detail.items.forEach((item,index)=>addOrderItem.run(order.id,item.product_id,item.quantity,item.unit_price,item.discount_percent,item.remark,index));
    const addCustomOrderItem=db.prepare('INSERT INTO sales_order_custom_items(order_id,source_quote_custom_item_id,item_snapshot) VALUES(?,?,?)');detail.custom_items.forEach(item=>addCustomOrderItem.run(order.id,item.id,JSON.stringify(item)));
    db.prepare("UPDATE sales_inquiries SET status = 'Won', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id); timeline(inquiry.customer_id, id, 'Order Created', `${number} created.`, user, { orderId: order.id });
    return json(res, 201, { order });
  },
  async runAiBrainAction(req, res) {
    const user = currentUser(req);
    if (!['Admin', 'Owner'].includes(user?.role)) return json(res, user ? 403 : 401, { error: 'AI Business Brain foundation is internal/admin only.' });
    const body = await readJson(req);
    const result = await aiBusinessBrain.runAiAction({
      moduleName: String(body.moduleName || 'ai-business-brain').trim(),
      actionName: String(body.actionName || 'foundation-check').trim(),
      entityType: String(body.entityType || body.contextType || '').trim(),
      entityId: body.entityId,
      contextType: String(body.contextType || '').trim(),
      promptTemplateKey: body.promptTemplateKey || 'v53.foundation.mock.v1',
      userId: user.id,
      user,
      options: body.options || {}
    });
    return json(res, 200, result);
  },
  aiBrainStatus(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'debug-center')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    return json(res, 200, aiBusinessBrainDebugData());
  },
  knowledgeList(req, res, url) {
    const user = currentUser(req);
    return json(res, 200, { items: knowledgeCenter.list(user, { type: url.searchParams.get('type') || '', status: url.searchParams.get('status') || '', knowledgeKey: url.searchParams.get('knowledgeKey') || '', limit: url.searchParams.get('limit') || 100 }), types: knowledgeCenter.types, statuses: knowledgeCenter.statuses, capabilities: knowledgeCenter.permissions(user) });
  },
  async createKnowledge(req, res) { const user = currentUser(req); return json(res, 201, { item: knowledgeCenter.create(user, await readJson(req)) }); },
  knowledgeDetail(req, res, id) { const user = currentUser(req); return json(res, 200, { item: knowledgeCenter.get(user, id), capabilities: knowledgeCenter.permissions(user) }); },
  async updateKnowledge(req, res, id) { const user = currentUser(req); return json(res, 200, { item: knowledgeCenter.update(user, id, await readJson(req)) }); },
  knowledgeHistory(req, res, id) { const user = currentUser(req); return json(res, 200, { history: knowledgeCenter.history(user, id) }); },
  async transitionKnowledge(req, res, id, action) { const user = currentUser(req); const body = await readJson(req); const map = { 'submit-review': 'submit', approve: 'approve', 'request-changes': 'request_changes', 'mark-outdated': 'mark_outdated', archive: 'archive' }; return json(res, 200, { item: knowledgeCenter.transition(user, id, map[action], body.review_note) }); },
  knowledgeContextPreview(req, res, url) {
    const user = currentUser(req);
    const split = name => String(url.searchParams.get(name) || '').split(',').map(value => value.trim()).filter(Boolean);
    const result = buildKnowledgeContext({ contextType: 'knowledge-center', user, options: { knowledgeTypes: split('knowledgeTypes'), knowledgeKeys: split('knowledgeKeys'), productIds: split('productIds'), customerId: url.searchParams.get('customerId'), timeRangeDays: url.searchParams.get('timeRangeDays') } });
    return json(res, 200, { ...result, cost: { aiCalled: false, estimatedCostUsd: 0 } });
  },
  aiCostSettings(req, res) {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Authentication required.' });
    return json(res, 200, { settings: aiCostControl.settings(), canManage: ['Admin', 'Owner'].includes(user.role) });
  },

  async updateAiCostSettings(req, res) {
    const user = currentUser(req);
    if (!['Admin', 'Owner'].includes(user?.role)) return json(res, user ? 403 : 401, { error: 'Only Admin or Owner can update AI budgets.' });
    const body = await readJson(req);
    const current = aiCostControl.settings();
    const amount = (name, fallback) => Math.max(0, Number(body[name] ?? fallback));
    const cacheDays = Math.max(1, Math.min(365, Number(body.cache_ttl_days ?? current.cache_ttl_days)));
    const provider = String(body.default_provider ?? current.default_provider).trim().toLowerCase() || 'mock';
    db.prepare(`UPDATE ai_cost_settings SET daily_budget_usd = ?, monthly_budget_usd = ?, text_budget_usd = ?,
      image_budget_usd = ?, default_provider = ?, allow_paid_provider = ?, require_confirmation_over_usd = ?,
      cache_ttl_days = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      amount('daily_budget_usd', current.daily_budget_usd), amount('monthly_budget_usd', current.monthly_budget_usd),
      amount('text_budget_usd', current.text_budget_usd), amount('image_budget_usd', current.image_budget_usd),
      provider, body.allow_paid_provider === undefined ? current.allow_paid_provider : body.allow_paid_provider === true,
      amount('require_confirmation_over_usd', current.require_confirmation_over_usd), cacheDays, current.id
    );
    audit(user.id, 'update', 'ai_cost_settings', String(current.id), { provider, allowPaid: body.allow_paid_provider });
    return json(res, 200, { settings: aiCostControl.settings() });
  },

  async estimateAiCost(req, res) {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Authentication required.' });
    const body = await readJson(req);
    const estimate = aiCostControl.estimate({
      module_name: requiredText(body.module_name, 'Module name'), action_name: requiredText(body.action_name, 'Action name'),
      entity_type: String(body.entity_type || '').trim() || null, entity_id: body.entity_id,
      provider: String(body.provider || aiCostControl.settings().default_provider).toLowerCase(), model: body.model,
      input_tokens: Number(body.input_tokens || 0), output_tokens: Number(body.output_tokens || 0),
      image_count: Number(body.image_count || 0), estimated_cost_usd: body.estimated_cost_usd,
      image_unit_cost_usd: body.image_unit_cost_usd, token_cost_per_million: body.token_cost_per_million, user_id: user.id
    });
    return json(res, 201, { estimate });
  },

  async confirmAiCost(req, res) {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Authentication required.' });
    const body = await readJson(req);
    const confirmation = aiCostControl.confirm(Number(body.log_id), user);
    return confirmation ? json(res, 200, { confirmation }) : json(res, 404, { error: 'AI cost estimate not found.' });
  },

  aiCostLogs(req, res, url) {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Authentication required.' });
    const admin = ['Admin', 'Owner'].includes(user.role);
    const rows = db.prepare(`SELECT ai_cost_logs.*, users.name AS user_name FROM ai_cost_logs
      LEFT JOIN users ON users.id = ai_cost_logs.user_id ${admin ? '' : 'WHERE ai_cost_logs.user_id = ?'}
      ORDER BY ai_cost_logs.created_at DESC, ai_cost_logs.id DESC LIMIT ?`).all(...(admin ? [] : [user.id]), Math.min(500, Number(url.searchParams.get('limit') || 100)));
    return json(res, 200, { logs: rows, scope: admin ? 'all' : 'own' });
  },

  aiCostDashboard(req, res) {
    const user = currentUser(req);
    if (!user) return json(res, 401, { error: 'Authentication required.' });
    return json(res, 200, { ...aiCostControl.dashboard(), settings: aiCostControl.settings() });
  },

  async login(req, res) {
    const { email, password } = await readJson(req);
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").get(String(email || '').trim().toLowerCase());
    if (!user || !verifyPassword(String(password || ''), user.password_hash)) {
      return json(res, 401, { error: 'Email or password is incorrect.' });
    }
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    db.prepare('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP').run();
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expiresAt);
    db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
    audit(user.id, 'login', 'session', sessionId.slice(0, 12));
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    return json(res, 200, { user: publicUser(user) }, {
      'Set-Cookie': `rsp_session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionHours * 3600}${secure}`
    });
  },

  logout(req, res) {
    const sessionId = parseCookies(req).rsp_session;
    const user = currentUser(req);
    if (sessionId) db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    if (user) audit(user.id, 'logout', 'session');
    return json(res, 200, { ok: true }, {
      'Set-Cookie': 'rsp_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
    });
  },

  me(req, res) {
    const user = currentUser(req);
    return user ? json(res, 200, { user: publicUser(user) }) : json(res, 401, { error: 'Authentication required.' });
  },

  dashboard(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'dashboard')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const salesScope = user.role === 'Sales' ? ' WHERE opportunities.owner_id = ?' : '';
    const params = user.role === 'Sales' ? [user.id] : [];
    const openPipeline = db.prepare(`SELECT COALESCE(SUM(estimated_value), 0) AS value FROM opportunities${salesScope}${salesScope ? ' AND' : ' WHERE'} stage NOT IN ('Won', 'Lost')`).get(...params).value;
    const activeOpportunities = db.prepare(`SELECT COUNT(*) AS count FROM opportunities${salesScope}${salesScope ? ' AND' : ' WHERE'} stage NOT IN ('Won', 'Lost')`).get(...params).count;
    const proposals = db.prepare("SELECT COUNT(*) AS count FROM proposals WHERE status IN ('draft', 'internal_review', 'sent')").get().count;
    const approvedProducts = db.prepare("SELECT COUNT(*) AS count FROM products WHERE status = 'approved'").get().count;
    const pipelineRows = db.prepare(`
      SELECT opportunities.*, users.name AS owner_name, users.initials AS owner_initials
      FROM opportunities LEFT JOIN users ON users.id = opportunities.owner_id
      ${user.role === 'Sales' ? 'WHERE opportunities.owner_id = ?' : ''}
      ORDER BY CASE opportunities.stage WHEN 'Negotiation' THEN 1 WHEN 'Proposal' THEN 2 WHEN 'Qualified' THEN 3 ELSE 4 END, opportunities.updated_at DESC
      LIMIT 5
    `).all(...params);
    return json(res, 200, {
      metrics: { openPipeline, activeOpportunities, proposals, approvedProducts },
      knowledge: knowledgeDashboardData().metrics,
      productIntelligence: productIntelligenceDashboardData(),
      opportunityIntelligence: opportunityMetrics(),
      aiCostControl: aiCostControl.dashboard(),
      pipeline: pipelineRows,
      generatedAt: new Date().toISOString()
    });
  },

  products(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const rows = db.prepare(`
      SELECT products.*, product_categories.name AS category
      FROM products LEFT JOIN product_categories ON product_categories.id = products.category_id
      ORDER BY products.updated_at DESC
    `).all().map(row => redactSensitiveProductData({ ...productWithTags(row.id), foundation: productFoundation(row.id) },user));
    const categories = db.prepare(`
      SELECT product_categories.id, product_categories.name, product_categories.slug, COUNT(products.id) AS product_count
      FROM product_categories LEFT JOIN products ON products.category_id = product_categories.id
      GROUP BY product_categories.id ORDER BY product_categories.sort_order, product_categories.name
    `).all();
    const tags = db.prepare(`SELECT id, tag_name, tag_type FROM system_tags WHERE active = 1 AND tag_type IN (${productTagTypes.map(() => '?').join(',')}) ORDER BY tag_type, sort_order, tag_name`).all(...productTagTypes);
    const knowledgeTerms = db.prepare('SELECT id, term_type, name FROM product_knowledge_terms WHERE active = 1 ORDER BY term_type, sort_order, name').all();
    return json(res, 200, {
      products: rows, categories, tags, knowledgeTerms, attributeDefinitions: attributeMasterRows().filter(attribute => Number(attribute.active) === 1),
      intelligenceOptions: { budgetLevels, imageTypes: productImageTypes, imageStatuses: productImageStatuses, libraryStatuses: masterValues('Product Status Options',productLibraryStatuses), visibilities: masterValues('Visibility Options',productVisibilities), variantStatuses: masterValues('Product Status Options',variantStatuses), materials:masterValues('Materials'), finishes:masterValues('Finishes'), colors:masterValues('Colors'), units:masterValues('Units'), currencies:masterValues('Currencies'), tradeTerms:masterValues('Trade Terms') },
      capabilities:{canViewSensitive:canViewSensitiveProductData(user),canManage:canManageProductLibrary(user)},
      skuRules: { categoryCodes: skuCategoryCodes, styleCodes: skuStyleCodes }
    });
  },

  productIntelligenceProducts(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const ids = db.prepare("SELECT id FROM products WHERE status != 'archived' ORDER BY updated_at DESC").all().map(row => row.id);
    return json(res, 200, {
      products: ids.map(id => productIntelligenceListItem(productWithTags(id), user)),
      capabilities: {
        canViewSensitive: canViewSensitiveProductData(user),
        canManage: canManageProductLibrary(user)
      },
      source: 'Product Library / Product Intelligence Center',
      aiIntegration: {
        externalProviderCalled: false,
        preparedFor: ['AI recommendation', 'Quote Builder', 'PI Builder', 'Sales Assistant']
      }
    });
  },

  productIntelligenceProductDetail(req, res, id) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const detail = productIntelligenceDetailData(id, user);
    return detail ? json(res, 200, { product: detail, capabilities: { canViewSensitive: canViewSensitiveProductData(user), canManage: canManageProductLibrary(user) } }) : json(res, 404, { error: 'Product not found.' });
  },

  productIntelligenceProductQuality(req, res, id) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const product = productKnowledge(id);
    if (!product) return json(res, 404, { error: 'Product not found.' });
    return json(res, 200, { product_id: id, sku: product.sku, quality: productQualitySummary(product) });
  },

  productIntelligenceProductContext(req, res, id) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const context = productIntelligenceContextData(id, user);
    return context ? json(res, 200, { context }) : json(res, 404, { error: 'Product not found.' });
  },

  async mutateProduct(req, res, id = null) {
    const user = currentUser(req);
    if (!canManageProductLibrary(user)) return json(res, user ? 403 : 401, { error: 'Product creation and editing require Owner or Sales Admin access.' });
    const existing = id ? db.prepare('SELECT * FROM products WHERE id = ?').get(id) : null;
    if (id && !existing) return json(res, 404, { error: 'Product not found.' });
    const body = await readJson(req);
    const categoryId = Number(body.category_id ?? existing?.category_id);
    if (!db.prepare('SELECT id FROM product_categories WHERE id = ?').get(categoryId)) return json(res, 400, { error: 'Product category is required.' });
    const name = requiredText(body.name ?? existing?.name, 'Product name');
    const sku = normalizeSku(body.sku) || (existing?.sku ?? nextSku(categoryId, body.sku_style));
    if (!sku) return json(res, 400, { error: 'SKU is required.' });
    const duplicate = db.prepare('SELECT id FROM products WHERE sku = ? COLLATE NOCASE AND id != ?').get(sku, id || 0);
    if (duplicate) return json(res, 409, { error: 'SKU already exists.' });
    const tagIds = validateProductTags(body.tag_ids ?? (existing ? productWithTags(id).tag_ids : []));
    const budgetLevel = String(body.budget_level ?? existing?.budget_level ?? '').trim();
    if (budgetLevel && !budgetLevels.includes(budgetLevel)) return json(res, 400, { error: 'Budget level is not supported.' });
    const requestedLibraryStatus=String(body.library_status??existing?.library_status??'Draft'),legacyStatusMap={Active:'Approved',New:'Approved','Best Seller':'Approved','Coming Soon':'Pending Review',Hidden:'Inactive',Discontinued:'Inactive'};
    const libraryStatus=legacyStatusMap[requestedLibraryStatus]||requestedLibraryStatus;
    const visibility=String(body.visibility??existing?.visibility??'Website + Quote');
    if(!masterValues('Product Status Options',productLibraryStatuses).includes(libraryStatus))return json(res,400,{error:'Product status is not supported.'});
    if(!masterValues('Visibility Options',productVisibilities).includes(visibility))return json(res,400,{error:'Product visibility is not supported.'});
    const values = [categoryId, sku, name, String(body.summary ?? existing?.summary ?? '').trim() || null,
      String(body.materials ?? existing?.materials ?? '').trim() || null, String(body.size ?? existing?.size ?? '').trim() || null,
      String(body.price_range ?? existing?.price_range ?? '').trim() || null, Number(body.lead_time_days ?? existing?.lead_time_days ?? 0) || null,
      Number(body.moq ?? existing?.moq ?? 0) || null, String(body.status ?? existing?.status ?? 'draft')];
    try {
      db.exec('BEGIN IMMEDIATE');
      if (existing) db.prepare('UPDATE products SET category_id = ?, sku = ?, name = ?, summary = ?, materials = ?, size = ?, price_range = ?, lead_time_days = ?, moq = ?, status = ?, last_updated_by=?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(...values,user.id,id);
      else id = Number(db.prepare('INSERT INTO products (category_id, sku, name, summary, materials, size, price_range, lead_time_days, moq, status, created_by,last_updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?) RETURNING id').get(...values, user.id,user.id).id);
      const intelligenceValues = intelligenceFieldValues({ ...body, budget_level: budgetLevel, library_status:libraryStatus, visibility, website_price_display:body.website_price_display??existing?.website_price_display??'Request Quote' }, existing || {});
      db.prepare(`UPDATE products SET ${productIntelligenceFields.map(field => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...intelligenceValues, id);
      db.prepare(`UPDATE products SET default_supplier=?,supplier_sku=?,supplier_cost=?,supplier_lead_time_days=?,supplier_moq=?,supplier_notes=? WHERE id=?`).run(
        String(body.default_supplier??existing?.default_supplier??'').trim()||null,String(body.supplier_sku??existing?.supplier_sku??'').trim()||null,
        body.supplier_cost===''||body.supplier_cost==null?existing?.supplier_cost??null:Number(body.supplier_cost),body.supplier_lead_time_days===''||body.supplier_lead_time_days==null?existing?.supplier_lead_time_days??null:Number(body.supplier_lead_time_days),
        body.supplier_moq===''||body.supplier_moq==null?existing?.supplier_moq??null:Number(body.supplier_moq),String(body.supplier_notes??existing?.supplier_notes??'').trim()||null,id);
      db.prepare('DELETE FROM product_tag_links WHERE product_id = ?').run(id);
      const link = db.prepare('INSERT INTO product_tag_links (product_id, tag_id) VALUES (?, ?)');
      for (const tagId of tagIds) link.run(id, tagId);
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (error?.code === '23505' || String(error?.message).includes('UNIQUE constraint failed')) return json(res, 409, { error: 'SKU already exists.' });
      throw error;
    }
    syncProductReadiness(id);
    audit(user.id, existing ? 'update' : 'create', 'products', String(id), { sku, tagIds });
    return json(res, existing ? 200 : 201, { product: redactSensitiveProductData(productWithTags(id),user) });
  },

  productDetail(req, res, id) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const product = productKnowledge(id);
    return product ? json(res, 200, { product:redactSensitiveProductData(product,user), options: knowledgeOptions(id), foundation:redactSensitiveProductData(productFoundation(id),user), capabilities:{canViewSensitive:canViewSensitiveProductData(user)}, aiContentFactory: aiFactorySummary(id, user) }) : json(res, 404, { error: 'Product not found.' });
  },

  async generateAiContent(req, res, id) {
    const user = currentUser(req);
    const capabilities = aiFactoryCapabilities(user);
    if (!capabilities.canGenerate) return json(res, user ? 403 : 401, { error: 'AI Product Factory generation is not allowed for this role.' });
    const product = productKnowledge(id);
    if (!product) return json(res, 404, { error: 'Product not found.' });
    const body = await readJson(req);
    const mode = allowedType(String(body.generation_mode || 'standard').toLowerCase(), aiFactoryModes, 'Generation mode');
    const costInput = aiCostInput({ moduleName: 'ai-product-factory', actionName: 'generate-everything', entityType: 'product',
      entityId: id, provider: 'rules', estimatedCost: 0.01, user, fingerprint: `${id}:${mode}:${user.id}` });
    const cached = body.regenerate === true ? null : aiCostControl.cacheGet(costInput);
    if (cached) return json(res, 200, { cached: true, ...cached.cache_value, factory: aiFactorySummary(id, user) });
    prepareAiCostRun(costInput, body, { requireConfirmation: true });
    const source = sourceMediaForProduct(id, body.source_media_id);
    const generated = factoryGeneratedContent(product);
    let draftId;
    const taskIds = [];
    try {
      db.exec('BEGIN IMMEDIATE');
      draftId = Number(db.prepare(`INSERT INTO ai_product_content_drafts
        (product_id, source_media_id, generation_mode, generated_product_name, generated_category, generated_sub_category,
         generated_material, generated_color, generated_style, generated_store_types, generated_description_en,
         generated_description_zh, generated_short_sales_description, generated_seo_title, generated_seo_description,
         generated_meta_keywords, generated_llm_summary, generated_faq, generated_buying_guide, generated_sales_talking_points,
         generated_proposal_notes, generated_ai_tags, analysis_summary, cost_estimate, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?) RETURNING id`).get(
        id, source.id, mode, generated.generated_product_name, generated.generated_category, generated.generated_sub_category,
        generated.generated_material, generated.generated_color, JSON.stringify(generated.generated_style), JSON.stringify(generated.generated_store_types),
        generated.generated_description_en, generated.generated_description_zh, generated.generated_short_sales_description,
        generated.generated_seo_title, generated.generated_seo_description, generated.generated_meta_keywords,
        generated.generated_llm_summary, generated.generated_faq, generated.generated_buying_guide,
        generated.generated_sales_talking_points, generated.generated_proposal_notes, JSON.stringify(generated.generated_ai_tags),
        generated.analysis_summary, 0.01, user.id
      ).id);
      for (const [imageType, sceneType] of aiFactoryImagePlans[mode]) {
        taskIds.push(insertImageTask(product, source, mode, imageType, sceneType, user.id));
      }
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
    recordSystemEvent('info', 'AI Product Factory draft generated', { productId: id, draftId, mode, imageTasks: taskIds.length, provider: 'rules' });
    audit(user.id, 'generate', 'ai_product_content_draft', String(draftId), { productId: id, mode, taskIds });
    const factory = aiFactorySummary(id, user);
    const response = { draft: factory.drafts.find(draft => draft.id === draftId), imageTasks: factory.imageTasks.filter(task => taskIds.includes(task.id)) };
    recordAiExecution(costInput, 'rules', 0);
    aiCostControl.cacheSet(costInput, response);
    return json(res, 201, { ...response, factory });
  },

  aiContentDrafts(req, res, id) {
    const user = currentUser(req);
    const capabilities = aiFactoryCapabilities(user);
    if (!capabilities.canView) return json(res, user ? 403 : 401, { error: 'AI Product Factory is not available for this role.' });
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return json(res, 404, { error: 'Product not found.' });
    return json(res, 200, { drafts: aiFactoryDrafts(id, user), capabilities });
  },

  async updateAiContentDraft(req, res, id, draftId) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canEdit) return json(res, user ? 403 : 401, { error: 'AI draft editing is not allowed for this role.' });
    const existing = db.prepare('SELECT * FROM ai_product_content_drafts WHERE id = ? AND product_id = ?').get(draftId, id);
    if (!existing) return json(res, 404, { error: 'AI content draft not found.' });
    if (existing.status === 'applied') return json(res, 409, { error: 'An applied draft cannot be edited.' });
    const body = await readJson(req);
    const status = body.status === undefined ? existing.status : allowedType(String(body.status), ['draft', 'pending_review'], 'Draft status');
    const values = aiDraftEditableFields.map(field => String(body[field] ?? existing[field] ?? '').trim() || null);
    const styles = body.generated_style === undefined ? jsonArray(existing.generated_style) : jsonArray(body.generated_style);
    const stores = body.generated_store_types === undefined ? jsonArray(existing.generated_store_types) : jsonArray(body.generated_store_types);
    const tags = body.generated_ai_tags === undefined ? jsonArray(existing.generated_ai_tags) : jsonArray(body.generated_ai_tags);
    db.prepare(`UPDATE ai_product_content_drafts SET ${aiDraftEditableFields.map(field => `${field} = ?`).join(', ')},
      generated_style = ?, generated_store_types = ?, generated_ai_tags = ?, status = ?, reviewer_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND product_id = ?`).run(...values, JSON.stringify(styles), JSON.stringify(stores), JSON.stringify(tags), status, draftId, id);
    audit(user.id, 'update', 'ai_product_content_draft', String(draftId), { productId: id, status });
    return json(res, 200, { draft: mappedDraft(db.prepare('SELECT * FROM ai_product_content_drafts WHERE id = ?').get(draftId)) });
  },

  async reviewAiContentDraft(req, res, id, draftId, decision) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canReview) return json(res, user ? 403 : 401, { error: 'AI draft review is not allowed for this role.' });
    const existing = db.prepare('SELECT * FROM ai_product_content_drafts WHERE id = ? AND product_id = ?').get(draftId, id);
    if (!existing) return json(res, 404, { error: 'AI content draft not found.' });
    if (existing.status === 'applied') return json(res, 409, { error: 'An applied draft cannot be reviewed again.' });
    const body = await readJson(req);
    const status = decision === 'approve' ? 'approved' : 'rejected';
    db.prepare('UPDATE ai_product_content_drafts SET status = ?, reviewer_id = ?, review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, user.id, String(body.review_notes || '').trim() || null, draftId);
    audit(user.id, decision, 'ai_product_content_draft', String(draftId), { productId: id });
    return json(res, 200, { draft: mappedDraft(db.prepare('SELECT * FROM ai_product_content_drafts WHERE id = ?').get(draftId)) });
  },

  async applyAiContentDraft(req, res, id, draftId) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canApply) return json(res, user ? 403 : 401, { error: 'Applying AI content is not allowed for this role.' });
    const draft = mappedDraft(db.prepare('SELECT * FROM ai_product_content_drafts WHERE id = ? AND product_id = ?').get(draftId, id));
    if (!draft) return json(res, 404, { error: 'AI content draft not found.' });
    if (draft.status !== 'approved') return json(res, 409, { error: 'Only an approved draft can be applied.' });
    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare(`UPDATE products SET
        english_description = COALESCE(NULLIF(?, ''), english_description),
        short_sales_description = COALESCE(NULLIF(?, ''), short_sales_description),
        seo_title = COALESCE(NULLIF(?, ''), seo_title), seo_description = COALESCE(NULLIF(?, ''), seo_description),
        meta_keywords = COALESCE(NULLIF(?, ''), meta_keywords), llm_summary = COALESCE(NULLIF(?, ''), llm_summary),
        faq = COALESCE(NULLIF(?, ''), faq), buying_guide = COALESCE(NULLIF(?, ''), buying_guide),
        sales_talking_points = COALESCE(NULLIF(?, ''), sales_talking_points),
        proposal_usage_notes = COALESCE(NULLIF(?, ''), proposal_usage_notes),
        ai_summary = COALESCE(NULLIF(?, ''), ai_summary), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        draft.generated_description_en || '', draft.generated_short_sales_description || '', draft.generated_seo_title || '',
        draft.generated_seo_description || '', draft.generated_meta_keywords || '', draft.generated_llm_summary || '',
        draft.generated_faq || '', draft.generated_buying_guide || '', draft.generated_sales_talking_points || '',
        draft.generated_proposal_notes || '', draft.generated_llm_summary || '', id
      );
      db.prepare("DELETE FROM product_keywords WHERE product_id = ? AND keyword_type = 'ai'").run(id);
      const addKeyword = db.prepare("INSERT INTO product_keywords (product_id, keyword_type, keyword) VALUES (?, 'ai', ?)");
      for (const keyword of normalizedKeywords(draft.generated_ai_tags)) addKeyword.run(id, keyword);
      db.prepare("UPDATE ai_product_content_drafts SET status = 'applied', reviewer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id, draftId);
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
    syncProductReadiness(id);
    recordSystemEvent('info', 'AI Product Factory draft applied', { productId: id, draftId });
    audit(user.id, 'apply', 'ai_product_content_draft', String(draftId), { productId: id });
    return json(res, 200, { product: productKnowledge(id), draft: mappedDraft(db.prepare('SELECT * FROM ai_product_content_drafts WHERE id = ?').get(draftId)) });
  },

  imageGenerationTasks(req, res, id) {
    const user = currentUser(req);
    const capabilities = aiFactoryCapabilities(user);
    if (!capabilities.canView) return json(res, user ? 403 : 401, { error: 'Image generation tasks are not available for this role.' });
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return json(res, 404, { error: 'Product not found.' });
    return json(res, 200, { imageTasks: aiFactoryTasks(id, user), capabilities });
  },

  async createImageGenerationTask(req, res, id) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canGenerate) return json(res, user ? 403 : 401, { error: 'Image task creation is not allowed for this role.' });
    const product = productKnowledge(id);
    if (!product) return json(res, 404, { error: 'Product not found.' });
    const body = await readJson(req);
    const mode = allowedType(String(body.generation_mode || 'standard').toLowerCase(), aiFactoryModes, 'Generation mode');
    const source = sourceMediaForProduct(id, body.source_media_id);
    const imageType = requiredText(body.image_type, 'Image type');
    const provider = allowedType(String(body.provider || aiImageProviderConfig().activeProvider).toLowerCase(), ['mock', 'reserved', 'openai', 'gemini', 'claude', 'flux', 'ideogram'], 'Provider');
    const taskId = insertImageTask(product, source, mode, imageType, String(body.scene_type || '').trim() || null, user.id, { ...body, provider });
    audit(user.id, 'create', 'ai_image_generation_task', String(taskId), { productId: id, mode, provider });
    return json(res, 201, { imageTask: aiFactoryTasks(id, user).find(task => task.id === taskId) });
  },

  aiImageProviderStatus(req, res) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'AI image provider status is not available for this role.' });
    return json(res, 200, aiImageGenerationDebugData());
  },

  async updateImageGenerationTask(req, res, id, taskId) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canGenerate) return json(res, user ? 403 : 401, { error: 'Image task editing is not allowed for this role.' });
    const task = imageTaskById(id, taskId);
    if (!task) return json(res, 404, { error: 'Image generation task not found.' });
    if (!['draft', 'pending', 'failed'].includes(task.status)) return json(res, 409, { error: 'Only draft, pending, or failed tasks can be edited.' });
    const body = await readJson(req);
    const prompt = requiredText(body.prompt ?? task.prompt, 'Prompt');
    const negativePrompt = String(body.negative_prompt ?? task.negative_prompt ?? '').trim() || null;
    const provider = allowedType(String(body.provider ?? task.provider ?? 'mock').toLowerCase(), ['mock', 'openai', 'reserved', 'flux', 'ideogram', 'gemini', 'claude'], 'Provider');
    db.prepare(`UPDATE ai_image_generation_tasks SET prompt = ?, negative_prompt = ?, provider = ?, prompt_version = prompt_version + 1,
      error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND product_id = ?`).run(prompt, negativePrompt, provider, taskId, id);
    audit(user.id, 'update', 'ai_image_generation_task', String(taskId), { productId: id, promptVersion: Number(task.prompt_version || 1) + 1 });
    return json(res, 200, { imageTask: imageTaskById(id, taskId) });
  },

  async runImageGenerationTask(req, res, id, taskId) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canRunImageTasks) return json(res, user ? 403 : 401, { error: 'Image generation is not allowed for this role.' });
    const body = await readJson(req);
    requireImageTaskConfirmation(body);
    const product = productKnowledge(id);
    if (!product) return json(res, 404, { error: 'Product not found.' });
    const task = imageTaskById(id, taskId);
    if (!task) return json(res, 404, { error: 'Image generation task not found.' });
    prepareAiCostRun(aiCostInput({ moduleName: 'ai-image-generation', actionName: 'run-image-task', entityType: 'image-task',
      entityId: taskId, provider: task.provider, estimatedCost: task.cost_estimate, imageCount: 1, user }), body, { requireConfirmation: true });
    return json(res, 200, { imageTask: await executeImageTask(product, task, user), provider: aiImageProviderConfig() });
  },

  async runSelectedImageTasks(req, res, id) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canRunImageTasks) return json(res, user ? 403 : 401, { error: 'Image generation is not allowed for this role.' });
    const body = await readJson(req);
    requireImageTaskConfirmation(body);
    const product = productKnowledge(id);
    if (!product) return json(res, 404, { error: 'Product not found.' });
    const ids = normalizedIds(body.task_ids);
    if (!ids.length) return json(res, 400, { error: 'Select at least one image task.' });
    const maxPerRun = aiImageProviderConfig().maxPerRun;
    if (ids.length > maxPerRun) return json(res, 400, { error: `A maximum of ${maxPerRun} image tasks can run at once.` });
    const tasks = ids.map(taskId => imageTaskById(id, taskId));
    if (tasks.some(task => !task)) return json(res, 404, { error: 'One or more image tasks were not found.' });
    prepareAiCostRun(aiCostInput({ moduleName: 'ai-image-generation', actionName: 'run-selected-image-tasks', entityType: 'product',
      entityId: id, provider: tasks.some(task => task.provider === 'openai') ? 'openai' : 'mock',
      estimatedCost: tasks.reduce((sum, task) => sum + Number(task.cost_estimate || 0), 0), imageCount: tasks.length, user }), body, { requireConfirmation: true });
    const imageTasks = await executeImageTaskBatch(product, tasks, user);
    return json(res, 200, { imageTasks, limit: maxPerRun });
  },

  async runAllImageTasks(req, res, id) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canRunImageTasks) return json(res, user ? 403 : 401, { error: 'Image generation is not allowed for this role.' });
    const body = await readJson(req);
    requireImageTaskConfirmation(body);
    const product = productKnowledge(id);
    if (!product) return json(res, 404, { error: 'Product not found.' });
    const maxPerRun = aiImageProviderConfig().maxPerRun;
    const taskRows = db.prepare(`SELECT id FROM ai_image_generation_tasks WHERE product_id = ?
      AND COALESCE(lifecycle_status, status) IN ('draft', 'pending') ORDER BY created_at, id LIMIT ?`).all(id, maxPerRun);
    const tasks = taskRows.map(row => imageTaskById(id, row.id));
    prepareAiCostRun(aiCostInput({ moduleName: 'ai-image-generation', actionName: 'run-all-image-tasks', entityType: 'product',
      entityId: id, provider: tasks.some(task => task.provider === 'openai') ? 'openai' : 'mock',
      estimatedCost: tasks.reduce((sum, task) => sum + Number(task.cost_estimate || 0), 0), imageCount: tasks.length, user }), body, { requireConfirmation: true });
    const imageTasks = await executeImageTaskBatch(product, tasks, user);
    const remaining = db.prepare("SELECT COUNT(*) AS count FROM ai_image_generation_tasks WHERE product_id = ? AND COALESCE(lifecycle_status, status) IN ('draft', 'pending')").get(id).count;
    return json(res, 200, { imageTasks, limit: maxPerRun, remaining });
  },

  async retryImageGenerationTask(req, res, id, taskId) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canRunImageTasks) return json(res, user ? 403 : 401, { error: 'Image generation retry is not allowed for this role.' });
    const body = await readJson(req);
    requireImageTaskConfirmation(body);
    const product = productKnowledge(id);
    if (!product) return json(res, 404, { error: 'Product not found.' });
    const task = imageTaskById(id, taskId);
    if (!task) return json(res, 404, { error: 'Image generation task not found.' });
    if (task.status !== 'failed') return json(res, 409, { error: 'Only a failed task can be retried.' });
    prepareAiCostRun(aiCostInput({ moduleName: 'ai-image-generation', actionName: 'retry-image-task', entityType: 'image-task',
      entityId: taskId, provider: task.provider, estimatedCost: task.cost_estimate, imageCount: 1, user }), body, { requireConfirmation: true });
    setImageTaskLifecycle(id, taskId, 'pending', { source: 'retry' });
    return json(res, 200, { imageTask: await executeImageTask(product, imageTaskById(id, taskId), user) });
  },

  async cancelImageGenerationTask(req, res, id, taskId) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canRunImageTasks) return json(res, user ? 403 : 401, { error: 'Image task cancellation is not allowed for this role.' });
    const task = imageTaskById(id, taskId);
    if (!task) return json(res, 404, { error: 'Image generation task not found.' });
    if (!['draft', 'pending', 'running', 'failed'].includes(task.status)) return json(res, 409, { error: 'This task can no longer be cancelled.' });
    db.prepare("UPDATE ai_image_generation_tasks SET review_notes = 'Cancelled before approval.', reviewed_at = CURRENT_TIMESTAMP, reviewer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id, taskId);
    setImageTaskLifecycle(id, taskId, 'rejected', { source: 'cancelled', reviewerId: user.id });
    audit(user.id, 'cancel', 'ai_image_generation_task', String(taskId), { productId: id });
    return json(res, 200, { imageTask: imageTaskById(id, taskId) });
  },

  async reviewImageGenerationTask(req, res, id, taskId, decision) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canReviewImages) return json(res, user ? 403 : 401, { error: 'Image review is not allowed for this role.' });
    const task = imageTaskById(id, taskId);
    if (!task) return json(res, 404, { error: 'Image generation task not found.' });
    if (!['generated', 'pending_review', 'approved'].includes(task.status)) return json(res, 409, { error: 'This image is not ready for review.' });
    const body = await readJson(req);
    const status = decision === 'approve' ? 'approved' : 'rejected';
    db.prepare('UPDATE ai_image_generation_tasks SET reviewer_id = ?, review_notes = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(user.id, String(body.review_notes || '').trim() || null, taskId);
    if (task.output_media_id && status === 'rejected') db.prepare("UPDATE media_assets SET image_status = 'Rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.output_media_id);
    setImageTaskLifecycle(id, taskId, status, { reviewerId: user.id });
    audit(user.id, decision, 'ai_image_generation_task', String(taskId), { productId: id });
    return json(res, 200, { imageTask: imageTaskById(id, taskId) });
  },

  async applyImageGenerationTask(req, res, id, taskId) {
    const user = currentUser(req);
    if (!aiFactoryCapabilities(user).canApplyImages) return json(res, user ? 403 : 401, { error: 'Applying generated images is not allowed for this role.' });
    const task = imageTaskById(id, taskId);
    if (!task) return json(res, 404, { error: 'Image generation task not found.' });
    if (task.status !== 'approved' || !task.output_media_id) return json(res, 409, { error: 'Only an approved generated image can be applied.' });
    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare("UPDATE media_assets SET image_status = 'Approved', is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.output_media_id);
      db.prepare('INSERT OR IGNORE INTO product_media_links (product_id, media_id, is_primary, sort_order) VALUES (?, ?, 0, 999)').run(id, task.output_media_id);
      db.prepare('UPDATE ai_image_generation_tasks SET applied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(taskId);
      setImageTaskLifecycle(id, taskId, 'applied', { appliedBy: user.id, outputMediaId: task.output_media_id });
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
    syncProductReadiness(id);
    audit(user.id, 'apply', 'ai_image_generation_task', String(taskId), { productId: id, outputMediaId: task.output_media_id });
    return json(res, 200, { imageTask: imageTaskById(id, taskId), product: productKnowledge(id) });
  },

  async generateIntelligence(req, res, id, type) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const product = productKnowledge(id);
    if (!product) return json(res, 404, { error: 'Product not found.' });
    const body = await readJson(req);
    const costInput = aiCostInput({ moduleName: 'product-intelligence', actionName: `generate-${type}`, entityType: 'product',
      entityId: id, provider: 'rules', estimatedCost: 0, user, fingerprint: `${id}:${type}:${product.updated_at}` });
    const cached = body.regenerate === true ? null : aiCostControl.cacheGet(costInput);
    if (cached) return json(res, 200, { generated: cached.cache_value, mode: 'cache', cached: true, requiresHumanReview: true });
    const generated = generateProductContent(product, type);
    recordAiExecution(costInput, 'rules', 0);
    aiCostControl.cacheSet(costInput, generated);
    audit(user.id, 'generate', 'product_intelligence', String(id), { type, mode: 'rules' });
    return json(res, 200, { generated, mode: 'rules', requiresHumanReview: true });
  },

  async createProductImage(req, res, id) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return json(res, 404, { error: 'Product not found.' });
    const body = await readJson(req);
    const imageType = String(body.image_type || 'Detail Image');
    const imageStatus = String(body.image_status || (body.is_ai_generated ? 'AI Generated' : 'Uploaded'));
    if (!productImageTypes.includes(imageType)) return json(res, 400, { error: 'Image type is not supported.' });
    if (!productImageStatuses.includes(imageStatus)) return json(res, 400, { error: 'Image status is not supported.' });
    const isAiGenerated = body.is_ai_generated === true || imageStatus === 'AI Generated';
    const fileName = String(body.file_name || (isAiGenerated ? `AI image placeholder - ${imageType}` : '')).trim();
    if (!fileName) return json(res, 400, { error: 'Image file name is required.' });
    let mediaId;
    try {
      db.exec('BEGIN IMMEDIATE');
      mediaId = Number(db.prepare(`INSERT INTO media_assets
        (file_name, file_type, file_url, related_module, related_record_id, media_category, is_verified, is_ai_generated, image_type, image_status, generated_source, variant_id, document_type, active, created_by)
        VALUES (?, ?, ?, 'products', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?) RETURNING id`).get(
        fileName, String(body.file_type || 'image/jpeg'), String(body.file_url || '').trim() || null, String(id),
        isAiGenerated ? 'AI Generated Image' : 'Product Photo', imageStatus === 'Approved' ? 1 : 0, isAiGenerated ? 1 : 0,
        imageType, imageStatus, isAiGenerated ? 'Reserved AI generation entry' : null, body.variant_id?Number(body.variant_id):null, String(body.document_type||'').trim()||null, user.id
      ).id);
      const makeMain = imageType === 'Main Image' || body.mark_main === true;
      if (makeMain) db.prepare('UPDATE product_media_links SET is_primary = 0 WHERE product_id = ?').run(id);
      db.prepare('INSERT INTO product_media_links (product_id, media_id, is_primary, sort_order) VALUES (?, ?, ?, ?)').run(id, mediaId, makeMain ? 1 : 0, Number(body.sort_order || 0));
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
    syncProductReadiness(id);
    audit(user.id, 'create', 'product_image', String(mediaId), { productId: id, imageType, imageStatus });
    return json(res, 201, { product: productKnowledge(id) });
  },

  async updateProductImage(req, res, id, mediaId) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const existing = db.prepare(`SELECT media_assets.*, product_media_links.is_primary FROM product_media_links
      JOIN media_assets ON media_assets.id = product_media_links.media_id WHERE product_media_links.product_id = ? AND media_assets.id = ?`).get(id, mediaId);
    if (!existing) return json(res, 404, { error: 'Product image not found.' });
    const body = await readJson(req);
    const imageType = String(body.image_type ?? existing.image_type);
    const imageStatus = String(body.image_status ?? existing.image_status);
    if (!productImageTypes.includes(imageType)) return json(res, 400, { error: 'Image type is not supported.' });
    if (!productImageStatuses.includes(imageStatus)) return json(res, 400, { error: 'Image status is not supported.' });
    const makeMain = body.mark_main === true || imageType === 'Main Image';
    try {
      db.exec('BEGIN IMMEDIATE');
      if (makeMain) {
        db.prepare('UPDATE product_media_links SET is_primary = 0 WHERE product_id = ?').run(id);
        db.prepare("UPDATE media_assets SET image_type = 'Detail Image' WHERE id IN (SELECT media_id FROM product_media_links WHERE product_id = ?) AND id != ? AND image_type = 'Main Image'").run(id, mediaId);
      }
      db.prepare('UPDATE media_assets SET file_name = ?, file_url = ?, image_type = ?, image_status = ?, is_verified = ?, variant_id=?, document_type=?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(String(body.file_name ?? existing.file_name).trim(), String(body.file_url ?? existing.file_url ?? '').trim() || null, makeMain ? 'Main Image' : imageType, imageStatus, imageStatus === 'Approved' ? 1 : 0,body.variant_id?Number(body.variant_id):null,String(body.document_type??existing.document_type??'').trim()||null,mediaId);
      db.prepare('UPDATE product_media_links SET is_primary = ? WHERE product_id = ? AND media_id = ?').run(makeMain ? 1 : 0, id, mediaId);
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
    syncProductReadiness(id);
    audit(user.id, 'update', 'product_image', String(mediaId), { productId: id, imageType, imageStatus, makeMain });
    return json(res, 200, { product: productKnowledge(id) });
  },

  knowledgeDashboard(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    return json(res, 200, knowledgeDashboardData());
  },

  searchProducts(req, res, url) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const where = ["products.status != 'archived'"];
    const params = [];
    const contains = (column, value) => { if (value) { where.push(`${column} LIKE ? COLLATE NOCASE`); params.push(`%${value}%`); } };
    const q = String(url.searchParams.get('q') || '').trim();
    if (q) {
      where.push(`(products.name LIKE ? COLLATE NOCASE OR products.sku LIKE ? COLLATE NOCASE OR products.summary LIKE ? COLLATE NOCASE OR products.materials LIKE ? COLLATE NOCASE OR products.ai_summary LIKE ? COLLATE NOCASE OR EXISTS (SELECT 1 FROM product_keywords WHERE product_keywords.product_id = products.id AND product_keywords.keyword LIKE ? COLLATE NOCASE) OR EXISTS (SELECT 1 FROM product_categories pc WHERE pc.id = products.category_id AND pc.name LIKE ? COLLATE NOCASE) OR EXISTS (SELECT 1 FROM product_tag_links ptl JOIN system_tags st ON st.id = ptl.tag_id WHERE ptl.product_id = products.id AND st.tag_name LIKE ? COLLATE NOCASE) OR EXISTS (SELECT 1 FROM product_knowledge_links pkl JOIN product_knowledge_terms pkt ON pkt.id = pkl.term_id WHERE pkl.product_id = products.id AND pkt.name LIKE ? COLLATE NOCASE))`);
      params.push(...Array(9).fill(`%${q}%`));
    }
    contains('products.sku', String(url.searchParams.get('sku') || '').trim());
    contains('products.materials', String(url.searchParams.get('material') || '').trim());
    const category = String(url.searchParams.get('category') || '').trim();
    if (category) {
      where.push('EXISTS (SELECT 1 FROM product_categories pc WHERE pc.id = products.category_id AND pc.name = ? COLLATE NOCASE)');
      params.push(category);
    }
    const budgetLevel = String(url.searchParams.get('budgetLevel') || '').trim();
    if (budgetLevel) { where.push('products.budget_level = ? COLLATE NOCASE'); params.push(budgetLevel); }
    const proposalReady = String(url.searchParams.get('proposalReady') || '').trim();
    if (proposalReady) { where.push('products.proposal_ready_status = ? COLLATE NOCASE'); params.push(proposalReady); }
    const aiTag = String(url.searchParams.get('aiTag') || '').trim();
    if (aiTag) {
      where.push("EXISTS (SELECT 1 FROM product_keywords pk WHERE pk.product_id = products.id AND pk.keyword_type = 'ai' AND pk.keyword LIKE ? COLLATE NOCASE)");
      params.push(`%${aiTag}%`);
    }
    for (const [parameter, type] of [['storeType', 'store_type'], ['style', 'style'], ['feature', 'feature']]) {
      const value = String(url.searchParams.get(parameter) || '').trim();
      if (value) {
        where.push('EXISTS (SELECT 1 FROM product_knowledge_links pkl JOIN product_knowledge_terms pkt ON pkt.id = pkl.term_id WHERE pkl.product_id = products.id AND pkt.term_type = ? AND pkt.name = ? COLLATE NOCASE)');
        params.push(type, value);
      }
    }
    const tag = String(url.searchParams.get('tag') || '').trim();
    if (tag) {
      where.push('EXISTS (SELECT 1 FROM product_tag_links ptl JOIN system_tags st ON st.id = ptl.tag_id WHERE ptl.product_id = products.id AND st.tag_name = ? COLLATE NOCASE)');
      params.push(tag);
    }
    const ids = db.prepare(`SELECT products.id FROM products WHERE ${where.join(' AND ')} ORDER BY products.updated_at DESC LIMIT 500`).all(...params).map(row => row.id);
    return json(res, 200, { products: redactSensitiveProductData(ids.map(productWithTags),user), query: Object.fromEntries(url.searchParams) });
  },

  async mutateKnowledge(req, res, id) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return json(res, 404, { error: 'Product not found.' });
    const body = await readJson(req);
    const options = knowledgeOptions(id);
    const validateIds = (value, validRows, field) => {
      const ids = normalizedIds(value);
      const valid = new Set(validRows.map(row => row.id));
      if (ids.some(item => !valid.has(item))) { const error = new Error(`${field} contains an invalid selection.`); error.status = 400; throw error; }
      return ids;
    };
    const termIds = validateIds(body.term_ids, options.terms, 'Knowledge terms');
    const recommendedIds = validateIds(body.recommended_product_ids, options.products, 'Recommended products');
    const aiRelatedIds = validateIds(body.ai_related_product_ids, options.products, 'AI related products');
    const caseIds = validateIds(body.case_ids, options.cases, 'Cases');
    const mediaIds = validateIds(body.media_ids, options.media, 'Media');
    const relatedCategoryIds = validateIds(body.related_category_ids, options.categories, 'Related categories');
    const aiKeywords = normalizedKeywords(body.ai_keywords);
    const searchKeywords = normalizedKeywords(body.ai_search_keywords);
    const text = value => String(value ?? '').trim() || null;
    const recommendationWeight = Math.min(100, Math.max(0, Number(body.ai_recommendation_weight ?? 50) || 0));
    const budgetLevel = String(body.budget_level ?? existing.budget_level ?? '').trim();
    if (budgetLevel && !budgetLevels.includes(budgetLevel)) return json(res, 400, { error: 'Budget level is not supported.' });
    try {
      db.exec('BEGIN IMMEDIATE');
      const intelligenceValues = intelligenceFieldValues({ ...body, budget_level: budgetLevel }, existing);
      db.prepare(`UPDATE products SET ai_summary = ?, ai_recommendation_weight = ?, ai_notes = ?, internal_notes = ?, knowledge_prompt = ?, ${productIntelligenceFields.map(field => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(text(body.ai_summary ?? existing.ai_summary), recommendationWeight, text(body.ai_notes ?? existing.ai_notes), text(body.internal_notes ?? existing.internal_notes), text(body.knowledge_prompt ?? existing.knowledge_prompt), ...intelligenceValues, id);
      for (const table of ['product_knowledge_links', 'product_case_links', 'product_media_links', 'product_keywords', 'product_related_category_links']) db.prepare(`DELETE FROM ${table} WHERE product_id = ?`).run(id);
      db.prepare('DELETE FROM product_relationships WHERE source_product_id = ?').run(id);
      const addTerm = db.prepare('INSERT INTO product_knowledge_links (product_id, term_id) VALUES (?, ?)');
      for (const termId of termIds) addTerm.run(id, termId);
      const addRelationship = db.prepare('INSERT INTO product_relationships (source_product_id, target_product_id, relationship_type, recommendation_weight) VALUES (?, ?, ?, ?)');
      for (const targetId of recommendedIds) addRelationship.run(id, targetId, 'recommended', recommendationWeight);
      for (const targetId of aiRelatedIds) addRelationship.run(id, targetId, 'ai_related', recommendationWeight);
      const addCase = db.prepare('INSERT INTO product_case_links (product_id, case_id) VALUES (?, ?)');
      for (const caseId of caseIds) addCase.run(id, caseId);
      const addMedia = db.prepare('INSERT INTO product_media_links (product_id, media_id, is_primary, sort_order) VALUES (?, ?, ?, ?)');
      mediaIds.forEach((mediaId, index) => addMedia.run(id, mediaId, index === 0 ? 1 : 0, index));
      const addKeyword = db.prepare('INSERT INTO product_keywords (product_id, keyword_type, keyword) VALUES (?, ?, ?)');
      for (const keyword of aiKeywords) addKeyword.run(id, 'ai', keyword);
      for (const keyword of searchKeywords) addKeyword.run(id, 'search', keyword);
      const addRelatedCategory = db.prepare('INSERT INTO product_related_category_links (product_id, category_id) VALUES (?, ?)');
      for (const categoryId of relatedCategoryIds) addRelatedCategory.run(id, categoryId);
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
    syncProductReadiness(id);
    audit(user.id, 'update', 'product_knowledge', String(id), { termIds, recommendedIds, caseIds, mediaIds, relatedCategoryIds });
    return json(res, 200, { product: productKnowledge(id) });
  },

  productCategories(req,res){const user=currentUser(req);if(!requires(user,'products'))return json(res,user?403:401,{error:'Access denied.'});return json(res,200,{categories:db.prepare('SELECT pc.*,COUNT(p.id) AS product_count FROM product_categories pc LEFT JOIN products p ON p.category_id=pc.id GROUP BY pc.id ORDER BY pc.sort_order,pc.name').all()});},
  async createProductCategory(req,res){const user=currentUser(req);if(!canManageProductLibrary(user))return json(res,user?403:401,{error:'Administrator access required.'});const b=await readJson(req);const name=requiredText(b.name,'Category name'),slug=String(b.slug||makeCode(name).toLowerCase()).trim();try{const row=db.prepare('INSERT INTO product_categories(name,slug,description,active,sort_order) VALUES(?,?,?,?,?) RETURNING *').get(name,slug,String(b.description||'').trim()||null,b.active===false?0:1,Number(b.sort_order||0));return json(res,201,{category:row})}catch(error){return json(res,409,{error:'Category name or slug already exists.'})}},
  async updateProductCategory(req,res,id){const user=currentUser(req);if(!canManageProductLibrary(user))return json(res,user?403:401,{error:'Administrator access required.'});const existing=db.prepare('SELECT * FROM product_categories WHERE id=?').get(id);if(!existing)return json(res,404,{error:'Category not found.'});const b=await readJson(req);db.prepare('UPDATE product_categories SET name=?,slug=?,description=?,active=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(requiredText(b.name??existing.name,'Category name'),String(b.slug??existing.slug).trim(),String(b.description??existing.description??'').trim()||null,b.active===undefined?existing.active:b.active?1:0,Number(b.sort_order??existing.sort_order??0),id);return json(res,200,{category:db.prepare('SELECT * FROM product_categories WHERE id=?').get(id)})},
  deleteProductCategory(req,res,id){const user=currentUser(req);if(!canManageProductLibrary(user))return json(res,user?403:401,{error:'Administrator access required.'});const count=Number(db.prepare('SELECT COUNT(*) AS count FROM products WHERE category_id=?').get(id).count);if(count)return json(res,409,{error:'Move products to another category before deleting this category.'});const result=db.prepare('DELETE FROM product_categories WHERE id=?').run(id);return result.changes?json(res,200,{deleted:true}):json(res,404,{error:'Category not found.'})},

  productTags(req,res){const user=currentUser(req);if(!requires(user,'products'))return json(res,user?403:401,{error:'Access denied.'});return json(res,200,{groups:productTagTypes,tags:db.prepare(`SELECT st.*,COUNT(ptl.product_id) AS usage_count FROM system_tags st LEFT JOIN product_tag_links ptl ON ptl.tag_id=st.id WHERE st.tag_type IN (${productTagTypes.map(()=>'?').join(',')}) GROUP BY st.id ORDER BY st.tag_type,st.sort_order,st.tag_name`).all(...productTagTypes)})},
  async createProductTag(req,res){const user=currentUser(req);if(!canManageProductLibrary(user))return json(res,user?403:401,{error:'Administrator access required.'});const b=await readJson(req),group=String(b.tag_type||'');if(!productTagTypes.includes(group))return json(res,400,{error:'Tag group is not supported.'});const name=requiredText(b.tag_name,'Tag name'),code=requiredText(b.code||makeCode(name),'Tag code');const row=db.prepare('INSERT INTO system_tags(tag_name,tag_type,code,description,active,is_system,sort_order,created_by) VALUES(?,?,?,?,?,0,?,?) RETURNING *').get(name,group,code,String(b.description||'').trim()||null,b.active===false?0:1,Number(b.sort_order||0),user.id);return json(res,201,{tag:row})},
  async updateProductTag(req,res,id){const user=currentUser(req);if(!canManageProductLibrary(user))return json(res,user?403:401,{error:'Administrator access required.'});const existing=db.prepare('SELECT * FROM system_tags WHERE id=?').get(id);if(!existing)return json(res,404,{error:'Tag not found.'});const b=await readJson(req),group=String(b.tag_type??existing.tag_type);if(!productTagTypes.includes(group))return json(res,400,{error:'Tag group is not supported.'});db.prepare('UPDATE system_tags SET tag_name=?,tag_type=?,code=?,description=?,active=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(requiredText(b.tag_name??existing.tag_name,'Tag name'),group,requiredText(b.code??existing.code,'Tag code'),String(b.description??existing.description??'').trim()||null,b.active===undefined?existing.active:b.active?1:0,Number(b.sort_order??existing.sort_order??0),id);return json(res,200,{tag:db.prepare('SELECT * FROM system_tags WHERE id=?').get(id)})},
  deleteProductTag(req,res,id){const user=currentUser(req);if(!canManageProductLibrary(user))return json(res,user?403:401,{error:'Administrator access required.'});const used=Number(db.prepare('SELECT COUNT(*) AS count FROM product_tag_links WHERE tag_id=?').get(id).count);if(used)return json(res,409,{error:'Disable this tag instead; it is assigned to existing products.'});const result=db.prepare('DELETE FROM system_tags WHERE id=?').run(id);return result.changes?json(res,200,{deleted:true}):json(res,404,{error:'Tag not found.'})},

  productVariants(req,res){const user=currentUser(req);if(!requires(user,'products'))return json(res,user?403:401,{error:'Access denied.'});return json(res,200,{variants:redactSensitiveProductData(db.prepare('SELECT pv.*,p.name AS product_name,p.sku AS product_sku FROM product_variants pv JOIN products p ON p.id=pv.product_id ORDER BY p.name,pv.sort_order,pv.id').all(),user),products:db.prepare("SELECT id,name,sku FROM products WHERE status!='archived' ORDER BY name").all(),capabilities:{canViewSensitive:canViewSensitiveProductData(user)}})},

async createProductVariant(req,res,productId){const user=currentUser(req);if(!['Admin','Owner','Designer'].includes(user?.role))return json(res,user?403:401,{error:'Product editing is not allowed.'});if(!db.prepare('SELECT id FROM products WHERE id=?').get(productId))return json(res,404,{error:'Product not found.'});const b=await readJson(req),status=String(b.status||'Active');if(!masterValues('Product Status Options',variantStatuses).includes(status))return json(res,400,{error:'Variant status is not supported.'});const values=variantFieldValues(b);values[0]=requiredText(values[0],'Variant name');const row=db.prepare('INSERT INTO product_variants(product_id,variant_name,variant_sku,dimensions,material,finish,color,reference_price,cost_price,moq,lead_time_days,cbm,gross_weight_kg,net_weight_kg,packing_info,default_supplier,supplier_sku,supplier_cost,supplier_lead_time_days,supplier_moq,supplier_notes,status,sort_order,last_updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *').get(productId,...values,status,Number(b.sort_order||0),user.id);return json(res,201,{variant:redactSensitiveProductData(row,user)})},
  async updateProductVariant(req,res,productId,variantId){const user=currentUser(req);if(!['Admin','Owner','Designer'].includes(user?.role))return json(res,user?403:401,{error:'Product editing is not allowed.'});const existing=db.prepare('SELECT * FROM product_variants WHERE id=? AND product_id=?').get(variantId,productId);if(!existing)return json(res,404,{error:'Variant not found.'});const b=await readJson(req),status=String(b.status??existing.status);if(!masterValues('Product Status Options',variantStatuses).includes(status))return json(res,400,{error:'Variant status is not supported.'});const values=variantFieldValues(b,existing);values[0]=requiredText(values[0],'Variant name');db.prepare('UPDATE product_variants SET variant_name=?,variant_sku=?,dimensions=?,material=?,finish=?,color=?,reference_price=?,cost_price=?,moq=?,lead_time_days=?,cbm=?,gross_weight_kg=?,net_weight_kg=?,packing_info=?,default_supplier=?,supplier_sku=?,supplier_cost=?,supplier_lead_time_days=?,supplier_moq=?,supplier_notes=?,status=?,sort_order=?,last_updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND product_id=?').run(...values,status,Number(b.sort_order??existing.sort_order),user.id,variantId,productId);return json(res,200,{variant:redactSensitiveProductData(db.prepare('SELECT * FROM product_variants WHERE id=?').get(variantId),user)})},
  deleteProductVariant(req,res,productId,variantId){const user=currentUser(req);if(!['Admin','Owner'].includes(user?.role))return json(res,user?403:401,{error:'Administrator access required.'});const result=db.prepare('DELETE FROM product_variants WHERE id=? AND product_id=?').run(variantId,productId);return result.changes?json(res,200,{deleted:true}):json(res,404,{error:'Variant not found.'})},

  productAttributes(req,res){const user=currentUser(req);if(!requires(user,'products'))return json(res,user?403:401,{error:'Access denied.'});return json(res,200,{attributes:attributeMasterRows(),types:['Text','Number','Select','Multi-select','Color','Image','Boolean']})},
  async createProductAttribute(req,res){const user=currentUser(req);if(!canManageProductLibrary(user))return json(res,user?403:401,{error:'Administrator access required.'});const b=await readJson(req);if(!Array.isArray(b.category_ids)&&b.category_id)b.category_ids=[b.category_id];const row=db.prepare('INSERT INTO product_attribute_definitions(category_id,name,code,data_type,unit,active,sort_order,show_in_library,show_on_website,show_in_quote,show_in_pi,internal_only) VALUES(NULL,?,?,?,?,?,?,?,?,?,?,?) RETURNING *').get(requiredText(b.name,'Attribute name'),requiredText(b.code,'Attribute code'),String(b.data_type||'Text'),String(b.unit||'').trim()||null,b.active===false?0:1,Number(b.sort_order||0),b.show_in_library===false?0:1,b.show_on_website?1:0,b.show_in_quote?1:0,b.show_in_pi?1:0,b.internal_only?1:0);syncAttributeMaster(row.id,b);return json(res,201,{attribute:attributeMasterRows().find(attribute=>attribute.id===row.id)})},
  async updateProductAttribute(req,res,id){const user=currentUser(req);if(!canManageProductLibrary(user))return json(res,user?403:401,{error:'Administrator access required.'});const existing=db.prepare('SELECT * FROM product_attribute_definitions WHERE id=?').get(id);if(!existing)return json(res,404,{error:'Attribute not found.'});const b=await readJson(req);db.prepare('UPDATE product_attribute_definitions SET name=?,code=?,data_type=?,unit=?,active=?,sort_order=?,show_in_library=?,show_on_website=?,show_in_quote=?,show_in_pi=?,internal_only=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(requiredText(b.name??existing.name,'Attribute name'),requiredText(b.code??existing.code,'Attribute code'),String(b.data_type??existing.data_type),String(b.unit??existing.unit??'').trim()||null,b.active===undefined?existing.active:b.active?1:0,Number(b.sort_order??existing.sort_order),b.show_in_library===undefined?existing.show_in_library:b.show_in_library?1:0,b.show_on_website===undefined?existing.show_on_website:b.show_on_website?1:0,b.show_in_quote===undefined?existing.show_in_quote:b.show_in_quote?1:0,b.show_in_pi===undefined?existing.show_in_pi:b.show_in_pi?1:0,b.internal_only===undefined?existing.internal_only:b.internal_only?1:0,id);syncAttributeMaster(id,b);return json(res,200,{attribute:attributeMasterRows().find(attribute=>attribute.id===id)})},
  deleteProductAttribute(req,res,id){const user=currentUser(req);if(!['Admin','Owner'].includes(user?.role))return json(res,user?403:401,{error:'Administrator access required.'});const used=Number(db.prepare('SELECT COUNT(*) AS count FROM product_attribute_values WHERE attribute_id=?').get(id).count);if(used)return json(res,409,{error:'Remove attribute values before deleting this definition.'});const result=db.prepare('DELETE FROM product_attribute_definitions WHERE id=?').run(id);return result.changes?json(res,200,{deleted:true}):json(res,404,{error:'Attribute not found.'})},

  async updateProductFoundation(req,res,id){const user=currentUser(req);if(!['Admin','Owner','Designer'].includes(user?.role))return json(res,user?403:401,{error:'Product editing is not allowed.'});if(!db.prepare('SELECT id FROM products WHERE id=?').get(id))return json(res,404,{error:'Product not found.'});const b=await readJson(req);db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM product_attribute_values WHERE product_id=?').run(id);const insertValue=db.prepare('INSERT INTO product_attribute_values(product_id,variant_id,attribute_id,value) VALUES(?,?,?,?)');for(const value of b.attribute_values||[]){if(String(value.value||'').trim())insertValue.run(id,value.variant_id?Number(value.variant_id):null,Number(value.attribute_id),String(value.value).trim())}db.prepare('DELETE FROM product_foundation_relationships WHERE source_product_id=?').run(id);const insertRelationship=db.prepare('INSERT INTO product_foundation_relationships(source_product_id,target_product_id,relationship_type,sort_order) VALUES(?,?,?,?)');for(const [type,ids] of [['related',b.related_product_ids||[]],['frequently_bought_together',b.frequently_bought_together_ids||[]]])ids.forEach((target,index)=>{if(Number(target)!==id)insertRelationship.run(id,Number(target),type,index)});db.exec('COMMIT')}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error}return json(res,200,{foundation:productFoundation(id)})},

  deleteProduct(req,res,id){const user=currentUser(req);if(!['Admin','Owner'].includes(user?.role))return json(res,user?403:401,{error:'Administrator access required.'});const product=db.prepare('SELECT * FROM products WHERE id=?').get(id);if(!product)return json(res,404,{error:'Product not found.'});const historical=Number(db.prepare('SELECT COUNT(*) AS count FROM sales_quote_items WHERE product_id=?').get(id).count)+Number(db.prepare('SELECT COUNT(*) AS count FROM sales_order_items WHERE product_id=?').get(id).count);if(historical){db.prepare("UPDATE products SET library_status='Hidden',visibility='Hidden',status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);return json(res,200,{deleted:false,archived:true,message:'Product hidden to preserve historical Quote, PI, and Order records.'})}db.prepare('DELETE FROM products WHERE id=?').run(id);return json(res,200,{deleted:true,archived:false})},

  searchStrategies(req, res) {
    const user = currentUser(req);
    const strategies = searchStrategyService.list(user).map(item => safeStrategy(item, user));
    return json(res, 200, { strategies, statuses: searchStrategyService.statuses, capabilities: searchStrategyService.permissions(user) });
  },

  searchStrategyDetail(req, res, id) {
    const user = currentUser(req), strategy = searchStrategyService.get(user, id);
    const active = buildKnowledgeContext({ contextType: 'knowledge-center', user, options: {} });
    const storedHash = strategy.generation_metadata_json?.contextHash || null;
    return json(res, 200, { strategy: safeStrategy(strategy, user), context_outdated: Boolean(storedHash && storedHash !== active.contextHash), capabilities: searchStrategyService.permissions(user) });
  },

  async createSearchStrategy(req, res) {
    const user = currentUser(req), body = await readJson(req);
    return json(res, 201, { strategy: safeStrategy(searchStrategyService.create(user, body), user) });
  },

  async updateSearchStrategy(req, res, id) {
    const user = currentUser(req), body = await readJson(req);
    return json(res, 200, { strategy: safeStrategy(searchStrategyService.update(user, id, body), user) });
  },

  searchStrategyHistory(req, res, id) {
    const user = currentUser(req);
    return json(res, 200, { history: searchStrategyService.history(user, id).map(item => safeStrategy(item, user)) });
  },

  searchStrategyContextPreview(req, res, id) {
    const user = currentUser(req), strategy = searchStrategyService.get(user, id);
    const context = buildAiContext({ contextType: 'search-strategy', entityType: 'search_strategies', entityId: strategy.id, user, options: {} });
    return json(res, 200, { context: context.context, sourceReferences: context.sourceReferences, contextHash: context.contextHash || context.context.contextHash, warnings: context.context.warnings || [] });
  },

  async generateSearchStrategy(req, res, id) {
    const user = currentUser(req), strategy = searchStrategyService.get(user, id);
    if (!searchStrategyService.permissions(user).canGenerate || !searchStrategyService.canEdit(user, searchStrategyService.raw(id))) return json(res, 403, { error: 'AI generation is only allowed for an owned Draft.' });
    const body = await readJson(req);
    try {
      const result = await aiBusinessBrain.runAiAction({ moduleName: 'search-strategy', actionName: 'generate-draft', entityType: 'search_strategies', entityId: id, contextType: 'search-strategy', promptTemplateKey: 'v53.foundation.mock.v1', userId: user.id, user, options: { provider: body.provider || 'rules', productIds: Array.isArray(body.product_ids) ? body.product_ids : [], timeRangeDays: body.time_range_days || 365 } });
      if (result.status !== 'completed') return json(res, 409, { error: 'AI generation was blocked by Cost Control.', ai: result });
      const snapshot = db.prepare('SELECT * FROM ai_context_snapshots WHERE id = ?').get(result.contextSnapshotId);
      const snapshotContext = parseJsonValue(snapshot?.context_json, {}), sources = parseJsonValue(snapshot?.source_references, []);
      const data = strategyDataFromContext(strategy, snapshotContext); validateSearchStrategyData(data);
      const references = sources.map(source => ({ sourceType: source.table || source.module, sourceRecordId: source.id || source.product_id || null, revision: source.revision || null, updatedAt: source.updatedAt || null }));
      const generated = searchStrategyService.setGenerated(id, { data, knowledgeReferences: references, evidenceReferences: references.map(source => ({ ...source, supportedStrategyField: 'searchObjective', confidence: data.confidence })), generationMetadata: { provider: result.provider, model: result.model, promptVersion: `${result.prompt.key}:v${result.prompt.version}`, generatedAt: new Date().toISOString(), contextType: 'search-strategy', contextHash: snapshotContext.contextHash || snapshot?.context_hash, schemaVersion: 'workflow-1b-v1', warnings: data.warnings, redactionLevel: snapshot?.redaction_level }, aiCostEstimate: result.cost?.estimate?.estimated_cost_usd || 0, contextSnapshotId: result.contextSnapshotId, executionLogId: result.executionLogId, costLogId: result.cost?.executedCostLogId || result.cost?.estimate?.id });
      audit(user.id, 'ai_generate_search_strategy', 'search_strategies', String(id), { executionLogId: result.executionLogId, contextSnapshotId: result.contextSnapshotId, costStatus: 'executed' });
      return json(res, 200, { strategy: safeStrategy(generated, user), ai: { status: result.status, provider: result.provider, model: result.model, cost: result.cost } });
    } catch (error) { audit(user.id, 'ai_generate_search_strategy_failed', 'search_strategies', String(id), { error: String(error.message).slice(0, 200), executionLogId: error.executionLogId || null }); throw error; }
  },

  async estimateSearchStrategy(req, res, id) {
    const user = currentUser(req), strategy = searchStrategyService.get(user, id);
    if (!searchStrategyService.canEdit(user, searchStrategyService.raw(id))) return json(res, 403, { error: 'Only an owned Draft can be estimated.' });
    const estimate = searchPlanningEstimate(validateSearchStrategyData(strategy.strategy_data_json));
    const updated = searchStrategyService.setSearchEstimate(id, estimate);
    audit(user.id, 'estimate_search_strategy_execution', 'search_strategies', String(id), { estimateType: 'planning', expected: estimate.expected });
    return json(res, 200, { strategy: safeStrategy(updated, user), estimate });
  },

  async transitionSearchStrategy(req, res, id, action) {
    const user = currentUser(req), body = await readJson(req);
    if (['approve', 'request-changes', 'archive'].includes(action) && !searchStrategyService.permissions(user).canApprove) return json(res, user ? 403 : 401, { error: 'Only Admin or Owner can perform this Search Strategy action.' });
    return json(res, 200, { strategy: safeStrategy(searchStrategyService.transition(user, id, action, body.review_note), user) });
  },

  async createTaskFromStrategy(req, res, id) {
    const user = currentUser(req), strategy = searchStrategyService.get(user, id);
    if (!searchStrategyService.permissions(user).canCreateSearchTask) return json(res, 403, { error: 'Only Admin or Owner can create a Search Task from an Approved Strategy.' });
    if (strategy.status !== 'Approved') { audit(user.id, 'blocked_unapproved_strategy_task_creation', 'search_strategies', String(id), { status: strategy.status }); return json(res, 409, { error: 'Only the current Approved Strategy can create a Search Task.' }); }
    const body = await readJson(req);
    return handlers.createSearchTask(req, res, { ...body, search_strategy_id: id }, user);
  },

  customerDiscoveryConfig(req, res) {
    const user = currentUser(req);
    const capabilities = opportunityCapabilities(user);
    if (!capabilities.canView) return json(res, user ? 403 : 401, { error: 'Opportunity Intelligence access denied.' });
    return json(res, 200, {
      customerTypes: discoveryProfiles(),
      capabilities: { canAnalyze: capabilities.canRunCustomerIntelligence || capabilities.canImport || capabilities.canRunAi },
      aiPolicy: { externalProviderCalledOnLoad: false, provider: 'rules', costControlled: true }
    });
  },

  customerDiscoveryRequests(req, res) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Opportunity Intelligence access denied.' });
    const rows = db.prepare(`SELECT customer_discovery_requests.*, users.name AS created_by_name
      FROM customer_discovery_requests LEFT JOIN users ON users.id = customer_discovery_requests.created_by
      ORDER BY customer_discovery_requests.created_at DESC, customer_discovery_requests.id DESC LIMIT 50`).all()
      .map(row => ({ ...row, search_plan: parseJsonValue(row.search_plan), guidance: parseJsonValue(row.guidance), scoring_profile: parseJsonValue(row.scoring_profile) }));
    return json(res, 200, { requests: rows });
  },

  async analyzeCustomerDiscovery(req, res, actionName = 'analyze-requirement') {
    const user = currentUser(req);
    const capabilities = opportunityCapabilities(user);
    if (!(capabilities.canRunCustomerIntelligence || capabilities.canImport || capabilities.canRunAi)) return json(res, user ? 403 : 401, { error: 'Customer discovery analysis is not allowed for this role.' });
    const body = await readJson(req);
    const rawRequest = requiredText(body.request_text || body.prompt, 'Discovery request');
    const { plan, guidance, scoringProfile } = buildDiscoveryPlan(rawRequest);
    const row = db.prepare(`INSERT INTO customer_discovery_requests
      (raw_request, status, target_customer_type, industry, region, country, search_plan, guidance, scoring_profile, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(
      rawRequest,
      guidance.needs_more_information ? 'needs_more_information' : 'planned',
      plan.target_customer_type,
      plan.industry,
      plan.region_city === 'Needs Clarification' ? null : plan.region_city,
      plan.country === 'Needs Clarification' ? null : plan.country,
      JSON.stringify(plan),
      JSON.stringify(guidance),
      JSON.stringify(scoringProfile || {}),
      user.id
    );
    const aiResult = await aiBusinessBrain.runAiAction({
      moduleName: 'customer-discovery',
      actionName,
      entityType: 'customer_discovery_request',
      entityId: row.id,
      contextType: 'customer-discovery',
      promptTemplateKey: 'v53.foundation.mock.v1',
      userId: user.id,
      user,
      options: { provider: 'rules' }
    });
    db.prepare(`UPDATE customer_discovery_requests SET ai_execution_log_id = ?, cost_log_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(aiResult.executionLogId, aiResult.cost?.executedCostLogId || aiResult.cost?.estimate?.id || null, row.id);
    audit(user.id, actionName, 'customer_discovery_requests', String(row.id), { targetCustomerType: plan.target_customer_type, confidence: plan.confidence_score });
    return json(res, 201, {
      request: db.prepare('SELECT * FROM customer_discovery_requests WHERE id = ?').get(row.id),
      plan,
      guidance,
      action_name: actionName,
      generated_search_plan: buildGeneratedSearchPlan(plan, guidance),
      scoring_profile: scoringProfile,
      downstream: ['Lead Pool', 'Lead Detail', 'Convert to Customer', 'Customers CRM', 'Sales Pipeline'],
      ai: { status: aiResult.status, provider: aiResult.provider, executionLogId: aiResult.executionLogId, cost: aiResult.cost }
    });
  },

  searchTasks(req, res) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Opportunity Intelligence access denied.' });
    const rows = db.prepare(`SELECT search_tasks.*, users.name AS created_by_name
      FROM search_tasks LEFT JOIN users ON users.id = search_tasks.created_by
      ORDER BY search_tasks.created_at DESC, search_tasks.id DESC LIMIT 200`).all().map(normalizeSearchTask);
    return json(res, 200, { tasks: rows, statuses: searchTaskStatuses });
  },

  searchTaskDetail(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Opportunity Intelligence access denied.' });
    const task = normalizeSearchTask(db.prepare(`SELECT search_tasks.*, users.name AS created_by_name
      FROM search_tasks LEFT JOIN users ON users.id = search_tasks.created_by WHERE search_tasks.id = ?`).get(id));
    if (!task) return json(res, 404, { error: 'Search task not found.' });
    const results = searchResultsForTask(id);
    return json(res, 200, { task: { ...task, search_results: results, search_result_summary: searchResultSummary(results) }, statuses: searchTaskStatuses, searchResultStatuses });
  },

  async createSearchTask(req, res, bodyOverride = null, userOverride = null) {
    const user = userOverride || currentUser(req);
    const capabilities = opportunityCapabilities(user);
    if (!(capabilities.canRunCustomerIntelligence || capabilities.canImport || capabilities.canRunAi)) return json(res, user ? 403 : 401, { error: 'Search task creation is not allowed for this role.' });
    const body = bodyOverride || await readJson(req);
    const strategyId = Number(body.search_strategy_id);
    const strategy = strategyId ? db.prepare("SELECT * FROM search_strategies WHERE id = ? AND status = 'Approved'").get(strategyId) : null;
    if (!strategy) { audit(user.id, 'blocked_unapproved_strategy_task_creation', 'search_tasks', null, { strategyId: strategyId || null }); return json(res, 409, { error: 'An Approved Search Strategy is required to create a Search Task.' }); }
    if (!searchStrategyService.permissions(user).canCreateSearchTask) return json(res, 403, { error: 'Only Admin or Owner can create a Search Task.' });
    if (strategy.linked_search_task_id) return json(res, 409, { error: 'This Approved Strategy is already linked to a Search Task.' });
    const discoveryId = Number(strategy.customer_discovery_request_id) || null;
    const request = discoveryId ? db.prepare('SELECT * FROM customer_discovery_requests WHERE id = ?').get(discoveryId) : null;
    const plan = parseJsonValue(request?.search_plan, {}), guidance = parseJsonValue(request?.guidance, {}), data = parseJsonValue(strategy.strategy_data_json, {});
    const generated = { target_customer: data.targetCustomerProfile?.customerTypes?.join(', '), customer_type: data.targetCustomerProfile?.customerTypes?.[0], industry: 'Hospitality Furniture', location: [...(data.targetMarket?.cities || []), ...(data.targetMarket?.countries || [])].join(', '), company_size_detail: data.targetCustomerProfile?.companySize?.description || '', search_objective: data.searchObjective, search_keywords: data.searchKeywords, recommended_filters: data.exclusionRules, recommended_search_volume: data.resultTarget?.expectedCount, priority: 'Medium', required_data_fields: ['Company Name', 'Website', 'Country', 'City', 'Source URL'] };
    const targetQuantity = Number(String(generated.recommended_search_volume || '').match(/\d+/)?.[0] || body.target_quantity || 0);
    db.exec('BEGIN');
    try {
    const row = db.prepare(`INSERT INTO search_tasks
      (customer_discovery_request_id, task_name, target_customer, customer_type, industry, location, company_size,
       search_objective, keywords, filters, target_quantity, priority, required_data_fields, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?) RETURNING id`).get(
      discoveryId,
      body.task_name || nextSearchTaskName(),
      generated.target_customer || plan.target_customer_type || null,
      generated.customer_type || plan.target_customer_type || null,
      generated.industry || plan.industry || 'Hospitality Furniture',
      generated.location || [plan.region_city, plan.country].filter(Boolean).join(', ') || null,
      generated.company_size_detail || generated.company_size || plan.company_size_detail || plan.company_size || null,
      generated.search_objective || null,
      JSON.stringify(generated.search_keywords || plan.recommended_keywords || []),
      JSON.stringify(generated.recommended_filters || []),
      targetQuantity,
      generated.priority || 'Medium',
      JSON.stringify(generated.required_data_fields || generated.recommended_data_fields || []),
      user.id
    );
    db.prepare('UPDATE search_strategies SET linked_search_task_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id, strategy.id);
    const task = normalizeSearchTask(db.prepare('SELECT * FROM search_tasks WHERE id = ?').get(row.id));
    audit(user.id, 'create_search_task', 'search_tasks', String(row.id), { discoveryId, strategyId, targetQuantity, priority: task.priority });
    db.exec('COMMIT'); return json(res, 201, { task, search_strategy_id: strategy.id });
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  },

  updateSearchTaskStatus(req, res, id, action) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canRunCustomerIntelligence && !opportunityCapabilities(user).canRunAi) return json(res, user ? 403 : 401, { error: 'Search task status update is not allowed for this role.' });
    const task = db.prepare('SELECT * FROM search_tasks WHERE id = ?').get(id);
    if (!task) return json(res, 404, { error: 'Search task not found.' });
    if (action !== 'ready') return json(res, 400, { error: 'Only Draft to Ready is supported in this MVP.' });
    if (task.status !== 'Draft') return json(res, 409, { error: 'Only Draft tasks can be marked Ready.' });
    const strategy = db.prepare("SELECT * FROM search_strategies WHERE linked_search_task_id = ? AND status = 'Approved'").get(id);
    if (!strategy) { audit(user.id, 'blocked_search_task_ready_without_approved_strategy', 'search_tasks', String(id)); return json(res, 409, { error: 'Search Task requires a currently Approved Search Strategy before it can be marked Ready.' }); }
    db.prepare("UPDATE search_tasks SET status = 'Ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    audit(user.id, 'mark_search_task_ready', 'search_tasks', String(id));
    const updatedTask = normalizeSearchTask(db.prepare('SELECT * FROM search_tasks WHERE id = ?').get(id));
    const results = searchResultsForTask(id);
    return json(res, 200, { task: { ...updatedTask, search_results: results, search_result_summary: searchResultSummary(results) } });
  },

  searchTaskResults(req, res, taskId) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Opportunity Intelligence access denied.' });
    const task = normalizeSearchTask(db.prepare('SELECT * FROM search_tasks WHERE id = ?').get(taskId));
    if (!task) return json(res, 404, { error: 'Search task not found.' });
    const results = searchResultsForTask(taskId);
    return json(res, 200, { task, summary: searchResultSummary(results), results, statuses: searchResultStatuses });
  },

  async createSearchResult(req, res, taskId) {
    const user = currentUser(req);
    const capabilities = opportunityCapabilities(user);
    if (!(capabilities.canRunCustomerIntelligence || capabilities.canImport || capabilities.canRunAi)) return json(res, user ? 403 : 401, { error: 'Search result creation is not allowed for this role.' });
    const task = normalizeSearchTask(db.prepare('SELECT * FROM search_tasks WHERE id = ?').get(taskId));
    if (!task) return json(res, 404, { error: 'Search task not found.' });
    try {
      const body = await readJson(req);
      const values = searchResultFieldValues(body, {}, task);
      const aiResult = await aiBusinessBrain.runAiAction({
        moduleName: 'opportunity-intelligence',
        actionName: 'search-result-qualification',
        entityType: 'search_task',
        entityId: task.customer_discovery_request_id || taskId,
        contextType: 'customer-discovery',
        promptTemplateKey: 'v53.foundation.mock.v1',
        userId: user.id,
        user,
        options: { provider: 'rules' }
      });
      const row = db.prepare(`INSERT INTO search_results
        (search_task_id, company_name, customer_type, industry, country, city, website, contact_person, email, phone,
         linkedin, instagram, company_size, business_type, purchase_potential, opportunity_score, qualification_reason,
         opportunity_summary, why_customer_matters, recommended_next_action, source_type, source_reference, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?) RETURNING id`).get(
        taskId, values.company_name, values.customer_type, values.industry, values.country, values.city, values.website,
        values.contact_person, values.email, values.phone, values.linkedin, values.instagram, values.company_size,
        values.business_type, values.purchase_potential, values.opportunity_score, values.qualification_reason,
        values.opportunity_summary, values.why_customer_matters, values.recommended_next_action, values.source_type,
        values.source_reference, user.id
      );
      audit(user.id, 'create_search_result', 'search_results', String(row.id), { taskId, aiExecutionLogId: aiResult.executionLogId });
      return json(res, 201, { result: searchResultDetail(row.id), ai: { provider: aiResult.provider, executionLogId: aiResult.executionLogId, cost: aiResult.cost } });
    } catch (error) {
      return json(res, error.status || 400, { error: error.message });
    }
  },

  searchResultDetail(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Opportunity Intelligence access denied.' });
    const result = searchResultDetail(id);
    return result ? json(res, 200, { result, statuses: searchResultStatuses }) : json(res, 404, { error: 'Search result not found.' });
  },

  async updateSearchResult(req, res, id) {
    const user = currentUser(req);
    const capabilities = opportunityCapabilities(user);
    if (!(capabilities.canRunCustomerIntelligence || capabilities.canImport || capabilities.canRunAi)) return json(res, user ? 403 : 401, { error: 'Search result editing is not allowed for this role.' });
    const existing = searchResultDetail(id);
    if (!existing) return json(res, 404, { error: 'Search result not found.' });
    if (existing.status === 'converted') return json(res, 409, { error: 'Converted search results cannot be edited.' });
    try {
      const body = await readJson(req);
      const task = normalizeSearchTask(db.prepare('SELECT * FROM search_tasks WHERE id = ?').get(existing.search_task_id));
      const values = searchResultFieldValues(body, existing, task);
      const status = body.status && searchResultStatuses.includes(body.status) ? body.status : existing.status;
      const aiResult = await aiBusinessBrain.runAiAction({
        moduleName: 'opportunity-intelligence',
        actionName: 'search-result-qualification',
        entityType: 'search_result',
        entityId: task.customer_discovery_request_id || existing.search_task_id,
        contextType: 'customer-discovery',
        promptTemplateKey: 'v53.foundation.mock.v1',
        userId: user.id,
        user,
        options: { provider: 'rules' }
      });
      db.prepare(`UPDATE search_results SET company_name = ?, customer_type = ?, industry = ?, country = ?, city = ?,
        website = ?, contact_person = ?, email = ?, phone = ?, linkedin = ?, instagram = ?, company_size = ?,
        business_type = ?, purchase_potential = ?, opportunity_score = ?, qualification_reason = ?,
        opportunity_summary = ?, why_customer_matters = ?, recommended_next_action = ?, source_type = ?,
        source_reference = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        values.company_name, values.customer_type, values.industry, values.country, values.city, values.website,
        values.contact_person, values.email, values.phone, values.linkedin, values.instagram, values.company_size,
        values.business_type, values.purchase_potential, values.opportunity_score, values.qualification_reason,
        values.opportunity_summary, values.why_customer_matters, values.recommended_next_action, values.source_type,
        values.source_reference, status, id
      );
      audit(user.id, 'update_search_result', 'search_results', String(id), { aiExecutionLogId: aiResult.executionLogId });
      return json(res, 200, { result: searchResultDetail(id), ai: { provider: aiResult.provider, executionLogId: aiResult.executionLogId, cost: aiResult.cost } });
    } catch (error) {
      return json(res, error.status || 400, { error: error.message });
    }
  },

  convertSearchResult(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canRunCustomerIntelligence && !opportunityCapabilities(user).canImport) return json(res, user ? 403 : 401, { error: 'Search result conversion is not allowed for this role.' });
    const result = searchResultDetail(id);
    if (!result) return json(res, 404, { error: 'Search result not found.' });
    if (result.status === 'converted') return json(res, 409, { error: 'Search result already converted.' });
    const website = String(result.website || '').trim();
    const duplicate = website
      ? db.prepare('SELECT * FROM customers WHERE LOWER(COALESCE(website, \'\')) = LOWER(?) LIMIT 1').get(website)
      : db.prepare('SELECT * FROM customers WHERE LOWER(company_name) = LOWER(?) AND LOWER(COALESCE(country, \'\')) = LOWER(COALESCE(?, \'\')) LIMIT 1').get(result.company_name, result.country);
    if (duplicate) return json(res, 409, { error: 'Possible existing customer found.', duplicate: mappedCustomer(duplicate) });
    const created = createCustomerRecord({
      company_name: result.company_name,
      business_type: result.business_type || result.customer_type,
      customer_type: result.customer_type,
      industry: result.industry,
      country: result.country,
      city: result.city,
      website: result.website,
      email: result.email,
      phone: result.phone,
      source: 'Manual',
      customer_source: 'Search Result',
      source_url: result.source_url || result.website,
      source_confidence: 70,
      confidence_score: result.opportunity_score,
      opportunity_notes: result.qualification_reason
    }, 'Manual', user);
    db.prepare(`UPDATE customers SET customer_source = 'Search Result', customer_type = ?, industry = ?, opportunity_notes = ?, ai_summary = ?,
      ai_recommendation = ?, opportunity_score = ?, recommended_product_reason = ?, opportunity_status = 'Imported', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      result.customer_type || null, result.industry || 'Hospitality Furniture', result.qualification_reason || null,
      result.opportunity_summary || null, result.recommended_next_action || null, Number(result.opportunity_score || 0),
      recommendedProductReasonFor(result.customer_type, result.business_type), created.id
    );
    if (result.contact_person || result.email || result.phone || result.linkedin || result.instagram) {
      db.prepare(`INSERT INTO customer_contacts
        (customer_id, full_name, role, email, phone, linkedin_url, instagram_url, source, source_url, confidence_score, is_primary_decision_maker, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Manual', ?, ?, ?, ?, ?)`).run(
        created.id, result.contact_person || 'Unknown Contact', 'Other', result.email, result.phone, result.linkedin,
        result.instagram, result.source_url || null, 70, result.contact_person ? 1 : 0, 'Created from Search Result conversion.', user.id
      );
    }
    db.prepare("UPDATE search_results SET customer_id = ?, status = 'converted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(created.id, id);
    customerActivity(created.id, 'converted from search result', `Converted from Search Result #${id}.`, user.id, { searchResultId: id, searchTaskId: result.search_task_id });
    audit(user.id, 'convert_search_result', 'search_results', String(id), { customerId: created.id });
    return json(res, 200, { result: searchResultDetail(id), customer: customerDetailData(created.id) });
  },

  discardSearchResult(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canRunCustomerIntelligence && !opportunityCapabilities(user).canImport) return json(res, user ? 403 : 401, { error: 'Search result discard is not allowed for this role.' });
    const result = searchResultDetail(id);
    if (!result) return json(res, 404, { error: 'Search result not found.' });
    if (result.status === 'converted') return json(res, 409, { error: 'Converted search results cannot be discarded.' });
    db.prepare("UPDATE search_results SET status = 'discarded', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    audit(user.id, 'discard_search_result', 'search_results', String(id));
    return json(res, 200, { result: searchResultDetail(id) });
  },

  opportunityDashboard(req, res) {
    const user = currentUser(req);
    const capabilities = opportunityCapabilities(user);
    if (!capabilities.canView) return json(res, user ? 403 : 401, { error: 'Opportunity Intelligence access denied.' });
    return json(res, 200, { metrics: opportunityMetrics(), debug: opportunityDebugData(), capabilities });
  },

  customers(req, res, url) {
    const user = currentUser(req);
    const capabilities = opportunityCapabilities(user);
    if (!capabilities.canView) return json(res, user ? 403 : 401, { error: 'Opportunity Intelligence access denied.' });
    const where = ['1 = 1'];
    const params = [];
    const q = String(url.searchParams.get('q') || '').trim();
    if (q) { where.push('(customers.company_name LIKE ? COLLATE NOCASE OR customers.brand_name LIKE ? COLLATE NOCASE OR customers.city LIKE ? COLLATE NOCASE OR customers.country LIKE ? COLLATE NOCASE)'); params.push(...Array(4).fill(`%${q}%`)); }
    for (const [parameter, column] of [['grade', 'opportunity_grade'], ['status', 'opportunity_status'], ['source', 'source'], ['customer_source', 'customer_source'], ['customer_type', 'customer_type']]) {
      const value = String(url.searchParams.get(parameter) || '').trim();
      if (value) { where.push(`customers.${column} = ?`); params.push(value); }
    }
    const rows = db.prepare(`SELECT customers.*, users.name AS assigned_sales_name,
      (SELECT COUNT(*) FROM customer_contacts cc WHERE cc.customer_id = customers.id AND cc.is_primary_decision_maker = TRUE) AS decision_maker_count,
      (SELECT COUNT(*) FROM customer_data_gaps cg WHERE cg.customer_id = customers.id AND cg.status = 'Open') AS open_gap_count
      FROM customers LEFT JOIN users ON users.id = customers.assigned_sales_id WHERE ${where.join(' AND ')}
      ORDER BY customers.sales_priority_score DESC, customers.opportunity_score DESC, customers.updated_at DESC LIMIT 1000`).all(...params).map(row => ({ ...mappedCustomer(row), recommended_categories: customerRecommendationNames(row.id).join(', ') }));
    return json(res, 200, { customers: rows, capabilities, sources: customerSources, contactRoles, statuses: opportunityStatuses, metrics: opportunityMetrics() });
  },

  async createCustomer(req, res) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canImport) return json(res, user ? 403 : 401, { error: 'Customer import is not allowed for this role.' });
    const body = await readJson(req);
    const result = createCustomerRecord(body, body.source || 'Manual', user);
    return json(res, result.duplicate ? 200 : 201, { customer: customerDetailData(result.id), duplicate: result.duplicate });
  },

  customerDetail(req, res, id) {
    const user = currentUser(req);
    const capabilities = opportunityCapabilities(user);
    if (!capabilities.canView) return json(res, user ? 403 : 401, { error: 'Opportunity Intelligence access denied.' });
    const customer = customerDetailData(id);
    return customer ? json(res, 200, { customer, capabilities, sources: customerSources, contactRoles, statuses: opportunityStatuses }) : json(res, 404, { error: 'Customer not found.' });
  },

  async updateCustomer(req, res, id) {
    const user = currentUser(req);
    const capabilities = opportunityCapabilities(user);
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existing) return json(res, 404, { error: 'Customer not found.' });
    const body = await readJson(req);
    if (!capabilities.canEditBasic && user?.role !== 'Sales') return json(res, user ? 403 : 401, { error: 'Customer editing is not allowed for this role.' });
    if (user.role === 'Sales') {
      const status = allowedType(body.opportunity_status ?? existing.opportunity_status, opportunityStatuses, 'Opportunity status');
      db.prepare('UPDATE customers SET opportunity_status = ?, next_action = ?, next_action_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, String(body.next_action ?? existing.next_action ?? '').trim() || null, String(body.next_action_date ?? existing.next_action_date ?? '').trim() || null, id);
      customerActivity(id, 'status changed', `Sales changed status to ${status}.`, user.id);
    } else {
      const normalized = normalizeCustomer({ ...existing, ...body });
      const source = allowedType(body.source ?? existing.source, customerSources, 'Source');
      db.prepare(`UPDATE customers SET company_name = ?, brand_name = ?, business_type = ?, country = ?, city = ?, address = ?, website = ?,
        google_maps_url = ?, facebook_url = ?, instagram_url = ?, linkedin_url = ?, tiktok_url = ?, phone = ?, email = ?, whatsapp = ?,
        store_count = ?, opening_year = ?, years_in_business = ?, source = ?, source_url = ?, source_confidence = ?,
        expansion_probability = ?, renovation_probability = ?, furniture_need_probability = ?, budget_estimate = ?, style_signal = ?,
        assigned_sales_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
        requiredText(normalized.company_name, 'Company name'), normalized.brand_name, normalized.business_type, normalized.country, normalized.city,
        String(normalized.address || '').trim() || null, normalized.website, normalized.google_maps_url, normalized.facebook_url, normalized.instagram_url,
        normalized.linkedin_url, normalized.tiktok_url, normalized.phone, normalized.email, normalized.whatsapp, normalized.store_count,
        normalized.opening_year, normalized.years_in_business, source, String(normalized.source_url || '').trim() || null,
        Math.min(100, Math.max(0, Number(normalized.source_confidence) || 50)), normalized.expansion_probability,
        normalized.renovation_probability, normalized.furniture_need_probability, String(normalized.budget_estimate || '').trim() || null,
        String(normalized.style_signal || '').trim() || null, ['Admin', 'Owner'].includes(user.role) ? (Number(normalized.assigned_sales_id) || null) : existing.assigned_sales_id, id
      );
      if (['Admin', 'Owner'].includes(user.role)) {
        const status = allowedType(body.opportunity_status ?? existing.opportunity_status, opportunityStatuses, 'Opportunity status');
        db.prepare(`UPDATE customers SET opportunity_status = ?, ai_summary = ?, ai_recommendation = ?, next_action = ?,
          next_action_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(status,
          String(body.ai_summary ?? existing.ai_summary ?? '').trim() || null,
          String(body.ai_recommendation ?? existing.ai_recommendation ?? '').trim() || null,
          String(body.next_action ?? existing.next_action ?? '').trim() || null,
          String(body.next_action_date ?? existing.next_action_date ?? '').trim() || null, id);
      }
      customerActivity(id, 'manual update', 'Customer basic information updated.', user.id);
    }
    audit(user.id, 'update', 'customers', String(id), { role: user.role });
    return json(res, 200, { customer: customerDetailData(id) });
  },

  async importCustomers(req, res) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canImport) return json(res, user ? 403 : 401, { error: 'Customer import is not allowed for this role.' });
    const body = await readJson(req);
    const source = allowedType(body.source || (body.csv ? 'CSV' : 'Manual'), customerSources, 'Source');
    const inputs = parseImportPayload(body);
    if (!inputs.length) return json(res, 400, { error: 'No customer rows were provided.' });
    const results = inputs.slice(0, 500).map(input => createCustomerRecord({ ...input, source }, source, user));
    return json(res, 201, { imported: results.filter(item => !item.duplicate).length, duplicates: results.filter(item => item.duplicate).length, customerIds: results.map(item => item.id) });
  },

  async runCustomerAi(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canRunAi) return json(res, user ? 403 : 401, { error: 'Running Opportunity AI is not allowed for this role.' });
    const body = await readJson(req);
    const current = db.prepare('SELECT updated_at FROM customers WHERE id = ?').get(id);
    if (!current) return json(res, 404, { error: 'Customer not found.' });
    const costInput = aiCostInput({ moduleName: 'opportunity-intelligence', actionName: 'run-ai', entityType: 'customer',
      entityId: id, provider: 'rules', estimatedCost: 0, user, fingerprint: String(id) });
    const cached = body.regenerate === true ? null : aiCostControl.cacheGet(costInput);
    if (cached) return json(res, 200, { customer: customerDetailData(id), cached: true });
    prepareAiCostRun(costInput, body);
    const customer = runOpportunityEngine(id, user);
    aiCostControl.cacheSet(costInput, { customerId: id });
    return json(res, 200, { customer });
  },

  async runCustomerIntelligence(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canRunCustomerIntelligence) return json(res, user ? 403 : 401, { error: 'Customer Intelligence run is not allowed for this role.' });
    const body = await readJson(req);
    const result = await runCustomerIntelligenceEngine(id, user, body);
    audit(user.id, 'run_customer_intelligence', 'customers', String(id), { profileId: result.profile.id });
    return json(res, 200, result);
  },

  async saveCustomerIntelligenceFeedback(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canSubmitFeedback) return json(res, user ? 403 : 401, { error: 'Customer intelligence feedback is not allowed for this role.' });
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(id)) return json(res, 404, { error: 'Customer not found.' });
    const body = await readJson(req);
    const feedbackType = allowedType(body.feedback_type, customerIntelligenceFeedbackTypes, 'Feedback type');
    const feedbackId = Number(db.prepare(`INSERT INTO customer_intelligence_feedback
      (customer_id, feedback_type, feedback_note, sales_result_reference_type, sales_result_reference_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING id`).get(
      id, feedbackType, String(body.feedback_note || '').trim() || null,
      String(body.sales_result_reference_type || '').trim() || null, Number(body.sales_result_reference_id) || null, user.id
    ).id);
    customerActivity(id, 'customer intelligence feedback', `Sales feedback: ${feedbackType}.`, user.id, { feedbackId });
    return json(res, 201, { feedback: db.prepare('SELECT * FROM customer_intelligence_feedback WHERE id = ?').get(feedbackId), customer: customerDetailData(id) });
  },

  async saveCustomerIntelligenceUpdate(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canRunCustomerIntelligence) return json(res, user ? 403 : 401, { error: 'Customer Intelligence update is not allowed for this role.' });
    try {
      const body = await readJson(req);
      const result = await saveCustomerIntelligenceUpdate(id, user, body);
      return json(res, 201, result);
    } catch (error) {
      return json(res, error.status || 400, { error: error.message });
    }
  },

  customerIntelligencePriority(req, res) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const rows = db.prepare(`SELECT customers.*, users.name AS assigned_sales_name,
      (SELECT full_name FROM customer_contacts cc WHERE cc.customer_id = customers.id AND cc.is_primary_decision_maker = TRUE ORDER BY cc.id LIMIT 1) AS decision_maker
      FROM customers LEFT JOIN users ON users.id = customers.assigned_sales_id
      WHERE customers.sales_priority_score > 0
      ORDER BY customers.sales_priority_score DESC, customers.customer_value_score DESC, customers.buying_opportunity_score DESC, customers.updated_at DESC
      LIMIT 200`).all().map(row => ({ ...mappedCustomer(row), recommended_products: customerRecommendationNames(row.id).join(', ') }));
    return json(res, 200, { customers: rows });
  },

  async runSelectedCustomerAi(req, res) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canRunAi) return json(res, user ? 403 : 401, { error: 'Running Opportunity AI is not allowed for this role.' });
    const body = await readJson(req);
    const ids = normalizedIds(body.customer_ids).slice(0, 50);
    if (!ids.length) return json(res, 400, { error: 'Select at least one customer.' });
    const costInput = aiCostInput({ moduleName: 'opportunity-intelligence', actionName: 'run-ai-selected', entityType: 'customer-batch',
      entityId: ids.join(','), provider: 'rules', estimatedCost: ids.length * 0.001, user, fingerprint: ids.join(',') });
    prepareAiCostRun(costInput, body, { requireConfirmation: true });
    const results = ids.map(id => runOpportunityEngine(id, user));
    recordAiExecution(costInput, 'rules', 0);
    return json(res, 200, { customers: results });
  },

  customerContacts(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    return json(res, 200, { contacts: db.prepare('SELECT * FROM customer_contacts WHERE customer_id = ? ORDER BY is_primary_decision_maker DESC, created_at').all(id) });
  },

  async createCustomerContact(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canEditBasic) return json(res, user ? 403 : 401, { error: 'Contact editing is not allowed for this role.' });
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(id)) return json(res, 404, { error: 'Customer not found.' });
    const body = await readJson(req);
    const role = allowedType(body.role || 'Other', contactRoles, 'Contact role');
    const contactId = Number(db.prepare(`INSERT INTO customer_contacts
      (customer_id, full_name, role, email, phone, whatsapp, linkedin_url, facebook_url, instagram_url, source, source_url,
       confidence_score, is_primary_decision_maker, notes, created_by) VALUES (${Array(15).fill('?').join(', ')}) RETURNING id`).get(
      id, requiredText(body.full_name, 'Full name'), role, String(body.email || '').trim().toLowerCase() || null,
      String(body.phone || '').trim() || null, String(body.whatsapp || '').trim() || null, String(body.linkedin_url || '').trim() || null,
      String(body.facebook_url || '').trim() || null, String(body.instagram_url || '').trim() || null,
      allowedType(body.source || 'Manual', customerSources, 'Source'), String(body.source_url || '').trim() || null,
      Math.min(100, Math.max(0, Number(body.confidence_score) || 50)), activeValue(body.is_primary_decision_maker, 0),
      String(body.notes || '').trim() || null, user.id
    ).id);
    customerActivity(id, 'manual update', `Contact ${body.full_name} added.`, user.id, { contactId });
    return json(res, 201, { contact: db.prepare('SELECT * FROM customer_contacts WHERE id = ?').get(contactId) });
  },

  async updateCustomerContact(req, res, id, contactId) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canEditBasic) return json(res, user ? 403 : 401, { error: 'Contact editing is not allowed for this role.' });
    const existing = db.prepare('SELECT * FROM customer_contacts WHERE id = ? AND customer_id = ?').get(contactId, id);
    if (!existing) return json(res, 404, { error: 'Contact not found.' });
    const body = await readJson(req);
    db.prepare(`UPDATE customer_contacts SET full_name = ?, role = ?, email = ?, phone = ?, whatsapp = ?, linkedin_url = ?,
      confidence_score = ?, is_primary_decision_maker = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      requiredText(body.full_name ?? existing.full_name, 'Full name'), allowedType(body.role ?? existing.role, contactRoles, 'Contact role'),
      String(body.email ?? existing.email ?? '').trim().toLowerCase() || null, String(body.phone ?? existing.phone ?? '').trim() || null,
      String(body.whatsapp ?? existing.whatsapp ?? '').trim() || null, String(body.linkedin_url ?? existing.linkedin_url ?? '').trim() || null,
      Math.min(100, Math.max(0, Number(body.confidence_score ?? existing.confidence_score) || 50)),
      activeValue(body.is_primary_decision_maker, existing.is_primary_decision_maker), String(body.notes ?? existing.notes ?? '').trim() || null, contactId
    );
    customerActivity(id, 'manual update', `Contact ${contactId} updated.`, user.id);
    return json(res, 200, { contact: db.prepare('SELECT * FROM customer_contacts WHERE id = ?').get(contactId) });
  },

  customerGaps(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    return json(res, 200, { gaps: db.prepare('SELECT * FROM customer_data_gaps WHERE customer_id = ? ORDER BY priority, created_at').all(id) });
  },

  async updateCustomerGap(req, res, id, gapId) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canEditBasic) return json(res, user ? 403 : 401, { error: 'Data gap editing is not allowed for this role.' });
    const existing = db.prepare('SELECT * FROM customer_data_gaps WHERE id = ? AND customer_id = ?').get(gapId, id);
    if (!existing) return json(res, 404, { error: 'Data gap not found.' });
    const body = await readJson(req);
    const status = allowedType(body.status ?? existing.status, ['Open', 'Filled', 'Ignored'], 'Gap status');
    db.prepare('UPDATE customer_data_gaps SET status = ?, notes = ?, assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, String(body.notes ?? existing.notes ?? '').trim() || null, Number(body.assigned_to ?? existing.assigned_to) || null, gapId);
    customerActivity(id, 'manual update', `${existing.gap_type} marked ${status}.`, user.id);
    return json(res, 200, { gap: db.prepare('SELECT * FROM customer_data_gaps WHERE id = ?').get(gapId) });
  },

  customerOutreachDrafts(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    return json(res, 200, { drafts: customerDetailData(id)?.outreach_drafts || [] });
  },

  async createCustomerOutreachDraft(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canEditDraft) return json(res, user ? 403 : 401, { error: 'Outreach draft editing is not allowed for this role.' });
    const body = await readJson(req);
    const draftId = Number(db.prepare(`INSERT INTO customer_outreach_drafts
      (customer_id, contact_id, channel, draft_type, subject, body, language, personalization_summary, recommended_products_snapshot, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?) RETURNING id`).get(id, Number(body.contact_id) || null,
      allowedType(body.channel || 'Email', outreachChannels, 'Channel'), allowedType(body.draft_type || 'First Touch', outreachTypes, 'Draft type'),
      String(body.subject || '').trim() || null, requiredText(body.body, 'Body'), String(body.language || 'English').trim(),
      String(body.personalization_summary || '').trim() || null, JSON.stringify(body.recommended_products_snapshot || []), user.id).id);
    customerActivity(id, 'draft generated', 'Manual outreach draft created.', user.id, { draftId });
    return json(res, 201, { draft: db.prepare('SELECT * FROM customer_outreach_drafts WHERE id = ?').get(draftId) });
  },

  async updateCustomerOutreachDraft(req, res, id, draftId) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canEditDraft) return json(res, user ? 403 : 401, { error: 'Outreach draft editing is not allowed for this role.' });
    const existing = db.prepare('SELECT * FROM customer_outreach_drafts WHERE id = ? AND customer_id = ?').get(draftId, id);
    if (!existing) return json(res, 404, { error: 'Outreach draft not found.' });
    const body = await readJson(req);
    db.prepare(`UPDATE customer_outreach_drafts SET channel = ?, draft_type = ?, subject = ?, body = ?, language = ?,
      personalization_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      allowedType(body.channel ?? existing.channel, outreachChannels, 'Channel'), allowedType(body.draft_type ?? existing.draft_type, outreachTypes, 'Draft type'),
      String(body.subject ?? existing.subject ?? '').trim() || null, requiredText(body.body ?? existing.body, 'Body'),
      String(body.language ?? existing.language ?? 'English').trim(), String(body.personalization_summary ?? existing.personalization_summary ?? '').trim() || null, draftId
    );
    customerActivity(id, 'manual update', `Outreach draft ${draftId} edited.`, user.id);
    return json(res, 200, { draft: db.prepare('SELECT * FROM customer_outreach_drafts WHERE id = ?').get(draftId) });
  },

  async updateOutreachStatus(req, res, id, draftId, action) {
    const user = currentUser(req);
    const capabilities = opportunityCapabilities(user);
    if (action === 'approve' && !capabilities.canApproveDraft) return json(res, user ? 403 : 401, { error: 'Outreach approval is not allowed for this role.' });
    if (action === 'mark-sent-manually' && !capabilities.canEditDraft) return json(res, user ? 403 : 401, { error: 'Manual send status is not allowed for this role.' });
    const existing = db.prepare('SELECT * FROM customer_outreach_drafts WHERE id = ? AND customer_id = ?').get(draftId, id);
    if (!existing) return json(res, 404, { error: 'Outreach draft not found.' });
    const status = action === 'approve' ? 'Approved' : 'Sent Manually';
    db.prepare('UPDATE customer_outreach_drafts SET status = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, action === 'approve' ? user.id : existing.approved_by, draftId);
    customerActivity(id, action === 'approve' ? 'draft approved' : 'status changed', `Outreach draft ${draftId} marked ${status}.`, user.id);
    return json(res, 200, { draft: db.prepare('SELECT * FROM customer_outreach_drafts WHERE id = ?').get(draftId) });
  },

  opportunityQueue(req, res) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const rows = db.prepare(`SELECT customers.*, users.name AS assigned_sales_name,
      (SELECT full_name FROM customer_contacts cc WHERE cc.customer_id = customers.id AND cc.is_primary_decision_maker = TRUE ORDER BY cc.id LIMIT 1) AS decision_maker
      FROM customers LEFT JOIN users ON users.id = customers.assigned_sales_id
      WHERE customers.opportunity_grade IN ('A+', 'A') AND customers.opportunity_status NOT IN ('Won', 'Lost')
      ORDER BY CASE customers.opportunity_grade WHEN 'A+' THEN 1 ELSE 2 END, customers.opportunity_score DESC,
      CASE WHEN customers.email IS NOT NULL OR customers.whatsapp IS NOT NULL OR customers.website IS NOT NULL THEN 0 ELSE 1 END,
      customers.next_action_date ASC`).all().map(row => ({ ...mappedCustomer(row), recommended_products: customerRecommendationNames(row.id).join(', ') }));
    return json(res, 200, { customers: rows });
  },

  salesHandoff(req, res) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canView) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const rows = db.prepare(`SELECT customers.*, users.name AS assigned_sales_name,
      (SELECT full_name FROM customer_contacts cc WHERE cc.customer_id = customers.id AND cc.is_primary_decision_maker = TRUE ORDER BY cc.id LIMIT 1) AS decision_maker,
      (SELECT body FROM customer_outreach_drafts cod WHERE cod.customer_id = customers.id ORDER BY cod.updated_at DESC LIMIT 1) AS recommended_first_message
      FROM customers LEFT JOIN users ON users.id = customers.assigned_sales_id
      WHERE customers.opportunity_status IN ('Ready for Sales', 'Contacted', 'In Progress') ORDER BY customers.opportunity_score DESC`).all().map(row => ({ ...mappedCustomer(row), recommended_products: customerRecommendationNames(row.id).join(', ') }));
    return json(res, 200, { customers: rows });
  },

  async createSalesHandoff(req, res, id) {
    const user = currentUser(req);
    if (!['Admin', 'Owner'].includes(user?.role)) return json(res, user ? 403 : 401, { error: 'Sales handoff creation is not allowed for this role.' });
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) return json(res, 404, { error: 'Customer not found.' });
    const contactable = Boolean(customer.email || customer.whatsapp || customer.website || db.prepare('SELECT id FROM customer_contacts WHERE customer_id = ? AND is_primary_decision_maker = TRUE').get(id));
    if (!['A+', 'A'].includes(customer.opportunity_grade) || !contactable) return json(res, 409, { error: 'Customer does not meet sales handoff rules.' });
    const body = await readJson(req);
    db.prepare("UPDATE customers SET opportunity_status = 'Ready for Sales', assigned_sales_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(Number(body.assigned_sales_id) || customer.assigned_sales_id || null, id);
    customerActivity(id, 'handoff created', 'Customer manually moved to Ready for Sales.', user.id);
    return json(res, 200, { customer: customerDetailData(id) });
  },

  async acceptLead(req, res, id) {
    const user = currentUser(req);
    if (!opportunityCapabilities(user).canAcceptLead) return json(res, user ? 403 : 401, { error: 'Lead acceptance is not allowed for this role.' });
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) return json(res, 404, { error: 'Customer not found.' });
    if (!['Ready for Sales', 'Contacted', 'In Progress'].includes(customer.opportunity_status)) return json(res, 409, { error: 'Customer is not ready for sales acceptance.' });
    db.prepare("UPDATE customers SET opportunity_status = 'In Progress', assigned_sales_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.role === 'Sales' ? user.id : customer.assigned_sales_id, id);
    customerActivity(id, 'sales accepted', `${user.name} accepted the lead.`, user.id);
    audit(user.id, 'accept_lead', 'customers', String(id));
    return json(res, 200, { customer: customerDetailData(id) });
  },

  opportunities(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'crm')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const ownOnly = user.role === 'Sales';
    const rows = db.prepare(`
      SELECT opportunities.*, users.name AS owner_name, users.initials AS owner_initials
      FROM opportunities LEFT JOIN users ON users.id = opportunities.owner_id
      ${ownOnly ? 'WHERE opportunities.owner_id = ?' : ''}
      ORDER BY opportunities.updated_at DESC
    `).all(...(ownOnly ? [user.id] : []));
    return json(res, 200, { opportunities: rows });
  },

  priceRules(req,res){const user=currentUser(req);if(user?.role!=='Owner')return json(res,user?403:401,{error:'Owner access required.'});const rules=db.prepare('SELECT pr.*,pc.name AS category_name,u.name AS updated_by_name FROM product_price_rules pr LEFT JOIN product_categories pc ON pc.id=pr.category_id LEFT JOIN users u ON u.id=pr.updated_by ORDER BY pr.active DESC,pr.effective_date DESC,pr.id DESC').all();return json(res,200,{rules,categories:db.prepare('SELECT id,name FROM product_categories WHERE active=1 ORDER BY name').all(),roundingRules:pricingRoundingRules,currencies:masterValues('Currencies',['USD','CNY'])})},
  async createPriceRule(req,res,id=null){
    const user=currentUser(req);if(user?.role!=='Owner')return json(res,user?403:401,{error:'Owner access required.'});
    const b=await readJson(req),existing=id?db.prepare('SELECT * FROM product_price_rules WHERE id=?').get(id):null;if(id&&!existing)return json(res,404,{error:'Price rule not found.'});
    const ruleName=requiredText(b.rule_name??existing?.rule_name,'Rule name'),multiplier=Number(b.multiplier??existing?.multiplier);if(!(multiplier>0))return json(res,400,{error:'Multiplier must be greater than zero.'});
    const rounding=String(b.rounding_rule??existing?.rounding_rule??'No rounding');if(!pricingRoundingRules.includes(rounding))return json(res,400,{error:'Rounding rule is not supported.'});
    const values=[ruleName,String(b.supplier_name??existing?.supplier_name??'').trim()||null,Number(b.category_id??existing?.category_id)||null,multiplier,Number((b.fixed_addon??existing?.fixed_addon)||0),b.minimum_margin===''||b.minimum_margin==null?(existing?.minimum_margin??null):Number(b.minimum_margin),rounding,String(b.currency??existing?.currency??'USD'),activeValue(b.active,existing?.active??1),String(b.effective_date??existing?.effective_date??new Date().toISOString().slice(0,10)),String(b.notes??existing?.notes??'').trim()||null];
    if(existing)db.prepare('UPDATE product_price_rules SET rule_name=?,supplier_name=?,category_id=?,multiplier=?,fixed_addon=?,minimum_margin=?,rounding_rule=?,currency=?,active=?,effective_date=?,notes=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(...values,user.id,id);else id=Number(db.prepare('INSERT INTO product_price_rules(rule_name,supplier_name,category_id,multiplier,fixed_addon,minimum_margin,rounding_rule,currency,active,effective_date,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id').get(...values,user.id,user.id).id);
    audit(user.id,existing?'update_price_rule':'create_price_rule','product_price_rules',String(id));return json(res,existing?200:201,{rule:db.prepare('SELECT * FROM product_price_rules WHERE id=?').get(id)});
  },
  pricingPreview(req,res,url){const user=currentUser(req);if(user?.role!=='Owner')return json(res,user?403:401,{error:'Owner access required.'});const supplier=url.searchParams.get('supplier'),categoryId=Number(url.searchParams.get('category_id'))||null,batchId=Number(url.searchParams.get('batch_id'))||null,ids=String(url.searchParams.get('product_ids')||'').split(',').map(Number).filter(Boolean),where=['1=1'],params=[];if(supplier){where.push('LOWER(COALESCE(pv.default_supplier,p.source_supplier))=LOWER(?)');params.push(supplier)}if(categoryId){where.push('p.category_id=?');params.push(categoryId)}if(batchId){where.push('pv.import_batch_id=?');params.push(batchId)}if(ids.length){where.push(`p.id IN (${ids.map(()=>'?').join(',')})`);params.push(...ids)}const rows=db.prepare(`SELECT pv.*,p.name AS product_name,p.category_id FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE ${where.join(' AND ')} ORDER BY p.name,pv.variant_name`).all(...params).map(variant=>{const calculated=calculateReferencePrice({supplierCost:variant.supplier_cost??variant.cost_price,supplierCurrency:variant.supplier_currency||'USD',exchangeRate:variant.exchange_rate||1,supplier:variant.default_supplier,categoryId:variant.category_id,currency:'USD'});return {variant_id:variant.id,product_id:variant.product_id,product_name:variant.product_name,variant_name:variant.variant_name,old_reference_price:variant.reference_price,new_reference_price:calculated.reference_price,difference:calculated.reference_price==null?null:calculated.reference_price-Number(variant.reference_price||0),rule_applied:calculated.rule?.rule_name||null,pricing_status:calculated.pricing_status,manual_override:Boolean(variant.price_manual_override)}});return json(res,200,{preview:rows})},
  async applyPricingRecalculation(req,res){const user=currentUser(req);if(user?.role!=='Owner')return json(res,user?403:401,{error:'Owner access required.'});const b=await readJson(req);if(b.confirm!==true)return json(res,400,{error:'Recalculation confirmation is required.'});let updated=0;for(const id of normalizedIds(b.variant_ids)){const variant=db.prepare('SELECT pv.*,p.category_id FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE pv.id=?').get(id);if(!variant)continue;if(variant.price_manual_override&&!b.include_manual_overrides)continue;const result=calculateReferencePrice({supplierCost:variant.supplier_cost??variant.cost_price,supplierCurrency:variant.supplier_currency||'USD',exchangeRate:variant.exchange_rate||1,supplier:variant.default_supplier,categoryId:variant.category_id,currency:'USD'});db.prepare('UPDATE product_variants SET reference_price=?,converted_cost=?,pricing_rule_id=?,pricing_status=?,pricing_confidence=?,price_manual_override=0,price_override_by=NULL,price_override_at=NULL,last_updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(result.reference_price,result.converted_cost,result.rule?.id||null,result.pricing_status,result.pricing_confidence,user.id,id);updated++}audit(user.id,'recalculate_prices','product_variants',null,{updated});return json(res,200,{updated})},
  async overrideVariantPrice(req,res,productId,variantId){const user=currentUser(req);if(user?.role!=='Owner')return json(res,user?403:401,{error:'Owner access required.'});const b=await readJson(req),price=Number(b.reference_price);if(!Number.isFinite(price)||price<0)return json(res,400,{error:'Reference price must be zero or greater.'});const result=db.prepare("UPDATE product_variants SET reference_price=?,pricing_status='Manual Override',price_manual_override=1,price_override_by=?,price_override_at=CURRENT_TIMESTAMP,last_updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND product_id=?").run(price,user.id,user.id,variantId,productId);return result.changes?json(res,200,{variant:db.prepare('SELECT * FROM product_variants WHERE id=?').get(variantId)}):json(res,404,{error:'Variant not found.'})},

  imports(req, res, url) {
    const user = currentUser(req);
    if (!requires(user, 'imports')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const rows = db.prepare(`
      SELECT import_jobs.*, users.name AS created_by_name
      FROM import_jobs LEFT JOIN users ON users.id = import_jobs.created_by
      ORDER BY import_jobs.created_at DESC
    `).all();
    const batches=db.prepare('SELECT b.*,u.name AS created_by_name FROM product_import_batches b LEFT JOIN users u ON u.id=b.created_by ORDER BY b.created_at DESC').all().map(batch=>redactImportBatch(batch,user));
    const batchId=Number(url?.searchParams.get('batch_id')||batches[0]?.id||0);return json(res, 200, { imports: rows,batches,batch:batchId?importBatchDetail(batchId,user):null,categories:db.prepare('SELECT id,name FROM product_categories WHERE active=1 ORDER BY sort_order,name').all(),capabilities:{...importCapabilities(user),canViewSensitive:canViewSensitiveProductData(user)},modes:['Smart Import','Standard Template Import'],currencies:masterValues('Currencies',['USD','CNY']) });
  },

  async analyzeProductImportBusiness(req,res){
    const user=currentUser(req),capabilities=importCapabilities(user);if(!capabilities.canUpload)return json(res,user?403:401,{error:'Import upload is not allowed.'});
    const b=await readJson(req),filename=requiredText(b.filename,'Source file name'),mode=['Smart Import','Standard Template Import'].includes(b.import_mode)?b.import_mode:'Smart Import';
    const id=Number(db.prepare(`INSERT INTO product_import_batches(source_file_name,import_mode,supplier_name,supplier_code,supplier_contact,supplier_country,supplier_currency,exchange_rate,import_remark,default_category_id,status,started_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,'Analyzing',CURRENT_TIMESTAMP,?) RETURNING id`).get(filename,mode,String(b.supplier_name||'').trim()||null,String(b.supplier_code||'').trim()||null,String(b.supplier_contact||'').trim()||null,String(b.supplier_country||'').trim()||null,String(b.supplier_currency||'').trim()||null,b.exchange_rate?Number(b.exchange_rate):null,String(b.import_remark||'').trim()||null,b.default_category_id?Number(b.default_category_id):null,user.id).id);
    try{
      const parsed=parseSpreadsheet({filename,buffer:Buffer.from(requiredText(b.file_base64,'Spreadsheet content'),'base64')}),defaultCategory=b.default_category_id?db.prepare('SELECT * FROM product_categories WHERE id=?').get(Number(b.default_category_id)):null;
      const drafts=analyzeSpreadsheet(parsed,{filename,defaultCategoryName:defaultCategory?.name,currency:b.supplier_currency,exchangeRate:Number(b.exchange_rate||0),supplierName:b.supplier_name}),diagnostics=Array.isArray(drafts.diagnostics)?drafts.diagnostics:[],headerRanges=Array.isArray(drafts.headerRanges)?drafts.headerRanges:[],groupingSummary=Array.isArray(drafts.groupingSummary)?drafts.groupingSummary:[],workbookDebug=drafts.workbookDebug||{};
      if(groupingSummary.length)console.info('[Product Import Grouping]',groupingSummary.map(item=>`${item.product_code}: ${item.variant_count} variants`).join(' | '));
      const assetDir=join(publicDir,'imports',String(id));mkdirSync(assetDir,{recursive:true});
      const assetUrls=parsed.images.map((image,index)=>{const safe=`${index+1}-${String(image.name).replace(/[^a-zA-Z0-9._-]/g,'_')}`;writeFileSync(join(assetDir,safe),image.data);return `/imports/${id}/${safe}`});
      const insert=db.prepare(`INSERT INTO product_import_drafts(batch_id,status,product_name,product_sku,suggested_category_id,mapped_product,suggested_variants,suggested_attributes,source_rows,source_mapping,original_values,product_group_confidence,variant_confidence,attribute_mapping_confidence,image_matching_confidence,missing_fields,image_status,main_image_url,possible_match_product_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      drafts.forEach((draft,index)=>{
        draft.mapped_product={...draft.mapped_product,default_supplier:b.supplier_name||draft.mapped_product.default_supplier||null,source_supplier_code:b.supplier_code||null,supplier_currency:b.supplier_currency||draft.mapped_product.currency||null,exchange_rate:b.exchange_rate?Number(b.exchange_rate):null,import_notes:b.import_remark||null};
        const category=db.prepare('SELECT id FROM product_categories WHERE name=?').get(draft.category),categoryId=category?.id||null;
        const attributes=categoryId?db.prepare(`SELECT pad.id,pad.name,pad.code FROM product_attribute_definitions pad JOIN product_attribute_category_links pacl ON pacl.attribute_id=pad.id WHERE pacl.category_id=? AND pad.active=1`).all(categoryId).map(attribute=>{const key=Object.keys(draft.mapped_product).find(field=>normalizeImportField(field)===normalizeImportField(attribute.name));return key&&draft.mapped_product[key]?{attribute_id:attribute.id,name:attribute.name,value:draft.mapped_product[key]}:null}).filter(Boolean):[];
        const pricing=calculateReferencePrice({supplierCost:draft.mapped_product.supplier_cost??draft.mapped_product.cost_price,supplierCurrency:draft.mapped_product.supplier_currency||'USD',exchangeRate:draft.mapped_product.exchange_rate||1,supplier:draft.mapped_product.default_supplier,categoryId,currency:'USD'});draft.mapped_product={...draft.mapped_product,reference_price:pricing.reference_price??draft.mapped_product.reference_price??null,converted_cost:pricing.converted_cost,pricing_rule_id:pricing.rule?.id||null,pricing_rule_applied:pricing.rule?.rule_name||null,pricing_status:pricing.pricing_status,pricing_confidence:pricing.pricing_confidence};draft.variants=draft.variants.map(variant=>{const result=calculateReferencePrice({supplierCost:variant.cost_price??draft.mapped_product.supplier_cost,supplierCurrency:draft.mapped_product.supplier_currency||'USD',exchangeRate:draft.mapped_product.exchange_rate||1,supplier:draft.mapped_product.default_supplier,categoryId,currency:'USD'});return {...variant,reference_price:result.reference_price??variant.reference_price??null,converted_cost:result.converted_cost,pricing_rule_id:result.rule?.id||null,pricing_rule_applied:result.rule?.rule_name||null,pricing_status:result.pricing_status,pricing_confidence:result.pricing_confidence,supplier_currency:draft.mapped_product.supplier_currency,exchange_rate:draft.mapped_product.exchange_rate}});
        const image=assetUrls[index]||null,sourceRow=draft.source_rows?.[0]||{},imageSource=image?`Supplier Excel ${sourceRow.sheet||'Sheet'} Row ${sourceRow.row||sourceRow.row_number||index+1}`:null,missing=[...draft.missing_fields,...(!image?['Image Assets Needed']:[]),...(pricing.rule?[]:['Needs Pricing Review'])],duplicate=findImportDuplicate(draft);
        draft.mapped_product={...draft.mapped_product,image_source:imageSource,image_confidence:image?95:0,import_workflow_status:missing.some(value=>value!=='Image Assets Needed')?'Needs Review':'AI Processing'};
        insert.run(id,missing.some(value=>value!=='Image Assets Needed')?'Needs Review':draft.status,draft.product_name,draft.product_sku,categoryId,JSON.stringify({...draft.mapped_product,duplicate_match:duplicate}),JSON.stringify(draft.variants),JSON.stringify(attributes),JSON.stringify(draft.source_rows),JSON.stringify(draft.source_mapping),JSON.stringify(draft.original_values),draft.product_group_confidence,draft.variant_confidence,draft.attribute_mapping_confidence,image?75:0,JSON.stringify(missing),image?'Embedded Image Extracted':'Image Assets Needed',image,duplicate?.id||null);
        if(missing.some(value=>value!=='Image Assets Needed'))for(const row of draft.source_rows)db.prepare('INSERT INTO product_import_errors(batch_id,source_row,product_name,reason,suggested_fix) VALUES(?,?,?,?,?)').run(id,row.row_number||null,draft.product_name,`Missing: ${missing.filter(value=>value!=='Image Assets Needed').join(', ')}`,'Complete the highlighted draft fields before approval.');
      });
      for(const issue of diagnostics){const location=[issue.sheet&&`Sheet ${issue.sheet}`,issue.row&&`row ${issue.row}`,issue.column&&`column ${issue.column}`].filter(Boolean).join(', ');db.prepare('INSERT INTO product_import_errors(batch_id,source_sheet,source_row,reason,suggested_fix) VALUES(?,?,?,?,?)').run(id,issue.sheet||null,issue.row||null,`${location?`${location}: `:''}${issue.reason||'Unparseable spreadsheet content skipped.'}`,'Review the indicated supplier row/cell and complete the Product Draft if needed.');recordSystemEvent('warn','Spreadsheet import content skipped',{batchId:id,sheet:issue.sheet||null,row:issue.row||null,column:issue.column||null,reason:issue.reason||'Unparseable content'})}
      const columns=[...new Set(drafts.flatMap(draft=>Object.values(draft.source_mapping||{}).filter(item=>item&&typeof item==='object').map(item=>item.source).filter(Boolean)))];
      db.prepare("UPDATE product_import_batches SET status='Draft Review',detected_columns=?,analysis_summary=?,total_rows=?,draft_count=?,error_count=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(columns),JSON.stringify({detected_products:drafts.length,detected_variants:drafts.reduce((sum,draft)=>sum+(Array.isArray(draft.variants)?draft.variants.length:0),0),images:assetUrls.length,header_ranges:headerRanges,grouping_result:groupingSummary,workbook_debug:workbookDebug,skipped_or_flagged:diagnostics.length,diagnostics:diagnostics.slice(0,100)}),drafts.reduce((sum,draft)=>sum+(Array.isArray(draft.source_rows)?draft.source_rows.length:0),0),drafts.length,diagnostics.length,id);
      return json(res,201,{batch:importBatchDetail(id,user)});
    }catch(error){const context=error?.importContext||{},diagnostics=Array.isArray(context.diagnostics)?context.diagnostics:[],headerRanges=Array.isArray(context.headerRanges)?context.headerRanges:[],workbookDebug=context.workbookDebug||{},friendly=String(error.message||'The spreadsheet could not be analyzed. Please save it as a standard .xlsx file and retry.').slice(0,2000);if(diagnostics.length)for(const issue of diagnostics.slice(0,100))db.prepare('INSERT INTO product_import_errors(batch_id,source_sheet,source_row,reason,suggested_fix) VALUES(?,?,?,?,?)').run(id,issue.sheet||null,issue.row||null,`${issue.reason||friendly}${issue.possibleHeaderRows?.length?` Possible header rows: ${issue.possibleHeaderRows.map(row=>`${row.startRow}-${row.endRow}`).join(', ')}.`:''}`,'Review this sheet/header area or save the file again as .xlsx.');else db.prepare('INSERT INTO product_import_errors(batch_id,source_sheet,source_row,reason,suggested_fix) VALUES(?,?,?,?,?)').run(id,context.sheet||null,context.row||null,friendly,'Check the spreadsheet header/format and save it again as .xlsx.');recordSystemEvent('error','Spreadsheet import analysis failed',{batchId:id,file:filename,sheet:context.sheet||null,row:context.row||null,column:context.column||null,error:friendly,headerRanges,workbookDebug,diagnostics:diagnostics.slice(0,20)});db.prepare("UPDATE product_import_batches SET status='Failed',error_count=?,error_message=?,analysis_summary=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(Math.max(1,diagnostics.length),friendly,JSON.stringify({header_ranges:headerRanges,workbook_debug:workbookDebug,diagnostics:diagnostics.slice(0,100)}),id);return json(res,400,{error:friendly,batch:importBatchDetail(id,user)})}
  },

  async analyzeProductImport(req,res){const user=currentUser(req),capabilities=importCapabilities(user);if(!capabilities.canUpload)return json(res,user?403:401,{error:'Import upload is not allowed.'});const b=await readJson(req),filename=requiredText(b.filename,'Source file name'),mode=['Smart Import','Standard Template Import'].includes(b.import_mode)?b.import_mode:'Smart Import';const id=Number(db.prepare(`INSERT INTO product_import_batches(source_file_name,import_mode,supplier_name,supplier_contact,supplier_country,supplier_currency,exchange_rate,import_remark,default_category_id,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,'Analyzing',?) RETURNING id`).get(filename,mode,String(b.supplier_name||'').trim()||null,String(b.supplier_contact||'').trim()||null,String(b.supplier_country||'').trim()||null,String(b.supplier_currency||'').trim()||null,b.exchange_rate?Number(b.exchange_rate):null,String(b.import_remark||'').trim()||null,b.default_category_id?Number(b.default_category_id):null,user.id).id);try{const parsed=parseSpreadsheet({filename,buffer:Buffer.from(requiredText(b.file_base64,'Spreadsheet content'),'base64')}),defaultCategory=b.default_category_id?db.prepare('SELECT * FROM product_categories WHERE id=?').get(Number(b.default_category_id)):null,drafts=analyzeSpreadsheet(parsed,{filename,defaultCategoryName:defaultCategory?.name,currency:b.supplier_currency,exchangeRate:Number(b.exchange_rate||0),supplierName:b.supplier_name}),assetDir=join(publicDir,'imports',String(id));mkdirSync(assetDir,{recursive:true});const assetUrls=parsed.images.map((image,index)=>{const safe=`${index+1}-${String(image.name).replace(/[^a-zA-Z0-9._-]/g,'_')}`;writeFileSync(join(assetDir,safe),image.data);return `/imports/${id}/${safe}`});const insert=db.prepare(`INSERT INTO product_import_drafts(batch_id,status,product_name,product_sku,suggested_category_id,mapped_product,suggested_variants,suggested_attributes,source_rows,source_mapping,original_values,product_group_confidence,variant_confidence,attribute_mapping_confidence,image_matching_confidence,missing_fields,image_status,main_image_url,possible_match_product_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);drafts.forEach((draft,index)=>{const category=db.prepare('SELECT id FROM product_categories WHERE name=?').get(draft.category),categoryId=category?.id||null,attributes=categoryId?db.prepare(`SELECT pad.id,pad.name,pad.code FROM product_attribute_definitions pad JOIN product_attribute_category_links pacl ON pacl.attribute_id=pad.id WHERE pacl.category_id=? AND pad.active=1`).all(categoryId).map(attribute=>{const key=Object.keys(draft.mapped_product).find(field=>normalizeImportField(field)===normalizeImportField(attribute.name));return key&&draft.mapped_product[key]?{attribute_id:attribute.id,name:attribute.name,value:draft.mapped_product[key]}:null}).filter(Boolean):[],image=assetUrls[index]||null,missing=[...draft.missing_fields,...(!image?['Image Assets Needed']:[])];insert.run(id,missing.some(value=>value!=='Image Assets Needed')?'Needs Review':draft.status,draft.product_name,draft.product_sku,categoryId,JSON.stringify(draft.mapped_product),JSON.stringify(draft.variants),JSON.stringify(attributes),JSON.stringify(draft.source_rows),JSON.stringify(draft.source_mapping),JSON.stringify(draft.original_values),draft.product_group_confidence,draft.variant_confidence,draft.attribute_mapping_confidence,image?75:0,JSON.stringify(missing),image?'Embedded Image Extracted':'Image Assets Needed',image,db.prepare('SELECT id FROM products WHERE sku=? COLLATE NOCASE').get(draft.product_sku)?.id||null)});const columns=[...new Set(drafts.flatMap(draft=>Object.values(draft.source_mapping).map(item=>item.source)))];db.prepare("UPDATE product_import_batches SET status='Draft Review',detected_columns=?,analysis_summary=?,total_rows=?,draft_count=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(columns),JSON.stringify({detected_products:drafts.length,detected_variants:drafts.reduce((sum,draft)=>sum+draft.variants.length,0),images:assetUrls.length}),drafts.reduce((sum,draft)=>sum+draft.source_rows.length,0),drafts.length,id);return json(res,201,{batch:importBatchDetail(id)})}catch(error){db.prepare("UPDATE product_import_batches SET status='Failed',error_count=1,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(error.message).slice(0,2000),id);return json(res,400,{error:error.message,batch:importBatchDetail(id)})}},

  async updateProductImportDraft(req,res,id){const user=currentUser(req);if(!importCapabilities(user).canEdit)return json(res,user?403:401,{error:'Draft editing is not allowed.'});const existing=importDraftRow(db.prepare('SELECT * FROM product_import_drafts WHERE id=?').get(id));if(!existing)return json(res,404,{error:'Draft not found.'});const b=await readJson(req);db.prepare(`UPDATE product_import_drafts SET product_name=?,product_sku=?,suggested_category_id=?,mapped_product=?,suggested_variants=?,suggested_attributes=?,suggested_tag_ids=?,status=?,resolution_action=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(String(b.product_name??existing.product_name??'').trim()||null,String(b.product_sku??existing.product_sku??'').trim()||null,b.suggested_category_id?Number(b.suggested_category_id):existing.suggested_category_id,JSON.stringify(b.mapped_product??existing.mapped_product),JSON.stringify(b.suggested_variants??existing.suggested_variants),JSON.stringify(b.suggested_attributes??existing.suggested_attributes),JSON.stringify(b.suggested_tag_ids??existing.suggested_tag_ids),String(b.status??existing.status),String(b.resolution_action??existing.resolution_action??'').trim()||null,id);return json(res,200,{draft:redactImportDraft(importDraftRow(db.prepare('SELECT * FROM product_import_drafts WHERE id=?').get(id)),user)})},
  async reviewProductImportDraft(req,res,id,action){const user=currentUser(req);if(!importCapabilities(user).canApprove)return json(res,user?403:401,{error:'Only Owner or Sales Admin can approve imports.'});const b=await readJson(req);if(action==='reject'){db.prepare("UPDATE product_import_drafts SET status='Rejected',approved_by=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(user.id,id);return json(res,200,{draft:redactImportDraft(importDraftRow(db.prepare('SELECT * FROM product_import_drafts WHERE id=?').get(id)),user)})}const result=approveProductImportDraft(id,user,b.resolution_action||'create_new');return json(res,200,{result,draft:redactImportDraft(importDraftRow(db.prepare('SELECT * FROM product_import_drafts WHERE id=?').get(id)),user)})},
  async approveSelectedProductImports(req,res){const user=currentUser(req);if(!importCapabilities(user).canApprove)return json(res,user?403:401,{error:'Only Owner or Sales Admin can approve imports.'});const b=await readJson(req),results=[];for(const id of normalizedIds(b.draft_ids))results.push(approveProductImportDraft(id,user,b.resolution_action||'create_new'));return json(res,200,{results,batch:b.batch_id?importBatchDetail(Number(b.batch_id),user):null})},
  async splitProductImportDraft(req,res,id){const user=currentUser(req);if(!importCapabilities(user).canEdit)return json(res,user?403:401,{error:'Draft editing is not allowed.'});const draft=importDraftRow(db.prepare('SELECT * FROM product_import_drafts WHERE id=?').get(id));if(!draft)return json(res,404,{error:'Draft not found.'});if(draft.suggested_variants.length<2)return json(res,409,{error:'This draft does not contain multiple variants.'});const insert=db.prepare(`INSERT INTO product_import_drafts(batch_id,status,product_name,product_sku,suggested_category_id,mapped_product,suggested_variants,suggested_attributes,source_rows,source_mapping,original_values,product_group_confidence,variant_confidence,attribute_mapping_confidence,image_matching_confidence,missing_fields,image_status,main_image_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);draft.suggested_variants.forEach((variant,index)=>insert.run(draft.batch_id,'Pending Review',`${draft.product_name} ${variant.variant_name}`,variant.variant_sku||`${draft.product_sku}-${index+1}`,draft.suggested_category_id,JSON.stringify({...draft.mapped_product,...variant}),JSON.stringify([]),JSON.stringify(draft.suggested_attributes),JSON.stringify(draft.source_rows[index]?[draft.source_rows[index]]:[]),JSON.stringify(draft.source_mapping),JSON.stringify(draft.source_rows[index]?.values||draft.original_values),75,0,draft.attribute_mapping_confidence,index===0?draft.image_matching_confidence:0,JSON.stringify(index===0?draft.missing_fields:[...new Set([...draft.missing_fields,'Image Assets Needed'])]),index===0?draft.image_status:'Image Assets Needed',index===0?draft.main_image_url:null));db.prepare("UPDATE product_import_drafts SET status='Rejected',resolution_action='split',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);db.prepare('UPDATE product_import_batches SET draft_count=(SELECT COUNT(*) FROM product_import_drafts WHERE batch_id=?),updated_at=CURRENT_TIMESTAMP WHERE id=?').run(draft.batch_id,draft.batch_id);return json(res,200,{batch:importBatchDetail(draft.batch_id)})},
  async mergeProductImportDrafts(req,res){const user=currentUser(req);if(!importCapabilities(user).canEdit)return json(res,user?403:401,{error:'Draft editing is not allowed.'});const b=await readJson(req),ids=normalizedIds(b.draft_ids);if(ids.length<2)return json(res,400,{error:'Select at least two drafts to merge.'});const drafts=ids.map(id=>importDraftRow(db.prepare('SELECT * FROM product_import_drafts WHERE id=?').get(id))).filter(Boolean);if(drafts.length!==ids.length||new Set(drafts.map(draft=>draft.batch_id)).size!==1)return json(res,400,{error:'Drafts must belong to the same batch.'});const target=drafts[0],variants=drafts.map(draft=>({variant_name:draft.mapped_product.dimensions||draft.product_name,variant_sku:draft.product_sku,...draft.mapped_product})),rows=drafts.flatMap(draft=>draft.source_rows);db.prepare("UPDATE product_import_drafts SET product_name=?,suggested_variants=?,source_rows=?,product_group_confidence=85,variant_confidence=82,status='Pending Review',resolution_action='merged',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(b.product_name||target.product_name),JSON.stringify(variants),JSON.stringify(rows),target.id);for(const draft of drafts.slice(1))db.prepare("UPDATE product_import_drafts SET status='Rejected',resolution_action=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(`merged_into:${target.id}`,draft.id);return json(res,200,{batch:importBatchDetail(target.batch_id),draft_id:target.id})},

  exportProductImportErrors(req,res,batchId){
    const user=currentUser(req);if(!importCapabilities(user).canUpload)return json(res,user?403:401,{error:'Import error report access is not allowed.'});
    if(!db.prepare('SELECT id FROM product_import_batches WHERE id=?').get(batchId))return json(res,404,{error:'Import batch not found.'});
    const rows=db.prepare('SELECT source_row,product_name,reason,suggested_fix FROM product_import_errors WHERE batch_id=? ORDER BY source_row,id').all(batchId),escapeXml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const data=[['Row Number','Product','Reason','Suggested Fix'],...rows.map(row=>[row.source_row??'',row.product_name||'',row.reason,row.suggested_fix||''])];
    const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Import Errors"><Table>${data.map((row,index)=>`<Row>${row.map(cell=>`<Cell${index===0?' ss:StyleID="Header"':''}><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`).join('')}</Table></Worksheet><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DCEFE7" ss:Pattern="Solid"/></Style></Styles></Workbook>`;
    res.writeHead(200,{'Content-Type':'application/vnd.ms-excel','Content-Disposition':`attachment; filename="import-${batchId}-errors.xls"`});return res.end(xml);
  },

  async clearProductDemoData(req,res){
    const user=currentUser(req);if(!canManageProductLibrary(user))return json(res,user?403:401,{error:'Administrator access required.'});const body=await readJson(req);if(body.confirm!=='CLEAR DEMO DATA')return json(res,400,{error:'Type CLEAR DEMO DATA to confirm.'});
    const count=table=>Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count),counts={products:count('products'),variants:count('product_variants'),mediaAssets:Number(db.prepare("SELECT COUNT(DISTINCT ma.id) AS count FROM media_assets ma LEFT JOIN product_media_links pml ON pml.media_id=ma.id WHERE pml.product_id IS NOT NULL OR ma.related_module='products'").get().count),attributeValues:count('product_attribute_values'),tagLinks:count('product_tag_links'),relatedProducts:count('product_foundation_relationships'),batches:count('product_import_batches'),drafts:count('product_import_drafts'),importAssets:count('product_import_assets'),importErrors:count('product_import_errors')};
    const mediaIds=db.prepare("SELECT DISTINCT ma.id FROM media_assets ma LEFT JOIN product_media_links pml ON pml.media_id=ma.id WHERE pml.product_id IS NOT NULL OR ma.related_module='products'").all().map(row=>Number(row.id));
    db.exec('BEGIN IMMEDIATE');try{
      db.prepare('DELETE FROM sales_inquiry_products').run();db.prepare('DELETE FROM sales_quote_items').run();db.prepare('DELETE FROM sales_order_items').run();
      db.prepare('DELETE FROM customer_product_recommendations WHERE product_id IS NOT NULL').run();db.prepare('UPDATE proposal_items SET product_id=NULL').run();
      db.prepare('DELETE FROM products').run();if(mediaIds.length)db.prepare(`DELETE FROM media_assets WHERE id IN (${mediaIds.map(()=>'?').join(',')})`).run(...mediaIds);
      db.prepare('DELETE FROM product_import_batches').run();db.prepare('DELETE FROM import_jobs').run();db.prepare("INSERT INTO organization_settings(key,value,updated_by) VALUES('product_demo_data_cleared','true',?) ON CONFLICT(key) DO UPDATE SET value='true',updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").run(user.id);db.exec('COMMIT');
    }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error}
    const importsDir=join(publicDir,'imports');if(existsSync(importsDir))rmSync(importsDir,{recursive:true,force:true});mkdirSync(importsDir,{recursive:true});
    audit(user.id,'clear_demo_data','products','all-trial-data',counts);const message=`Products deleted: ${counts.products}. Variants deleted: ${counts.variants}. Import batches deleted: ${counts.batches}. Drafts deleted: ${counts.drafts}.`;
    return json(res,200,{cleared:true,counts,message});
  },

  async addApprovedQuoteLibraryItem(req,res,id){
    const user=currentUser(req);if(!salesCapabilities(user).canQuote)return json(res,user?403:401,{error:'Access denied.'});if(!salesQuoteDetail(id,user))return json(res,404,{error:'Quote not found.'});
    const b=await readJson(req),p=db.prepare("SELECT * FROM products WHERE id=? AND COALESCE(visibility,'Website + Quote') IN ('Website + Quote','Quote Only') AND library_status='Approved'").get(Number(b.product_id));if(!p)return json(res,404,{error:'Only Approved products are available for quotation.'});
    const variant=b.variant_id?db.prepare("SELECT * FROM product_variants WHERE id=? AND product_id=? AND status='Active'").get(Number(b.variant_id),p.id):null;if(b.variant_id&&!variant)return json(res,400,{error:'Selected variant is not available.'});
    const price=variant?.reference_price??Number(String(p.price_range||'').match(/[\d,.]+/)?.[0].replace(',','')||0),snapshot=variant?JSON.stringify({id:variant.id,name:variant.variant_name,sku:variant.variant_sku,dimensions:variant.dimensions,material:variant.material,finish:variant.finish,color:variant.color,reference_price:variant.reference_price,moq:variant.moq,lead_time_days:variant.lead_time_days,cbm:variant.cbm,gross_weight_kg:variant.gross_weight_kg,net_weight_kg:variant.net_weight_kg,packing_info:variant.packing_info}):null,productSnapshot=JSON.stringify(pimQuoteSnapshot(p,variant)),sort=Number(db.prepare('SELECT COUNT(*) AS count FROM sales_quote_items WHERE quote_id=?').get(id).count);
    db.prepare("INSERT INTO sales_quote_items(quote_id,product_id,variant_id,variant_snapshot,product_snapshot,quantity,unit_price,discount_percent,sort_order,pricing_source,reference_price_snapshot,cost_snapshot,cost_currency_snapshot,final_selling_price_snapshot) VALUES(?,?,?,?,?,1,?,0,?,'Reference',?,?,?,?)").run(id,p.id,variant?.id||null,snapshot,productSnapshot,price,sort,price,variant?.converted_cost??variant?.supplier_cost??p.supplier_cost,variant?.supplier_currency||'USD',price);saveQuoteVersion(id,user);return json(res,201,{quote:salesQuoteDetail(id,user)});
  },

  proposals(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'proposals')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const ownOnly = user.role === 'Sales';
    const rows = db.prepare(`
      SELECT proposals.*, users.name AS owner_name, users.initials AS owner_initials
      FROM proposals LEFT JOIN users ON users.id = proposals.owner_id
      ${ownOnly ? 'WHERE proposals.owner_id = ?' : ''}
      ORDER BY proposals.updated_at DESC
    `).all(...(ownOnly ? [user.id] : []));
    return json(res, 200, { proposals: rows });
  },

  team(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'settings')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const rows = db.prepare('SELECT id, name, email, role, initials, status, last_login_at, created_at FROM users ORDER BY id').all();
    return json(res, 200, { users: rows, permissions: rolePermissions });
  },

  foundation(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'core-foundation')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const capabilities = foundationCapabilities(user);
    const configSql = user.role === 'Designer'
      ? "SELECT * FROM system_configs WHERE config_type IN ('Styles', 'Materials') ORDER BY config_type, sort_order, name"
      : 'SELECT * FROM system_configs ORDER BY config_type, sort_order, name';
    const configs = db.prepare(configSql).all();
    const tags = db.prepare('SELECT * FROM system_tags ORDER BY tag_type, tag_name').all();
    const media = capabilities.canViewMedia ? db.prepare(`
      SELECT media_assets.*, users.name AS created_by_name
      FROM media_assets LEFT JOIN users ON users.id = media_assets.created_by
      ORDER BY media_assets.created_at DESC
    `).all() : [];
    const prompts = capabilities.canViewPrompts ? db.prepare(`
      SELECT ai_prompts.*, users.name AS created_by_name
      FROM ai_prompts LEFT JOIN users ON users.id = ai_prompts.created_by
      ORDER BY ai_prompts.updated_at DESC
    `).all() : [];
    return json(res, 200, { configs, tags, media, prompts, capabilities, types: foundationTypes, aiPreviewNotice });
  },

  async mutateFoundation(req, res, entity, id = null) {
    const user = currentUser(req);
    if (!requires(user, 'core-foundation')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const capabilities = foundationCapabilities(user);
    const permissionKey = { configs: 'canEditConfigs', tags: 'canEditTags', media: 'canEditMedia', prompts: 'canEditPrompts' }[entity];
    if (!capabilities[permissionKey]) return json(res, 403, { error: 'This role has read-only access.' });
    const body = await readJson(req);
    const table = { configs: 'system_configs', tags: 'system_tags', media: 'media_assets', prompts: 'ai_prompts' }[entity];
    const existing = id ? foundationRecord(table, id) : null;
    if (id && !existing) return json(res, 404, { error: 'Record not found.' });

    try {
      if (entity === 'configs') {
        const type = allowedType(body.config_type ?? existing?.config_type, foundationTypes.configs, 'Config type');
        const name = requiredText(body.name ?? existing?.name, 'Name');
        const code = requiredText(body.code ?? existing?.code ?? makeCode(name), 'Code').toUpperCase();
        const values = [type, name, code, String(body.description ?? existing?.description ?? '').trim() || null, Number(body.sort_order ?? existing?.sort_order ?? 0), activeValue(body.active, existing?.active ?? 1)];
        if (existing) db.prepare('UPDATE system_configs SET config_type = ?, name = ?, code = ?, description = ?, sort_order = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(...values, id);
        else id = Number(db.prepare('INSERT INTO system_configs (config_type, name, code, description, sort_order, active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(...values, user.id).lastInsertRowid);
      } else if (entity === 'tags') {
        const type = allowedType(body.tag_type ?? existing?.tag_type, foundationTypes.tags, 'Tag type');
        const name = requiredText(body.tag_name ?? existing?.tag_name, 'Tag name');
        const code = requiredText(body.code ?? existing?.code ?? `TAG-${makeCode(name)}`, 'Code').toUpperCase();
        const values = [name, type, code, String(body.description ?? existing?.description ?? '').trim() || null, activeValue(body.active, existing?.active ?? 1)];
        if (existing) db.prepare('UPDATE system_tags SET tag_name = ?, tag_type = ?, code = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(...values, id);
        else id = Number(db.prepare('INSERT INTO system_tags (tag_name, tag_type, code, description, active, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(...values, user.id).lastInsertRowid);
      } else if (entity === 'media') {
        const category = allowedType(body.media_category ?? existing?.media_category, foundationTypes.media, 'Media category');
        const aiGenerated = activeValue(body.is_ai_generated, existing?.is_ai_generated ?? 0);
        let usageNote = String(body.usage_note ?? existing?.usage_note ?? '').trim() || null;
        if (aiGenerated && !String(usageNote || '').includes(aiPreviewNotice)) usageNote = usageNote ? `${aiPreviewNotice}\n${usageNote}` : aiPreviewNotice;
        const values = [requiredText(body.file_name ?? existing?.file_name, 'File name'), requiredText(body.file_type ?? existing?.file_type, 'File type'), String(body.file_url ?? existing?.file_url ?? '').trim() || null, String(body.storage_provider ?? existing?.storage_provider ?? '').trim() || null, String(body.related_module ?? existing?.related_module ?? '').trim() || null, String(body.related_record_id ?? existing?.related_record_id ?? '').trim() || null, category, activeValue(body.is_verified, existing?.is_verified ?? 0), aiGenerated, usageNote, activeValue(body.active, existing?.active ?? 1)];
        if (existing) db.prepare('UPDATE media_assets SET file_name = ?, file_type = ?, file_url = ?, storage_provider = ?, related_module = ?, related_record_id = ?, media_category = ?, is_verified = ?, is_ai_generated = ?, usage_note = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(...values, id);
        else id = Number(db.prepare('INSERT INTO media_assets (file_name, file_type, file_url, storage_provider, related_module, related_record_id, media_category, is_verified, is_ai_generated, usage_note, active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...values, user.id).lastInsertRowid);
      } else if (entity === 'prompts') {
        const values = [requiredText(body.prompt_name ?? existing?.prompt_name, 'Prompt name'), allowedType(body.prompt_type ?? existing?.prompt_type, foundationTypes.prompts, 'Prompt type'), requiredText(body.prompt_content ?? existing?.prompt_content, 'Prompt content'), String(body.variables ?? existing?.variables ?? '').trim() || null, Math.max(1, Number(body.version ?? existing?.version ?? 1)), activeValue(body.active, existing?.active ?? 1)];
        if (existing) db.prepare('UPDATE ai_prompts SET prompt_name = ?, prompt_type = ?, prompt_content = ?, variables = ?, version = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(...values, id);
        else id = Number(db.prepare('INSERT INTO ai_prompts (prompt_name, prompt_type, prompt_content, variables, version, active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(...values, user.id).lastInsertRowid);
      }
    } catch (error) {
      handleConstraint(error);
    }
    audit(user.id, existing ? 'update' : 'create', table, String(id), { active: body.active });
    return json(res, existing ? 200 : 201, { record: foundationRecord(table, id) });
  }
};

function serveStatic(req, res, pathname) {
  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = normalize(join(publicDir, requestedPath));
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    const index = readFileSync(join(publicDir, 'index.html'), 'utf8').replaceAll('__BUILD_VERSION__', buildVersion);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    return res.end(index);
  }
  const contentTypes = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8'
  };
  const noCache = ['.html', '.js', '.css'].includes(extname(filePath));
  const cache = noCache ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream', 'Cache-Control': cache });
  const content = extname(filePath) === '.html' ? readFileSync(filePath, 'utf8').replaceAll('__BUILD_VERSION__', buildVersion) : readFileSync(filePath);
  res.end(content);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, { status: 'ok' });
    }
    if (req.method === 'GET' && url.pathname === '/api/debug/db') {
      return json(res, 200, {
        connected: databaseDiagnostics.connected,
        migration: databaseDiagnostics.migration,
        migrationVersion: databaseDiagnostics.migrationVersion,
        tables: databaseDiagnostics.tables,
        error: databaseDiagnostics.error
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/ready') {
      if (databaseStatus !== 'ready') {
        return json(res, 503, { status: databaseStatus, error: databaseInitializationError ? 'database_unavailable' : undefined });
      }
      db.prepare('SELECT 1 AS ok').get();
      return json(res, 200, { status: 'ok' });
    }
    if (url.pathname.startsWith('/api/') && databaseStatus !== 'ready') {
      return json(res, 503, { error: 'Database is not ready.' });
    }
    if (req.method === 'GET' && url.pathname === '/api/debug/system') {
      const user = currentUser(req);
      if (!requires(user, 'debug-center')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
      const memory = process.memoryUsage();
      return json(res, 200, {
        status: 'ok',
        runtime: {
          node: process.version,
          platform: process.platform,
          environment: process.env.NODE_ENV || 'development',
          uptimeSeconds: Math.round(process.uptime()),
          pid: process.pid,
          memoryMb: {
            rss: Math.round(memory.rss / 1024 / 1024),
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memory.heapTotal / 1024 / 1024)
          }
        },
        http: { host: '0.0.0.0', port: Number(PORT), health: '/api/health', readiness: '/api/ready' },
        database: { status: databaseStatus, ...databaseDiagnostics },
        deployment: {
          provider: process.env.RAILWAY_ENVIRONMENT_NAME ? 'Railway' : (process.env.RENDER_SERVICE_NAME ? 'Render' : 'Local'),
          commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || null
        },
        productIntelligence: productIntelligenceDashboardData(),
        aiProductFactory: aiFactoryDebugData(),
        aiImageGeneration: aiImageGenerationDebugData(),
        opportunityIntelligence: opportunityDebugData(),
        aiBusinessBrain: aiBusinessBrainDebugData(),
        aiCostControl: aiCostDebugData(),
        knowledgeCenter: knowledgeCenter.debug(),
        salesIntelligence: salesDebugData(),
        events: systemEvents.slice(-50).reverse()
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') return await handlers.login(req, res);
    if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, { demo_mode: demoMode });
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') return handlers.logout(req, res);
    if (req.method === 'GET' && url.pathname === '/api/auth/me') return handlers.me(req, res);
    if (req.method === 'GET' && url.pathname === '/api/dashboard') return handlers.dashboard(req, res);
    if (req.method === 'GET' && url.pathname === '/api/sales-workspace') return handlers.salesWorkspace(req, res);
    if (req.method === 'POST' && url.pathname === '/api/sales-inquiries') return await handlers.createSalesInquiry(req, res);
    const salesAnalyzeMatch = url.pathname.match(/^\/api\/sales-inquiries\/(\d+)\/analyze$/);
    if (salesAnalyzeMatch && req.method === 'POST') return await handlers.analyzeSalesInquiry(req, res, Number(salesAnalyzeMatch[1]));
    const salesProductsMatch = url.pathname.match(/^\/api\/sales-inquiries\/(\d+)\/products$/);
    if (salesProductsMatch && req.method === 'PUT') return await handlers.selectSalesProducts(req, res, Number(salesProductsMatch[1]));
    const salesQuoteMatch = url.pathname.match(/^\/api\/sales-inquiries\/(\d+)\/quote$/);
    if (salesQuoteMatch && req.method === 'POST') return await handlers.generateSalesQuote(req, res, Number(salesQuoteMatch[1]));
    const salesOrderMatch = url.pathname.match(/^\/api\/sales-inquiries\/(\d+)\/convert-order$/);
    if (salesOrderMatch && req.method === 'POST') return await handlers.convertSalesOrder(req, res, Number(salesOrderMatch[1]));
    const salesInquiryMatch = url.pathname.match(/^\/api\/sales-inquiries\/(\d+)$/);
    if (salesInquiryMatch && req.method === 'GET') return handlers.salesInquiry(req, res, Number(salesInquiryMatch[1]));
    const quoteVersionMatch=url.pathname.match(/^\/api\/sales-quotes\/(\d+)\/versions\/(\d+)$/);
    if(quoteVersionMatch&&req.method==='GET')return handlers.salesQuoteVersion(req,res,Number(quoteVersionMatch[1]),Number(quoteVersionMatch[2]));
    const quoteExportMatch=url.pathname.match(/^\/api\/sales-quotes\/(\d+)\/export\/(pdf|excel)$/);
    if(quoteExportMatch&&req.method==='GET')return handlers.salesQuoteExport(req,res,Number(quoteExportMatch[1]),quoteExportMatch[2]);
    const quoteMessageMatch=url.pathname.match(/^\/api\/sales-quotes\/(\d+)\/(whatsapp|email)$/);
    if(quoteMessageMatch&&req.method==='GET')return handlers.salesQuoteMessage(req,res,Number(quoteMessageMatch[1]),quoteMessageMatch[2]);
    const quoteAddLibraryMatch=url.pathname.match(/^\/api\/sales-quotes\/(\d+)\/items\/library$/);
    if(quoteAddLibraryMatch&&req.method==='POST')return await handlers.addApprovedQuoteLibraryItem(req,res,Number(quoteAddLibraryMatch[1]));
    const quoteAddCustomMatch=url.pathname.match(/^\/api\/sales-quotes\/(\d+)\/items\/custom$/);
    if(quoteAddCustomMatch&&req.method==='POST')return await handlers.addQuoteCustomItem(req,res,Number(quoteAddCustomMatch[1]));
    const quoteDuplicateMatch=url.pathname.match(/^\/api\/sales-quotes\/(\d+)\/items\/duplicate$/);
    if(quoteDuplicateMatch&&req.method==='POST')return await handlers.duplicateQuoteItem(req,res,Number(quoteDuplicateMatch[1]));
    const quoteDetailMatch=url.pathname.match(/^\/api\/sales-quotes\/(\d+)$/);
    if(quoteDetailMatch&&req.method==='GET')return handlers.salesQuoteDetail(req,res,Number(quoteDetailMatch[1]));
    if(quoteDetailMatch&&req.method==='PUT')return await handlers.updateSalesQuote(req,res,Number(quoteDetailMatch[1]));
    if (req.method === 'GET' && url.pathname === '/api/ai-brain/status') return handlers.aiBrainStatus(req, res);
    if (req.method === 'POST' && url.pathname === '/api/ai-brain/actions/run') return await handlers.runAiBrainAction(req, res);
    if (req.method === 'GET' && url.pathname === '/api/ai-cost/settings') return handlers.aiCostSettings(req, res);
    if (req.method === 'PUT' && url.pathname === '/api/ai-cost/settings') return await handlers.updateAiCostSettings(req, res);
    if (req.method === 'POST' && url.pathname === '/api/ai-cost/estimate') return await handlers.estimateAiCost(req, res);
    if (req.method === 'POST' && url.pathname === '/api/ai-cost/confirm') return await handlers.confirmAiCost(req, res);
    if (req.method === 'GET' && url.pathname === '/api/ai-cost/logs') return handlers.aiCostLogs(req, res, url);
    if (req.method === 'GET' && url.pathname === '/api/ai-cost/dashboard') return handlers.aiCostDashboard(req, res);
    if (req.method === 'GET' && url.pathname === '/api/knowledge-center/context-preview') return handlers.knowledgeContextPreview(req, res, url);
    if (req.method === 'GET' && url.pathname === '/api/knowledge-center') return handlers.knowledgeList(req, res, url);
    if (req.method === 'POST' && url.pathname === '/api/knowledge-center') return await handlers.createKnowledge(req, res);
    const knowledgeHistoryMatch = url.pathname.match(/^\/api\/knowledge-center\/(\d+)\/history$/);
    if (knowledgeHistoryMatch && req.method === 'GET') return handlers.knowledgeHistory(req, res, Number(knowledgeHistoryMatch[1]));
    const knowledgeActionMatch = url.pathname.match(/^\/api\/knowledge-center\/(\d+)\/(submit-review|approve|request-changes|mark-outdated|archive)$/);
    if (knowledgeActionMatch && req.method === 'POST') return await handlers.transitionKnowledge(req, res, Number(knowledgeActionMatch[1]), knowledgeActionMatch[2]);
    const knowledgeMatch = url.pathname.match(/^\/api\/knowledge-center\/(\d+)$/);
    if (knowledgeMatch && req.method === 'GET') return handlers.knowledgeDetail(req, res, Number(knowledgeMatch[1]));
    if (knowledgeMatch && req.method === 'PUT') return await handlers.updateKnowledge(req, res, Number(knowledgeMatch[1]));
    if (req.method === 'GET' && url.pathname === '/api/system/ai-image-provider/status') return handlers.aiImageProviderStatus(req, res);
    if (req.method === 'GET' && url.pathname === '/api/opportunity/dashboard') return handlers.opportunityDashboard(req, res);
    if (req.method === 'GET' && url.pathname === '/api/opportunity-queue') return handlers.opportunityQueue(req, res);
    if (req.method === 'GET' && url.pathname === '/api/customer-intelligence/priority') return handlers.customerIntelligencePriority(req, res);
    if (req.method === 'GET' && url.pathname === '/api/customer-discovery/config') return handlers.customerDiscoveryConfig(req, res);
    if (req.method === 'GET' && url.pathname === '/api/customer-discovery/requests') return handlers.customerDiscoveryRequests(req, res);
    if (req.method === 'POST' && url.pathname === '/api/customer-discovery/analyze') return await handlers.analyzeCustomerDiscovery(req, res, 'analyze-requirement');
    if (req.method === 'POST' && url.pathname === '/api/customer-discovery/generate-plan') return await handlers.analyzeCustomerDiscovery(req, res, 'generate-search-plan');
    if (req.method === 'GET' && url.pathname === '/api/search-strategies') return handlers.searchStrategies(req, res);
    if (req.method === 'POST' && url.pathname === '/api/search-strategies') return await handlers.createSearchStrategy(req, res);
    const strategyHistoryMatch = url.pathname.match(/^\/api\/search-strategies\/(\d+)\/history$/);
    if (strategyHistoryMatch && req.method === 'GET') return handlers.searchStrategyHistory(req, res, Number(strategyHistoryMatch[1]));
    const strategyActionMatch = url.pathname.match(/^\/api\/search-strategies\/(\d+)\/(context-preview|generate|estimate-search-cost|submit-review|approve|request-changes|archive|create-search-task)$/);
    if (strategyActionMatch && req.method === 'GET' && strategyActionMatch[2] === 'context-preview') return handlers.searchStrategyContextPreview(req, res, Number(strategyActionMatch[1]));
    if (strategyActionMatch && req.method === 'POST' && strategyActionMatch[2] === 'generate') return await handlers.generateSearchStrategy(req, res, Number(strategyActionMatch[1]));
    if (strategyActionMatch && req.method === 'POST' && strategyActionMatch[2] === 'estimate-search-cost') return await handlers.estimateSearchStrategy(req, res, Number(strategyActionMatch[1]));
    if (strategyActionMatch && req.method === 'POST' && strategyActionMatch[2] === 'create-search-task') return await handlers.createTaskFromStrategy(req, res, Number(strategyActionMatch[1]));
    if (strategyActionMatch && req.method === 'POST') return await handlers.transitionSearchStrategy(req, res, Number(strategyActionMatch[1]), strategyActionMatch[2]);
    const strategyMatch = url.pathname.match(/^\/api\/search-strategies\/(\d+)$/);
    if (strategyMatch && req.method === 'GET') return handlers.searchStrategyDetail(req, res, Number(strategyMatch[1]));
    if (strategyMatch && req.method === 'PUT') return await handlers.updateSearchStrategy(req, res, Number(strategyMatch[1]));
    if (req.method === 'GET' && url.pathname === '/api/search-tasks') return handlers.searchTasks(req, res);
    if (req.method === 'POST' && url.pathname === '/api/search-tasks') return await handlers.createSearchTask(req, res);
    const searchTaskResultsMatch = url.pathname.match(/^\/api\/search-tasks\/(\d+)\/results$/);
    if (searchTaskResultsMatch && req.method === 'GET') return handlers.searchTaskResults(req, res, Number(searchTaskResultsMatch[1]));
    if (searchTaskResultsMatch && req.method === 'POST') return await handlers.createSearchResult(req, res, Number(searchTaskResultsMatch[1]));
    const searchTaskActionMatch = url.pathname.match(/^\/api\/search-tasks\/(\d+)\/(ready)$/);
    if (searchTaskActionMatch && req.method === 'POST') return handlers.updateSearchTaskStatus(req, res, Number(searchTaskActionMatch[1]), searchTaskActionMatch[2]);
    const searchTaskMatch = url.pathname.match(/^\/api\/search-tasks\/(\d+)$/);
    if (searchTaskMatch && req.method === 'GET') return handlers.searchTaskDetail(req, res, Number(searchTaskMatch[1]));
    const searchResultActionMatch = url.pathname.match(/^\/api\/search-results\/(\d+)\/(convert|discard)$/);
    if (searchResultActionMatch && req.method === 'POST' && searchResultActionMatch[2] === 'convert') return handlers.convertSearchResult(req, res, Number(searchResultActionMatch[1]));
    if (searchResultActionMatch && req.method === 'POST' && searchResultActionMatch[2] === 'discard') return handlers.discardSearchResult(req, res, Number(searchResultActionMatch[1]));
    const searchResultMatch = url.pathname.match(/^\/api\/search-results\/(\d+)$/);
    if (searchResultMatch && req.method === 'GET') return handlers.searchResultDetail(req, res, Number(searchResultMatch[1]));
    if (searchResultMatch && req.method === 'PUT') return await handlers.updateSearchResult(req, res, Number(searchResultMatch[1]));
    if (req.method === 'GET' && url.pathname === '/api/customers/sales-handoff') return handlers.salesHandoff(req, res);
    if (req.method === 'POST' && url.pathname === '/api/customers/run-ai-selected') return await handlers.runSelectedCustomerAi(req, res);
    if (req.method === 'POST' && url.pathname === '/api/customers/import') return await handlers.importCustomers(req, res);
    if (req.method === 'GET' && url.pathname === '/api/customers') return handlers.customers(req, res, url);
    if (req.method === 'POST' && url.pathname === '/api/customers') return await handlers.createCustomer(req, res);
    const outreachActionMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/outreach-drafts\/(\d+)\/(approve|mark-sent-manually)$/);
    if (outreachActionMatch && req.method === 'POST') return await handlers.updateOutreachStatus(req, res, Number(outreachActionMatch[1]), Number(outreachActionMatch[2]), outreachActionMatch[3]);
    const outreachDraftMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/outreach-drafts\/(\d+)$/);
    if (outreachDraftMatch && req.method === 'PUT') return await handlers.updateCustomerOutreachDraft(req, res, Number(outreachDraftMatch[1]), Number(outreachDraftMatch[2]));
    const outreachDraftsMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/outreach-drafts$/);
    if (outreachDraftsMatch && req.method === 'GET') return handlers.customerOutreachDrafts(req, res, Number(outreachDraftsMatch[1]));
    if (outreachDraftsMatch && req.method === 'POST') return await handlers.createCustomerOutreachDraft(req, res, Number(outreachDraftsMatch[1]));
    const customerContactMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/contacts\/(\d+)$/);
    if (customerContactMatch && req.method === 'PUT') return await handlers.updateCustomerContact(req, res, Number(customerContactMatch[1]), Number(customerContactMatch[2]));
    const customerContactsMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/contacts$/);
    if (customerContactsMatch && req.method === 'GET') return handlers.customerContacts(req, res, Number(customerContactsMatch[1]));
    if (customerContactsMatch && req.method === 'POST') return await handlers.createCustomerContact(req, res, Number(customerContactsMatch[1]));
    const customerGapMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/gaps\/(\d+)$/);
    if (customerGapMatch && req.method === 'PUT') return await handlers.updateCustomerGap(req, res, Number(customerGapMatch[1]), Number(customerGapMatch[2]));
    const customerGapsMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/gaps$/);
    if (customerGapsMatch && req.method === 'GET') return handlers.customerGaps(req, res, Number(customerGapsMatch[1]));
    const customerRunAiMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/run-ai$/);
    if (customerRunAiMatch && req.method === 'POST') return await handlers.runCustomerAi(req, res, Number(customerRunAiMatch[1]));
    const customerIntelligenceRunMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/customer-intelligence\/run$/);
    if (customerIntelligenceRunMatch && req.method === 'POST') return await handlers.runCustomerIntelligence(req, res, Number(customerIntelligenceRunMatch[1]));
    const customerIntelligenceUpdateMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/customer-intelligence\/updates$/);
    if (customerIntelligenceUpdateMatch && req.method === 'POST') return await handlers.saveCustomerIntelligenceUpdate(req, res, Number(customerIntelligenceUpdateMatch[1]));
    const customerIntelligenceFeedbackMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/customer-intelligence\/feedback$/);
    if (customerIntelligenceFeedbackMatch && req.method === 'POST') return await handlers.saveCustomerIntelligenceFeedback(req, res, Number(customerIntelligenceFeedbackMatch[1]));
    const customerHandoffMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/sales-handoff$/);
    if (customerHandoffMatch && req.method === 'POST') return await handlers.createSalesHandoff(req, res, Number(customerHandoffMatch[1]));
    const customerAcceptMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/accept-lead$/);
    if (customerAcceptMatch && req.method === 'POST') return await handlers.acceptLead(req, res, Number(customerAcceptMatch[1]));
    const customerMatch = url.pathname.match(/^\/api\/customers\/(\d+)$/);
    if (customerMatch && req.method === 'GET') return handlers.customerDetail(req, res, Number(customerMatch[1]));
    if (customerMatch && req.method === 'PUT') return await handlers.updateCustomer(req, res, Number(customerMatch[1]));
    if(req.method==='GET'&&url.pathname==='/api/product-intelligence/products')return handlers.productIntelligenceProducts(req,res);
    const productIntelligenceQualityMatch=url.pathname.match(/^\/api\/product-intelligence\/products\/(\d+)\/quality$/);
    if(productIntelligenceQualityMatch&&req.method==='GET')return handlers.productIntelligenceProductQuality(req,res,Number(productIntelligenceQualityMatch[1]));
    const productIntelligenceContextMatch=url.pathname.match(/^\/api\/product-intelligence\/context\/products\/(\d+)$/);
    if(productIntelligenceContextMatch&&req.method==='GET')return handlers.productIntelligenceProductContext(req,res,Number(productIntelligenceContextMatch[1]));
    const productIntelligenceMatch=url.pathname.match(/^\/api\/product-intelligence\/products\/(\d+)$/);
    if(productIntelligenceMatch&&req.method==='GET')return handlers.productIntelligenceProductDetail(req,res,Number(productIntelligenceMatch[1]));
    if(req.method==='GET'&&url.pathname==='/api/product-categories')return handlers.productCategories(req,res);
    if(req.method==='POST'&&url.pathname==='/api/product-categories')return await handlers.createProductCategory(req,res);
    const productCategoryMatch=url.pathname.match(/^\/api\/product-categories\/(\d+)$/);
    if(productCategoryMatch&&req.method==='PUT')return await handlers.updateProductCategory(req,res,Number(productCategoryMatch[1]));
    if(productCategoryMatch&&req.method==='DELETE')return handlers.deleteProductCategory(req,res,Number(productCategoryMatch[1]));
    if(req.method==='GET'&&url.pathname==='/api/product-tags')return handlers.productTags(req,res);
    if(req.method==='POST'&&url.pathname==='/api/product-tags')return await handlers.createProductTag(req,res);
    const productTagMatch=url.pathname.match(/^\/api\/product-tags\/(\d+)$/);
    if(productTagMatch&&req.method==='PUT')return await handlers.updateProductTag(req,res,Number(productTagMatch[1]));
    if(productTagMatch&&req.method==='DELETE')return handlers.deleteProductTag(req,res,Number(productTagMatch[1]));
    if(req.method==='GET'&&url.pathname==='/api/product-attributes')return handlers.productAttributes(req,res);
    if(req.method==='POST'&&url.pathname==='/api/product-attributes')return await handlers.createProductAttribute(req,res);
    const productAttributeMatch=url.pathname.match(/^\/api\/product-attributes\/(\d+)$/);
    if(productAttributeMatch&&req.method==='PUT')return await handlers.updateProductAttribute(req,res,Number(productAttributeMatch[1]));
    if(productAttributeMatch&&req.method==='DELETE')return handlers.deleteProductAttribute(req,res,Number(productAttributeMatch[1]));
    if(req.method==='GET'&&url.pathname==='/api/product-variants')return handlers.productVariants(req,res);
    const productVariantMatch=url.pathname.match(/^\/api\/products\/(\d+)\/variants\/(\d+)$/);
    if(productVariantMatch&&req.method==='PUT')return await handlers.updateProductVariant(req,res,Number(productVariantMatch[1]),Number(productVariantMatch[2]));
    if(productVariantMatch&&req.method==='DELETE')return handlers.deleteProductVariant(req,res,Number(productVariantMatch[1]),Number(productVariantMatch[2]));
    const productVariantsMatch=url.pathname.match(/^\/api\/products\/(\d+)\/variants$/);
    if(productVariantsMatch&&req.method==='POST')return await handlers.createProductVariant(req,res,Number(productVariantsMatch[1]));
    const productFoundationMatch=url.pathname.match(/^\/api\/products\/(\d+)\/foundation$/);
    if(productFoundationMatch&&req.method==='PUT')return await handlers.updateProductFoundation(req,res,Number(productFoundationMatch[1]));
    if (req.method === 'GET' && url.pathname === '/api/products') return handlers.products(req, res);
    if (req.method === 'POST' && url.pathname === '/api/products') return await handlers.mutateProduct(req, res);
    if (req.method === 'GET' && url.pathname === '/api/knowledge/dashboard') return handlers.knowledgeDashboard(req, res);
    if (req.method === 'GET' && url.pathname === '/api/products/search') return handlers.searchProducts(req, res, url);
    const productGenerationMatch = url.pathname.match(/^\/api\/products\/(\d+)\/generate\/(product-info|seo|geo|faq|buying-guide)$/);
    if (productGenerationMatch && req.method === 'POST') return await handlers.generateIntelligence(req, res, Number(productGenerationMatch[1]), productGenerationMatch[2]);
    const aiDraftActionMatch = url.pathname.match(/^\/api\/products\/(\d+)\/ai-content\/drafts\/(\d+)\/(approve|reject|apply)$/);
    if (aiDraftActionMatch && req.method === 'POST') {
      const [, productId, draftId, action] = aiDraftActionMatch;
      return action === 'apply'
        ? await handlers.applyAiContentDraft(req, res, Number(productId), Number(draftId))
        : await handlers.reviewAiContentDraft(req, res, Number(productId), Number(draftId), action);
    }
    const aiDraftMatch = url.pathname.match(/^\/api\/products\/(\d+)\/ai-content\/drafts\/(\d+)$/);
    if (aiDraftMatch && req.method === 'PUT') return await handlers.updateAiContentDraft(req, res, Number(aiDraftMatch[1]), Number(aiDraftMatch[2]));
    const aiDraftsMatch = url.pathname.match(/^\/api\/products\/(\d+)\/ai-content\/drafts$/);
    if (aiDraftsMatch && req.method === 'GET') return handlers.aiContentDrafts(req, res, Number(aiDraftsMatch[1]));
    const aiGenerateMatch = url.pathname.match(/^\/api\/products\/(\d+)\/ai-content\/generate$/);
    if (aiGenerateMatch && req.method === 'POST') return await handlers.generateAiContent(req, res, Number(aiGenerateMatch[1]));
    const imageTaskActionMatch = url.pathname.match(/^\/api\/products\/(\d+)\/image-generation-tasks\/(\d+)\/(run|retry|cancel|approve|reject|apply)$/);
    if (imageTaskActionMatch && req.method === 'POST') {
      const productId = Number(imageTaskActionMatch[1]);
      const taskId = Number(imageTaskActionMatch[2]);
      const action = imageTaskActionMatch[3];
      if (action === 'run') return await handlers.runImageGenerationTask(req, res, productId, taskId);
      if (action === 'retry') return await handlers.retryImageGenerationTask(req, res, productId, taskId);
      if (action === 'cancel') return await handlers.cancelImageGenerationTask(req, res, productId, taskId);
      if (action === 'apply') return await handlers.applyImageGenerationTask(req, res, productId, taskId);
      return await handlers.reviewImageGenerationTask(req, res, productId, taskId, action);
    }
    const imageTaskMatch = url.pathname.match(/^\/api\/products\/(\d+)\/image-generation-tasks\/(\d+)$/);
    if (imageTaskMatch && req.method === 'PUT') return await handlers.updateImageGenerationTask(req, res, Number(imageTaskMatch[1]), Number(imageTaskMatch[2]));
    const runSelectedTasksMatch = url.pathname.match(/^\/api\/products\/(\d+)\/image-generation-tasks\/run-selected$/);
    if (runSelectedTasksMatch && req.method === 'POST') return await handlers.runSelectedImageTasks(req, res, Number(runSelectedTasksMatch[1]));
    const runAllTasksMatch = url.pathname.match(/^\/api\/products\/(\d+)\/image-generation-tasks\/run-all$/);
    if (runAllTasksMatch && req.method === 'POST') return await handlers.runAllImageTasks(req, res, Number(runAllTasksMatch[1]));
    const imageTasksMatch = url.pathname.match(/^\/api\/products\/(\d+)\/image-generation-tasks$/);
    if (imageTasksMatch && req.method === 'GET') return handlers.imageGenerationTasks(req, res, Number(imageTasksMatch[1]));
    if (imageTasksMatch && req.method === 'POST') return await handlers.createImageGenerationTask(req, res, Number(imageTasksMatch[1]));
    const productImageMatch = url.pathname.match(/^\/api\/products\/(\d+)\/images\/(\d+)$/);
    if (productImageMatch && req.method === 'PUT') return await handlers.updateProductImage(req, res, Number(productImageMatch[1]), Number(productImageMatch[2]));
    const productImagesMatch = url.pathname.match(/^\/api\/products\/(\d+)\/images$/);
    if (productImagesMatch && req.method === 'POST') return await handlers.createProductImage(req, res, Number(productImagesMatch[1]));
    const productKnowledgeMatch = url.pathname.match(/^\/api\/products\/(\d+)\/knowledge$/);
    if (productKnowledgeMatch && req.method === 'PUT') return await handlers.mutateKnowledge(req, res, Number(productKnowledgeMatch[1]));
    const productMatch = url.pathname.match(/^\/api\/products\/(\d+)$/);
    if (productMatch && req.method === 'GET') return handlers.productDetail(req, res, Number(productMatch[1]));
    if (productMatch && req.method === 'PUT') return await handlers.mutateProduct(req, res, Number(productMatch[1]));
    if (productMatch && req.method === 'DELETE') return handlers.deleteProduct(req, res, Number(productMatch[1]));
    if (req.method === 'GET' && url.pathname === '/api/opportunities') return handlers.opportunities(req, res);
    if (req.method === 'GET' && url.pathname === '/api/imports') return handlers.imports(req, res, url);
    if(req.method==='GET'&&url.pathname==='/api/price-rules')return handlers.priceRules(req,res);
    if(req.method==='POST'&&url.pathname==='/api/price-rules')return await handlers.createPriceRule(req,res);
    const priceRuleMatch=url.pathname.match(/^\/api\/price-rules\/(\d+)$/);if(priceRuleMatch&&req.method==='PUT')return await handlers.createPriceRule(req,res,Number(priceRuleMatch[1]));
    if(req.method==='GET'&&url.pathname==='/api/pricing/recalculate/preview')return handlers.pricingPreview(req,res,url);
    if(req.method==='POST'&&url.pathname==='/api/pricing/recalculate/apply')return await handlers.applyPricingRecalculation(req,res);
    const priceOverrideMatch=url.pathname.match(/^\/api\/products\/(\d+)\/variants\/(\d+)\/price-override$/);if(priceOverrideMatch&&req.method==='POST')return await handlers.overrideVariantPrice(req,res,Number(priceOverrideMatch[1]),Number(priceOverrideMatch[2]));
    if (req.method === 'POST' && url.pathname === '/api/imports/analyze') return await handlers.analyzeProductImportBusiness(req,res);
    const importErrorsMatch=url.pathname.match(/^\/api\/imports\/(\d+)\/errors\.xlsx$/);
    if(importErrorsMatch&&req.method==='GET')return handlers.exportProductImportErrors(req,res,Number(importErrorsMatch[1]));
    if(req.method==='POST'&&url.pathname==='/api/products/clear-demo-data')return await handlers.clearProductDemoData(req,res);
    if (req.method === 'POST' && url.pathname === '/api/imports/approve-selected') return await handlers.approveSelectedProductImports(req,res);
    if (req.method === 'POST' && url.pathname === '/api/imports/merge') return await handlers.mergeProductImportDrafts(req,res);
    const productImportSplit=url.pathname.match(/^\/api\/imports\/drafts\/(\d+)\/split$/);
    if(productImportSplit&&req.method==='POST')return await handlers.splitProductImportDraft(req,res,Number(productImportSplit[1]));
    const productImportDraftAction=url.pathname.match(/^\/api\/imports\/drafts\/(\d+)\/(approve|reject)$/);
    if(productImportDraftAction&&req.method==='POST')return await handlers.reviewProductImportDraft(req,res,Number(productImportDraftAction[1]),productImportDraftAction[2]);
    const productImportDraft=url.pathname.match(/^\/api\/imports\/drafts\/(\d+)$/);
    if(productImportDraft&&req.method==='PUT')return await handlers.updateProductImportDraft(req,res,Number(productImportDraft[1]));
    if (req.method === 'GET' && url.pathname === '/api/proposals') return handlers.proposals(req, res);
    if (req.method === 'GET' && url.pathname === '/api/team') return handlers.team(req, res);
    if (req.method === 'GET' && url.pathname === '/api/foundation') return handlers.foundation(req, res);
    const foundationMatch = url.pathname.match(/^\/api\/foundation\/(configs|tags|media|prompts)(?:\/(\d+))?$/);
    if (foundationMatch && req.method === 'POST' && !foundationMatch[2]) return await handlers.mutateFoundation(req, res, foundationMatch[1]);
    if (foundationMatch && req.method === 'PUT' && foundationMatch[2]) return await handlers.mutateFoundation(req, res, foundationMatch[1], Number(foundationMatch[2]));
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'Endpoint not found.' });
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.status ? error.message : 'The server could not complete this request.', ...(error.estimate ? { estimate: error.estimate } : {}) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
  setTimeout(initializeDatabase, databaseInitializationDelayMs);
});

function shutdown() {
  clearTimeout(databaseRetryTimer);
  server.close(() => {
    if (db) db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
