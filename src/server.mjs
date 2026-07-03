import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { PostgresSyncDatabase } from './postgres-sync.mjs';
import { aiImageProviderConfig, createAiImageProvider } from './services/ai-image-provider.mjs';
import { saveGeneratedImage } from './services/generated-image-storage.mjs';
import { createAiCostControl } from './services/ai-cost-control.mjs';
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

let db;
let aiCostControl;
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
        for (const migrationFile of ['001_initial_schema.sql', '002_product_intelligence.sql', '003_ai_product_content_factory.sql', '004_real_ai_image_generation.sql', '005_opportunity_intelligence_engine.sql', '006_ai_cost_control.sql', '007_sales_intelligence_part1.sql', '008_quote_pi_builder.sql', '009_custom_quote_items.sql', '010_global_pi_template.sql', '011_professional_pi_optimization.sql', '012_product_foundation.sql', '013_product_master_data.sql', '014_pim_foundation_upgrade.sql', '015_ai_product_import.sql', '016_product_library_business_readiness.sql', '017_product_price_engine.sql']) {
          db.exec(readFileSync(join(root, 'database', 'migrations', migrationFile), 'utf8'));
        }
      }
      const migration = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get('017_product_price_engine');
      databaseDiagnostics.migration = migration?.version === '017_product_price_engine';
      databaseDiagnostics.migrationVersion = migration?.version || null;
      if (!databaseDiagnostics.migration) throw new Error('Migration 017_product_price_engine was not recorded.');
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
      databaseDiagnostics.migration = true;
      databaseDiagnostics.migrationVersion = '017_product_price_engine';
      databaseDiagnostics.tables = db.prepare("SELECT name AS table_name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.table_name);
    }
    aiCostControl = createAiCostControl(db);
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
  if (!productCount) {
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

const sensitiveProductFields=new Set(['default_supplier','supplier_sku','supplier_cost','supplier_currency','supplier_moq','supplier_lead_time_days','supplier_notes','cost_price','converted_cost','exchange_rate','pricing_rule_id','pricing_rule','multiplier','fixed_addon','minimum_margin','purchase_cost_history','profit','profit_margin','source_supplier','cost_snapshot','cost_currency_snapshot']);
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

function variantFieldValues(body, existing = {}) {
  const text = name => String(body[name] ?? existing[name] ?? '').trim() || null;
  const number = name => body[name] === '' ? null : body[name] == null ? existing[name] ?? null : Number(body[name]);
  return [text('variant_name'),text('variant_sku'),text('dimensions'),text('material'),text('finish'),text('color'),number('reference_price'),number('cost_price'),number('moq'),number('lead_time_days'),number('cbm'),number('gross_weight_kg'),number('net_weight_kg'),text('packing_info'),text('default_supplier'),text('supplier_sku'),number('supplier_cost'),number('supplier_lead_time_days'),number('supplier_moq'),text('supplier_notes')];
}

function importCapabilities(user){return {canUpload:['Admin','Owner','VA'].includes(user?.role),canEdit:['Admin','Owner','VA'].includes(user?.role),canApprove:['Admin','Owner'].includes(user?.role)}}
function normalizeImportField(value){return String(value||'').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'')}
function importDraftRow(row){if(!row)return null;for(const field of ['mapped_product','suggested_variants','suggested_attributes','suggested_tag_ids','source_rows','source_mapping','original_values','missing_fields'])row[field]=parseJsonValue(row[field],field.includes('product')||field.includes('mapping')||field==='original_values'?{}:[]);return row}
function textSimilarity(a,b){const left=normalizeImportField(a),right=normalizeImportField(b);if(!left||!right)return 0;if(left===right)return 1;const grams=value=>new Set([...Array(Math.max(1,value.length-1))].map((_,i)=>value.slice(i,i+2))),x=grams(left),y=grams(right),hits=[...x].filter(v=>y.has(v)).length;return 2*hits/(x.size+y.size)}
function findImportDuplicate(draft){const exactSku=db.prepare('SELECT id,name,sku FROM products WHERE sku=? COLLATE NOCASE LIMIT 1').get(draft.product_sku);if(exactSku)return {...exactSku,match_type:'Internal SKU',similarity:100,suggested_action:'Update Existing'};const supplierSku=String(draft.mapped_product?.supplier_sku||'').trim();if(supplierSku){const match=db.prepare('SELECT id,name,sku FROM products WHERE supplier_sku=? COLLATE NOCASE UNION SELECT p.id,p.name,p.sku FROM product_variants pv JOIN products p ON p.id=pv.product_id WHERE pv.supplier_sku=? COLLATE NOCASE LIMIT 1').get(supplierSku,supplierSku);if(match)return {...match,match_type:'Supplier SKU',similarity:100,suggested_action:'Add Variant'}}const candidates=db.prepare('SELECT id,name,sku,size FROM products ORDER BY updated_at DESC LIMIT 1000').all().map(row=>({...row,similarity:Math.round(textSimilarity(draft.product_name,row.name)*100)})).sort((a,b)=>b.similarity-a.similarity);const match=candidates[0];return match?.similarity>=72?{...match,match_type:match.similarity>=92?'Product Name':'Name Similarity',suggested_action:match.similarity>=92?'Update Existing':'Create Product'}:null}
function redactImportDraft(draft,user){const result=redactSensitiveProductData(draft,user);if(canViewSensitiveProductData(user))return result;result.original_values={};result.source_rows=(result.source_rows||[]).map(row=>({...row,values:Object.fromEntries(Object.entries(row.values||{}).filter(([key])=>!/supplier|供应商|cost|成本|rmb|人民币|采购|进价|单价|价格/i.test(key)))}));return result}
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
  const sourceRow=Number(draft.source_rows?.[0]?.row_number||0)||null,sourceSupplier=batch?.supplier_name||mapped.default_supplier||null;
  let productId,createdProduct=0;
  if(existing&&action==='update_existing'){
    productId=existing.id;
    db.prepare(`UPDATE products SET name=?,category_id=?,materials=?,size=?,finish=?,color=?,default_supplier=?,supplier_sku=?,supplier_cost=?,supplier_lead_time_days=?,supplier_moq=?,supplier_notes=?,source_supplier=?,source_file=?,source_sheet=?,source_row=?,import_batch_id=?,imported_at=COALESCE(imported_at,CURRENT_TIMESTAMP),imported_by=COALESCE(imported_by,?),last_updated_by=?,library_status='Approved',status='approved',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(draft.product_name||existing.name,categoryId||existing.category_id,mapped.material||existing.materials,mapped.dimensions||existing.size,mapped.finish||existing.finish,mapped.color||existing.color,sourceSupplier,mapped.supplier_sku||existing.supplier_sku,mapped.supplier_cost??existing.supplier_cost,mapped.supplier_lead_time_days??existing.supplier_lead_time_days,mapped.supplier_moq??existing.supplier_moq,mapped.supplier_notes||existing.supplier_notes,sourceSupplier,batch?.source_file_name,draft.source_rows?.[0]?.sheet_name||draft.source_rows?.[0]?.sheet||null,sourceRow,draft.batch_id,user.id,user.id,productId);
  }else if(existing&&action==='add_variant')productId=existing.id;
  else{
    let sku=normalizeSku(draft.product_sku)||`IMP-${draft.batch_id}-${draft.id}`;if(db.prepare('SELECT id FROM products WHERE sku=? COLLATE NOCASE').get(sku))sku=`${sku}-${draft.id}`;
    productId=Number(db.prepare(`INSERT INTO products(category_id,sku,name,materials,size,finish,color,price_range,moq,lead_time_days,library_status,visibility,status,default_supplier,supplier_sku,supplier_cost,supplier_lead_time_days,supplier_moq,supplier_notes,source_supplier,source_file,source_sheet,source_row,import_batch_id,imported_at,imported_by,last_updated_by,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,'Approved','Website + Quote','approved',?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?,?,?) RETURNING id`).get(categoryId,sku,requiredText(draft.product_name,'Product name'),mapped.material||null,mapped.dimensions||null,mapped.finish||null,mapped.color||null,mapped.reference_price==null?null:String(mapped.reference_price),mapped.moq,mapped.lead_time_days,sourceSupplier,mapped.supplier_sku||null,mapped.supplier_cost,mapped.supplier_lead_time_days,mapped.supplier_moq,mapped.supplier_notes||null,sourceSupplier,batch?.source_file_name,draft.source_rows?.[0]?.sheet_name||draft.source_rows?.[0]?.sheet||null,sourceRow,draft.batch_id,user.id,user.id,user.id).id);createdProduct=1;
  }
  const variants=draft.suggested_variants.length?draft.suggested_variants:(action==='add_variant'?[mapped]:[]),insertVariant=db.prepare(`INSERT INTO product_variants(product_id,variant_name,variant_sku,dimensions,material,finish,color,reference_price,cost_price,moq,lead_time_days,cbm,gross_weight_kg,net_weight_kg,packing_info,default_supplier,supplier_sku,supplier_cost,supplier_lead_time_days,supplier_moq,supplier_notes,supplier_currency,exchange_rate,converted_cost,pricing_rule_id,pricing_status,pricing_confidence,status,source_supplier,source_file,source_sheet,source_row,import_batch_id,imported_at,imported_by,last_updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Active',?,?,?,?,?,CURRENT_TIMESTAMP,?,?)`);let createdVariants=0;
  for(const [index,variant] of variants.entries()){const name=variant.variant_name||variant.dimensions||draft.product_name;if(db.prepare('SELECT id FROM product_variants WHERE product_id=? AND variant_name=?').get(productId,name))continue;const row=draft.source_rows?.[index]||draft.source_rows?.[0];insertVariant.run(productId,name,variant.variant_sku||null,variant.dimensions||null,variant.material||mapped.material||null,variant.finish||mapped.finish||null,variant.color||mapped.color||null,variant.reference_price,variant.cost_price,variant.moq,variant.lead_time_days,variant.cbm,variant.gross_weight_kg,variant.net_weight_kg,variant.packing_info||null,sourceSupplier,variant.supplier_sku||mapped.supplier_sku||null,variant.supplier_cost??mapped.supplier_cost,variant.supplier_lead_time_days??mapped.supplier_lead_time_days,variant.supplier_moq??mapped.supplier_moq,mapped.supplier_notes||null,variant.supplier_currency||mapped.supplier_currency||batch?.supplier_currency,variant.exchange_rate||mapped.exchange_rate||batch?.exchange_rate,variant.converted_cost??mapped.converted_cost,variant.pricing_rule_id??mapped.pricing_rule_id,variant.pricing_status||mapped.pricing_status||'Needs Pricing Review',variant.pricing_confidence??mapped.pricing_confidence,sourceSupplier,batch?.source_file_name,row?.sheet_name||row?.sheet||null,Number(row?.row_number||0)||null,draft.batch_id,user.id,user.id);createdVariants++}
  for(const attribute of draft.suggested_attributes){const definition=db.prepare('SELECT id FROM product_attribute_definitions WHERE id=?').get(Number(attribute.attribute_id));if(definition&&String(attribute.value||'').trim())db.prepare('INSERT OR REPLACE INTO product_attribute_values(product_id,attribute_id,value) VALUES(?,?,?)').run(productId,definition.id,String(attribute.value).trim())}
  if(draft.main_image_url){const mediaId=Number(db.prepare(`INSERT INTO media_assets(file_name,file_type,file_url,related_module,related_record_id,media_category,is_verified,image_type,image_status,active,created_by) VALUES(?,? ,?,'products',?,'Product Photo',1,'Main Image','Approved',1,?) RETURNING id`).get(`Imported image ${draft.id}`,'image/png',draft.main_image_url,String(productId),user.id).id);db.prepare('INSERT INTO product_media_links(product_id,media_id,is_primary) VALUES(?,?,1)').run(productId,mediaId)}
  db.prepare("UPDATE product_import_drafts SET status='Imported',resolution_action=?,approved_by=?,approved_at=CURRENT_TIMESTAMP,imported_product_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(action,user.id,productId,draftId);db.prepare("UPDATE product_import_batches SET created_products=created_products+?,created_variants=created_variants+?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(createdProduct,createdVariants,draft.batch_id);return {productId,createdVariants}
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
function quoteMessage(quote,type){const name=quote.customer_name||'Customer';const itemSummary=quote.all_items.map(item=>`${item.name} × ${item.quantity}`).join(', ');const total=`${quote.currency} ${Number(quote.summary.grand_total).toFixed(2)}`;if(type==='whatsapp')return {message:`Hello ${name},\n\nThank you for your inquiry.\n\nYour Proforma Invoice ${quote.quote_number} is ready. Grand Total: ${total}. Items: ${itemSummary}. Please find the attached PI.\n\nIf you have any questions, please let us know.\n\nBest regards,\n${quote.salesperson||'Sales Team'}`};return {subject:`Proforma Invoice ${quote.quote_number} — ${total}`,body:`Dear ${name},\n\nThank you for your inquiry. Please find attached our Proforma Invoice ${quote.quote_number} for ${itemSummary}.\n\nGrand Total: ${total}\nValid Until: ${quote.valid_until||'the date shown in the PI'}\n\nPlease let us know if you need any clarification or adjustment.\n\nBest regards,\n${quote.salesperson||'Sales Team'}\n${quote.salesperson_email||''}`};}
function simplePdf(text){const escape=line=>String(line).replace(/[()\\]/g,'\\$&').replace(/[^\x20-\x7E]/g,'?').slice(0,110);const source=String(text).split('\n');const pages=[];for(let index=0;index<source.length;index+=43)pages.push(source.slice(index,index+43));const fontRegular=3,fontBold=4;const pageIds=pages.map((_,index)=>5+index*2);const objects=[];objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;objects[fontRegular]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';objects[fontBold]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';pages.forEach((lines,index)=>{const pageId=pageIds[index],contentId=pageId+1;const commands=lines.map((line,lineIndex)=>{const heading=/^(PROFORMA INVOICE|COMPANY INFORMATION|PI HEADER|BUYER INFORMATION|PRODUCT TABLE|PACKING \/ LOGISTICS SUMMARY|COMMERCIAL SUMMARY|PAYMENT TERMS|BANK INFORMATION|SHIPPING INFORMATION|REMARKS|TERMS & CONDITIONS|SIGNATURES)$/.test(line);return `${lineIndex?'0 -17 Td ':''}${heading?'/F2 11 Tf 0 .28 .20 rg':'/F1 8 Tf 0 0 0 rg'} (${escape(line)}) Tj`;}).join(' ');const stream=`BT 42 805 Td ${commands} ET`;objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`;objects[contentId]=`<< /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream`;});const header='%PDF-1.4\n';let body=header,offset=Buffer.byteLength(header);const xref=['0000000000 65535 f '];for(let id=1;id<objects.length;id++){const object=`${id} 0 obj ${objects[id]} endobj\n`;xref[id]=String(offset).padStart(10,'0')+' 00000 n ';body+=object;offset+=Buffer.byteLength(object)}const startxref=offset;body+=`xref\n0 ${objects.length}\n${xref.join('\n')}\ntrailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;return Buffer.from(body);}

function globalPiRows(quote){const company=quote.company_settings||{},bank=quote.selected_bank_account,s=quote.summary,tbc=value=>value==null?'TBC':Number(value).toFixed(2),blank=value=>String(value||'____________________________'),amount=value=>`${quote.currency} ${Number(value||0).toFixed(2)}`;const rows=[];const section=title=>rows.push([title]);rows.push(['PROFORMA INVOICE']);section('COMPANY INFORMATION');rows.push(['Company Name',company.company_name||''],['Address',company.address||''],['City / State / ZIP',company.city_state_zip||''],['Country',company.country||''],['Phone',company.phone||''],['Email',company.email||''],['Website',company.website||''],['Tax ID / Registration No.',company.registration_no||'']);section('PI HEADER');rows.push(['PI No.',quote.quote_number,'Issue Date',quote.quote_date||'','Valid Until',quote.valid_until||''],['Sales Representative',quote.salesperson||'','Currency',quote.currency,'Trade Term',quote.trade_term||''],['Payment Terms Summary',`${quote.deposit_percent}% deposit / ${quote.balance_percent}% balance`,'Buyer Reference No.',quote.buyer_reference_no||'','Project Name',quote.project_name||'']);section('BUYER INFORMATION');rows.push(['Customer / Restaurant Name',blank(quote.customer_name),'Company Name',blank(quote.company||quote.customer_name)],['Contact Person',blank(quote.contact_person),'Phone / WhatsApp',blank(quote.buyer_phone)],['Email',blank(quote.buyer_email),'Country',blank(quote.country)],['Billing Address',blank(quote.billing_address),'Delivery Address',blank(quote.destination_address||quote.destination)]);section('PRODUCT TABLE');rows.push(['No.','Product Image','SKU / Item Code','Product Name / Description','Material / Finish','Dimensions','Color / Upholstery','Qty','Unit Price','Amount','Remarks']);quote.all_items.forEach((item,index)=>{rows.push([index+1,item.image_url||'Reference image pending',item.sku||'CUSTOM',`${item.name}${item.specification?` — ${item.specification}`:''}`,[item.materials,item.finish].filter(Boolean).join(' / '),item.size||'',item.color||'',item.quantity,amount(item.unit_price),amount(item.line_total),item.remark||'']);rows.push(['','','','Logistics',`CBM ${tbc(item.cbm)}`,`Gross Weight ${tbc(item.gross_weight_kg)} kg`,`Net Weight ${tbc(item.net_weight_kg)} kg`,'',`Lead Time ${item.lead_time_days?`${item.lead_time_days} days`:'TBC'}`,'Packaging TBC','']);});section('PACKING / LOGISTICS SUMMARY');rows.push(['Total Quantity',s.total_quantity],['Total Packages / Cartons',quote.total_packages??'TBC'],['Total CBM',tbc(s.total_cbm)],['Total Gross Weight',tbc(s.total_gross_weight)],['Total Net Weight',tbc(s.total_net_weight)]);section('COMMERCIAL SUMMARY');rows.push(['Product Subtotal',amount(s.product_subtotal)],['Discount',amount(s.discount)],['Freight Cost',s.freight_cost==null?'Freight cost to be quoted separately.':amount(s.freight_cost)],['Other Charges',amount(s.other_charges)],['Grand Total',amount(s.grand_total)],['Deposit Amount',amount(s.deposit_amount)],['Balance Amount',amount(s.balance_amount)]);section('PAYMENT TERMS');rows.push([quote.payment_note||`${quote.deposit_percent}% deposit before production. ${quote.balance_percent}% balance before shipment.`],['Payment Method',quote.payment_method||'TT Bank Transfer']);section('BANK INFORMATION');if(bank)rows.push(['Beneficiary Name',bank.beneficiary_name||''],['Bank Name',bank.bank_name||''],['Bank Address',bank.bank_address||''],['Account Number',bank.account_number||''],['SWIFT / BIC',bank.swift_bic||''],['Routing Number',bank.routing_number||''],['IBAN',bank.iban||''],['Bank Country',bank.bank_country||''],['Payment Currency',bank.payment_currency||'']);else rows.push(['Bank information to be provided separately.']);section('SHIPPING INFORMATION');rows.push(['Trade Term',blank(quote.trade_term)],['Shipping Method',blank(quote.shipping_method)],['Origin Port',blank(quote.origin_port)],['Destination Port',blank(quote.destination_port)],['Delivery Address',blank(quote.destination_address||quote.destination)],['Estimated Production Time',blank(quote.production_time)],['Estimated Shipping Time',blank(quote.transit_time)],['Freight Remark',blank(quote.freight_remark)]);section('REMARKS');rows.push([blank(quote.other_remark)]);if(quote.special_terms)rows.push(['Special Terms',quote.special_terms]);section('TERMS & CONDITIONS');quote.pi_terms.forEach((term,index)=>rows.push([`${index+1}. ${term}`]));section('SIGNATURES');rows.push(['Prepared By',blank(quote.salesperson)],['Approved By','Company Representative / Signature'],['Buyer Confirmation','Name / Signature / Date'],['Company Stamp','']);return rows;}

function wrapPiExportLine(line,max=92){const words=String(line).split(/\s+/);const lines=[];let current='';for(const word of words){if(`${current} ${word}`.trim().length>max&&current){lines.push(current);current=`  ${word}`}else current=`${current} ${word}`.trim()}if(current)lines.push(current);return lines.length?lines:['']}
function globalPiPdf(text){const escape=line=>String(line).replace(/[()\\]/g,'\\$&').replace(/[^\x20-\x7E]/g,'?');const source=String(text).split('\n').flatMap(line=>wrapPiExportLine(line));const pages=[];for(let index=0;index<source.length;index+=43)pages.push(source.slice(index,index+43));const objects=[];const pageIds=pages.map((_,index)=>5+index*2);objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';pages.forEach((lines,index)=>{const pageId=pageIds[index],contentId=pageId+1;const stream=`BT 42 805 Td ${lines.map((line,lineIndex)=>{const heading=/^(PROFORMA INVOICE|COMPANY INFORMATION|PI HEADER|BUYER INFORMATION|PRODUCT TABLE|PACKING \/ LOGISTICS SUMMARY|COMMERCIAL SUMMARY|PAYMENT TERMS|BANK INFORMATION|SHIPPING INFORMATION|REMARKS|TERMS & CONDITIONS|SIGNATURES)$/.test(line);return `${lineIndex?'0 -17 Td ':''}${heading?'/F2 11 Tf 0 .28 .20 rg':'/F1 8 Tf 0 0 0 rg'} (${escape(line)}) Tj`}).join(' ')} ET`;objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;objects[contentId]=`<< /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream`});const header='%PDF-1.4\n';let body=header,offset=Buffer.byteLength(header);const xref=['0000000000 65535 f '];for(let id=1;id<objects.length;id++){const object=`${id} 0 obj ${objects[id]} endobj\n`;xref[id]=String(offset).padStart(10,'0')+' 00000 n ';body+=object;offset+=Buffer.byteLength(object)}const startxref=offset;body+=`xref\n0 ${objects.length}\n${xref.join('\n')}\ntrailer << /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;return Buffer.from(body)}

function piMoney(value,currency='USD'){return `${currency} ${new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value||0))}`}
function piDescription(item){return [item.name,item.size,item.display_material,item.display_finish,item.display_color].filter((value,index,array)=>value&&array.indexOf(value)===index).join(' / ')}
function professionalPiRows(quote){
  const company=quote.company_settings||{},bank=quote.selected_bank_account,s=quote.summary;
  const blank=value=>String(value||'____________________________');
  const tbc=value=>value==null?'TBC':new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(Number(value));
  const rows=[['PROFORMA INVOICE'],['COMPANY INFORMATION']];
  rows.push(['Company Name',company.company_name||''],['Address',company.address||''],['City / State / ZIP',company.city_state_zip||''],['Country',company.country||''],['Phone',company.phone||''],['Email',company.email||''],['Website',company.website||''],['Tax ID / Registration No.',company.registration_no||'']);
  rows.push(['PI HEADER'],['PI No.',quote.quote_number,'Issue Date',quote.quote_date||'','Valid Until',quote.valid_until||''],['Sales Representative',quote.salesperson||'','Currency',quote.currency,'Trade Term',quote.trade_term||''],['Payment Terms Summary',`${quote.deposit_percent}% deposit / ${quote.balance_percent}% balance`,'Buyer Reference No.',quote.buyer_reference_no||'','Project Name',quote.project_name||'']);
  rows.push(['BUYER INFORMATION'],['Customer / Restaurant Name',blank(quote.customer_name),'Company Name',blank(quote.company||quote.customer_name)],['Contact Person',blank(quote.contact_person),'Phone / WhatsApp',blank(quote.buyer_phone)],['Email',blank(quote.buyer_email),'Country',blank(quote.country)],['Billing Address',blank(quote.billing_address),'Delivery Address',blank(quote.destination_address||quote.destination)]);
  rows.push(['PRODUCT TABLE'],['Product Image','SKU','Description','Qty','Unit Price','Amount']);
  for(const item of quote.all_items) rows.push([item.image_url||'Reference image pending',item.sku||'CUSTOM',[piDescription(item),item.swatch_image_url?`Finish / Color swatch: ${item.swatch_image_url}`:'',item.customer_remark?`Customer remark: ${item.customer_remark}`:''].filter(Boolean).join(' | '),item.quantity,piMoney(item.unit_price,quote.currency),piMoney(item.line_total,quote.currency)]);
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
  const headings=new Set(['PROFORMA INVOICE','COMPANY INFORMATION','PI HEADER','BUYER INFORMATION','PRODUCT TABLE','PACKING SUMMARY','COMMERCIAL SUMMARY','PAYMENT TERMS','BANK INFORMATION','SHIPPING INFORMATION','REMARKS','TERMS & CONDITIONS','SIGNATURES']);
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
  const lastError = db.prepare("SELECT error_message FROM customer_ai_analysis_runs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1").get()?.error_message || null;
  return {
    customers_count: count('customers'), contacts_count: count('customer_contacts'), gaps_open: openGaps,
    outreach_drafts_count: count('customer_outreach_drafts'), opportunity_queue_count: queue, last_ai_run_at: lastRun,
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

function mappedCustomer(row) {
  if (!row) return null;
  return { ...row, source_confidence: Number(row.source_confidence || 0), confidence_score: Number(row.confidence_score || 0) };
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
    for (const [parameter, column] of [['grade', 'opportunity_grade'], ['status', 'opportunity_status'], ['source', 'source']]) {
      const value = String(url.searchParams.get(parameter) || '').trim();
      if (value) { where.push(`customers.${column} = ?`); params.push(value); }
    }
    const rows = db.prepare(`SELECT customers.*, users.name AS assigned_sales_name,
      (SELECT COUNT(*) FROM customer_contacts cc WHERE cc.customer_id = customers.id AND cc.is_primary_decision_maker = TRUE) AS decision_maker_count,
      (SELECT COUNT(*) FROM customer_data_gaps cg WHERE cg.customer_id = customers.id AND cg.status = 'Open') AS open_gap_count
      FROM customers LEFT JOIN users ON users.id = customers.assigned_sales_id WHERE ${where.join(' AND ')}
      ORDER BY customers.opportunity_score DESC, customers.updated_at DESC LIMIT 1000`).all(...params).map(row => ({ ...mappedCustomer(row), recommended_categories: customerRecommendationNames(row.id).join(', ') }));
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
      const drafts=analyzeSpreadsheet(parsed,{filename,defaultCategoryName:defaultCategory?.name,currency:b.supplier_currency,exchangeRate:Number(b.exchange_rate||0),supplierName:b.supplier_name});
      const assetDir=join(publicDir,'imports',String(id));mkdirSync(assetDir,{recursive:true});
      const assetUrls=parsed.images.map((image,index)=>{const safe=`${index+1}-${String(image.name).replace(/[^a-zA-Z0-9._-]/g,'_')}`;writeFileSync(join(assetDir,safe),image.data);return `/imports/${id}/${safe}`});
      const insert=db.prepare(`INSERT INTO product_import_drafts(batch_id,status,product_name,product_sku,suggested_category_id,mapped_product,suggested_variants,suggested_attributes,source_rows,source_mapping,original_values,product_group_confidence,variant_confidence,attribute_mapping_confidence,image_matching_confidence,missing_fields,image_status,main_image_url,possible_match_product_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      drafts.forEach((draft,index)=>{
        draft.mapped_product={...draft.mapped_product,default_supplier:b.supplier_name||draft.mapped_product.default_supplier||null,source_supplier_code:b.supplier_code||null,supplier_currency:b.supplier_currency||draft.mapped_product.currency||null,exchange_rate:b.exchange_rate?Number(b.exchange_rate):null,import_notes:b.import_remark||null};
        const category=db.prepare('SELECT id FROM product_categories WHERE name=?').get(draft.category),categoryId=category?.id||null;
        const attributes=categoryId?db.prepare(`SELECT pad.id,pad.name,pad.code FROM product_attribute_definitions pad JOIN product_attribute_category_links pacl ON pacl.attribute_id=pad.id WHERE pacl.category_id=? AND pad.active=1`).all(categoryId).map(attribute=>{const key=Object.keys(draft.mapped_product).find(field=>normalizeImportField(field)===normalizeImportField(attribute.name));return key&&draft.mapped_product[key]?{attribute_id:attribute.id,name:attribute.name,value:draft.mapped_product[key]}:null}).filter(Boolean):[];
        const pricing=calculateReferencePrice({supplierCost:draft.mapped_product.supplier_cost??draft.mapped_product.cost_price,supplierCurrency:draft.mapped_product.supplier_currency||'USD',exchangeRate:draft.mapped_product.exchange_rate||1,supplier:draft.mapped_product.default_supplier,categoryId,currency:'USD'});draft.mapped_product={...draft.mapped_product,reference_price:pricing.reference_price??draft.mapped_product.reference_price??null,converted_cost:pricing.converted_cost,pricing_rule_id:pricing.rule?.id||null,pricing_rule_applied:pricing.rule?.rule_name||null,pricing_status:pricing.pricing_status,pricing_confidence:pricing.pricing_confidence};draft.variants=draft.variants.map(variant=>{const result=calculateReferencePrice({supplierCost:variant.cost_price??draft.mapped_product.supplier_cost,supplierCurrency:draft.mapped_product.supplier_currency||'USD',exchangeRate:draft.mapped_product.exchange_rate||1,supplier:draft.mapped_product.default_supplier,categoryId,currency:'USD'});return {...variant,reference_price:result.reference_price??variant.reference_price??null,converted_cost:result.converted_cost,pricing_rule_id:result.rule?.id||null,pricing_rule_applied:result.rule?.rule_name||null,pricing_status:result.pricing_status,pricing_confidence:result.pricing_confidence,supplier_currency:draft.mapped_product.supplier_currency,exchange_rate:draft.mapped_product.exchange_rate}});
        const image=assetUrls[index]||null,missing=[...draft.missing_fields,...(!image?['Image Assets Needed']:[]),...(pricing.rule?[]:['Needs Pricing Review'])],duplicate=findImportDuplicate(draft);
        insert.run(id,missing.some(value=>value!=='Image Assets Needed')?'Needs Review':draft.status,draft.product_name,draft.product_sku,categoryId,JSON.stringify({...draft.mapped_product,duplicate_match:duplicate}),JSON.stringify(draft.variants),JSON.stringify(attributes),JSON.stringify(draft.source_rows),JSON.stringify(draft.source_mapping),JSON.stringify(draft.original_values),draft.product_group_confidence,draft.variant_confidence,draft.attribute_mapping_confidence,image?75:0,JSON.stringify(missing),image?'Embedded Image Extracted':'Image Assets Needed',image,duplicate?.id||null);
        if(missing.some(value=>value!=='Image Assets Needed'))for(const row of draft.source_rows)db.prepare('INSERT INTO product_import_errors(batch_id,source_row,product_name,reason,suggested_fix) VALUES(?,?,?,?,?)').run(id,row.row_number||null,draft.product_name,`Missing: ${missing.filter(value=>value!=='Image Assets Needed').join(', ')}`,'Complete the highlighted draft fields before approval.');
      });
      const columns=[...new Set(drafts.flatMap(draft=>Object.values(draft.source_mapping).map(item=>item.source)))];
      db.prepare("UPDATE product_import_batches SET status='Draft Review',detected_columns=?,analysis_summary=?,total_rows=?,draft_count=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(columns),JSON.stringify({detected_products:drafts.length,detected_variants:drafts.reduce((sum,draft)=>sum+draft.variants.length,0),images:assetUrls.length}),drafts.reduce((sum,draft)=>sum+draft.source_rows.length,0),drafts.length,id);
      return json(res,201,{batch:importBatchDetail(id,user)});
    }catch(error){db.prepare('INSERT INTO product_import_errors(batch_id,reason,suggested_fix) VALUES(?,?,?)').run(id,String(error.message).slice(0,2000),'Check the spreadsheet format and retry.');db.prepare("UPDATE product_import_batches SET status='Failed',error_count=1,error_message=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(error.message).slice(0,2000),id);return json(res,400,{error:error.message,batch:importBatchDetail(id,user)})}
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
    const demoSkus=['CHR-1042','TBL-2086','BTH-3018','OUT-4044','ST-CA-001'],ids=db.prepare(`SELECT id FROM products WHERE sku IN (${demoSkus.map(()=>'?').join(',')})`).all(...demoSkus).map(row=>Number(row.id));
    const counts={products:ids.length,variants:0,drafts:0,batches:0,relatedProducts:0};
    db.exec('BEGIN IMMEDIATE');try{
      if(ids.length){const placeholders=ids.map(()=>'?').join(',');counts.variants=Number(db.prepare(`SELECT COUNT(*) AS count FROM product_variants WHERE product_id IN (${placeholders})`).get(...ids).count);counts.relatedProducts=Number(db.prepare(`SELECT COUNT(*) AS count FROM product_foundation_relationships WHERE source_product_id IN (${placeholders}) OR target_product_id IN (${placeholders})`).get(...ids,...ids).count);db.prepare(`DELETE FROM sales_inquiry_products WHERE product_id IN (${placeholders})`).run(...ids);db.prepare(`DELETE FROM sales_quote_items WHERE product_id IN (${placeholders})`).run(...ids);db.prepare(`DELETE FROM sales_order_items WHERE product_id IN (${placeholders})`).run(...ids);db.prepare(`DELETE FROM products WHERE id IN (${placeholders})`).run(...ids)}
      const batchIds=db.prepare("SELECT id FROM product_import_batches WHERE LOWER(COALESCE(import_remark,''))='demo' OR LOWER(source_file_name) LIKE 'demo-%'").all().map(row=>Number(row.id));if(batchIds.length){const placeholders=batchIds.map(()=>'?').join(',');counts.drafts=Number(db.prepare(`SELECT COUNT(*) AS count FROM product_import_drafts WHERE batch_id IN (${placeholders})`).get(...batchIds).count);counts.batches=batchIds.length;db.prepare(`DELETE FROM product_import_batches WHERE id IN (${placeholders})`).run(...batchIds)}db.prepare("DELETE FROM import_jobs WHERE filename IN ('Outdoor-furniture-collection.xlsx','Booth-seating-price-list.xlsx')").run();db.exec('COMMIT');
    }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error}audit(user.id,'clear_demo_data','products','demo',counts);return json(res,200,{cleared:true,counts,message:'Demo Product Library data cleared. Master data and settings were preserved.'});
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
    const index = readFileSync(join(publicDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(index);
  }
  const contentTypes = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8'
  };
  const cache = extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream', 'Cache-Control': cache });
  res.end(readFileSync(filePath));
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
        aiCostControl: aiCostDebugData(),
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
    if (req.method === 'GET' && url.pathname === '/api/ai-cost/settings') return handlers.aiCostSettings(req, res);
    if (req.method === 'PUT' && url.pathname === '/api/ai-cost/settings') return await handlers.updateAiCostSettings(req, res);
    if (req.method === 'POST' && url.pathname === '/api/ai-cost/estimate') return await handlers.estimateAiCost(req, res);
    if (req.method === 'POST' && url.pathname === '/api/ai-cost/confirm') return await handlers.confirmAiCost(req, res);
    if (req.method === 'GET' && url.pathname === '/api/ai-cost/logs') return handlers.aiCostLogs(req, res, url);
    if (req.method === 'GET' && url.pathname === '/api/ai-cost/dashboard') return handlers.aiCostDashboard(req, res);
    if (req.method === 'GET' && url.pathname === '/api/system/ai-image-provider/status') return handlers.aiImageProviderStatus(req, res);
    if (req.method === 'GET' && url.pathname === '/api/opportunity/dashboard') return handlers.opportunityDashboard(req, res);
    if (req.method === 'GET' && url.pathname === '/api/opportunity-queue') return handlers.opportunityQueue(req, res);
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
    const customerHandoffMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/sales-handoff$/);
    if (customerHandoffMatch && req.method === 'POST') return await handlers.createSalesHandoff(req, res, Number(customerHandoffMatch[1]));
    const customerAcceptMatch = url.pathname.match(/^\/api\/customers\/(\d+)\/accept-lead$/);
    if (customerAcceptMatch && req.method === 'POST') return await handlers.acceptLead(req, res, Number(customerAcceptMatch[1]));
    const customerMatch = url.pathname.match(/^\/api\/customers\/(\d+)$/);
    if (customerMatch && req.method === 'GET') return handlers.customerDetail(req, res, Number(customerMatch[1]));
    if (customerMatch && req.method === 'PUT') return await handlers.updateCustomer(req, res, Number(customerMatch[1]));
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
