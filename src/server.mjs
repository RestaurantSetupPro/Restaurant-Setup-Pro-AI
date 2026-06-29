import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { PostgresSyncDatabase } from './postgres-sync.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const publicDir = join(root, 'public');
const databasePath = resolve(root, process.env.DATABASE_PATH || 'data/restaurant-setup-pro.db');
const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const sessionHours = Number(process.env.SESSION_HOURS || 12);
const seedPassword = process.env.SEED_PASSWORD || 'Welcome123!';

let db;
let databaseStatus = 'starting';
let databaseInitializationError;

function initializeDatabase() {
  try {
    if (databaseUrl) {
      db = new PostgresSyncDatabase(databaseUrl, { ssl: process.env.DATABASE_SSL !== 'false' });
      if (process.env.RUN_MIGRATIONS !== 'false') db.exec(readFileSync(join(root, 'database', 'migrations', '001_initial_schema.sql'), 'utf8'));
    } else {
      mkdirSync(dirname(databasePath), { recursive: true });
      db = new DatabaseSync(databasePath);
      db.exec(readFileSync(join(root, 'database', 'schema.sql'), 'utf8'));
      ensureProductColumns();
    }
    seedDatabase();
    databaseStatus = 'ready';
    databaseInitializationError = undefined;
    console.log(`Database ready (${databaseUrl ? 'PostgreSQL' : 'SQLite'})`);
  } catch (error) {
    databaseStatus = 'error';
    databaseInitializationError = error;
    console.error(`Database initialization failed: ${error.message}`);
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
    knowledge_prompt: 'TEXT'
  };
  for (const [name, type] of Object.entries(columns)) {
    if (!existing.has(name)) db.exec(`ALTER TABLE products ADD COLUMN ${name} ${type}`);
  }
}

const rolePermissions = Object.freeze({
  Admin: ['dashboard', 'products', 'knowledge-dashboard', 'imports', 'images', 'proposals', 'cases', 'crm', 'sales-ai', 'content-ai', 'core-foundation', 'settings'],
  Owner: ['dashboard', 'products', 'knowledge-dashboard', 'imports', 'images', 'proposals', 'cases', 'crm', 'sales-ai', 'content-ai', 'core-foundation', 'settings'],
  Sales: ['dashboard', 'products', 'knowledge-dashboard', 'images', 'proposals', 'cases', 'crm', 'sales-ai', 'content-ai', 'core-foundation'],
  Designer: ['dashboard', 'products', 'knowledge-dashboard', 'images', 'proposals', 'cases', 'content-ai', 'core-foundation'],
  VA: ['dashboard', 'products', 'knowledge-dashboard', 'imports', 'cases', 'crm', 'content-ai', 'core-foundation']
});

const foundationTypes = Object.freeze({
  configs: ['Product Categories', 'Store Types', 'Styles', 'Materials', 'Colors', 'Countries', 'States / Regions', 'Currencies', 'Units', 'Lead Time Options', 'Product Status Options', 'Proposal Status Options', 'CRM Signal Types', 'CRM Contact Priority', 'Content Status Options'],
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
  'Counter / Service Bar': 'CT'
});
const skuStyleCodes = Object.freeze({
  California: 'CA', Japandi: 'JP', Industrial: 'IN', Luxury: 'LX', Modern: 'MD', Minimalist: 'MN'
});
const productTagTypes = Object.freeze(['Store Type Tags', 'Style Tags', 'Business Tags']);
const knowledgeTermSeeds = Object.freeze({
  store_type: ['Coffee Shop', 'Restaurant', 'Bubble Tea', 'Bakery Cafe', 'Bar', 'Fast Casual', 'Hotel', 'Food Court'],
  style: ['California', 'Japandi', 'Industrial', 'Modern', 'Luxury', 'Minimalist', 'Mediterranean', 'Scandinavian'],
  feature: ['Commercial Grade', 'Outdoor', 'Easy Cleaning', 'Fire Resistant', 'Custom Upholstery', 'Quick Production', 'DDP Available', 'High Traffic', 'Space Saving', 'AI Recommendation'],
  customer_type: ['New Store', 'Expansion', 'Remodel', 'Chain Brand', 'Design Firm', 'Mature Store']
});

const demoUsers = [
  ['Avery Brooks', 'admin@rspro.ai', 'Admin', 'AB'],
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

  const adminId = db.prepare("SELECT id FROM users WHERE role = 'Admin'").get().id;
  const salesId = db.prepare("SELECT id FROM users WHERE role = 'Sales'").get().id;
  const ownerId = db.prepare("SELECT id FROM users WHERE role = 'Owner'").get().id;

  const configSeeds = {
    'Product Categories': ['Booth Seating', 'Dining Chair', 'Restaurant Table', 'Bar Stool', 'Outdoor Furniture', 'Partition / Divider', 'Counter / Service Bar'],
    'Store Types': ['Coffee Shop', 'Bubble Tea', 'Restaurant', 'Bar', 'Bakery Cafe', 'Fast Casual', 'Japanese Restaurant'],
    Styles: ['California', 'Japandi', 'Industrial', 'Luxury', 'Minimalist', 'Modern', 'Mediterranean', 'Scandinavian'],
    Materials: ['Solid Wood', 'Plywood', 'Metal', 'Stainless Steel', 'PU Leather', 'Fabric', 'Laminate', 'Marble Look', 'Stone Top'],
    Currencies: ['USD', 'CNY', 'MYR', 'THB'],
    Units: ['mm', 'cm', 'inch', 'sqft', 'sqm', 'CBM'],
    'CRM Signal Types': ['Expansion', 'New Store', 'Remodel', 'Mature Store', 'Chain Brand', 'Design Firm']
  };
  const insertConfig = db.prepare('INSERT OR IGNORE INTO system_configs (config_type, name, code, sort_order, active, is_system, created_by) VALUES (?, ?, ?, ?, 1, 1, ?)');
  for (const [type, names] of Object.entries(configSeeds)) {
    names.forEach((name, index) => insertConfig.run(type, name, makeCode(name), index + 1, adminId));
  }

  const tagSeeds = {
    'Store Type Tags': ['Coffee Shop', 'Bubble Tea', 'Restaurant', 'Bar', 'Fast Casual', 'Japanese Restaurant', 'Bakery Cafe'],
    'Style Tags': ['California', 'Japandi', 'Industrial', 'Luxury', 'Minimalist', 'Modern', 'Mediterranean', 'Scandinavian'],
    'Business Tags': ['Budget Friendly', 'Custom Size', 'Quick Production', 'DDP Available', 'Modular', 'Premium', 'Outdoor'],
    'Product Feature Tags': ['Booth Seating', 'Space Saving', 'High Traffic', 'Easy Cleaning', 'Custom Upholstery', 'Commercial Grade'],
    'Customer Signal Tags': ['New Store', 'Expansion', 'Remodel', 'Mature Store', 'Chain Brand', 'Design Firm']
  };
  const insertTag = db.prepare('INSERT OR IGNORE INTO system_tags (tag_name, tag_type, code, active, is_system, created_by) VALUES (?, ?, ?, 1, 1, ?)');
  for (const [type, names] of Object.entries(tagSeeds)) {
    names.forEach(name => insertTag.run(name, type, `TAG-${makeCode(name)}`, adminId));
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
    const insertProduct = db.prepare('INSERT INTO products (category_id, sku, name, summary, materials, lead_time_days, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
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
    const insertMedia = db.prepare('INSERT INTO media_assets (file_name, file_type, file_url, related_module, related_record_id, media_category, is_verified, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?)');
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
    if (body.length > 1_000_000) throw new Error('Request body too large');
  }
  return body ? JSON.parse(body) : {};
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
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

function productWithTags(id) {
  const product = db.prepare(`
    SELECT products.*, product_categories.name AS category
    FROM products LEFT JOIN product_categories ON product_categories.id = products.category_id
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
  product.knowledge_score = knowledgeScore(product);
  return product;
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
  const keywordRows = db.prepare('SELECT keyword_type, keyword FROM product_keywords WHERE product_id = ? ORDER BY keyword_type, keyword').all(id);
  product.ai_keywords = keywordRows.filter(row => row.keyword_type === 'ai').map(row => row.keyword);
  product.ai_search_keywords = keywordRows.filter(row => row.keyword_type === 'search').map(row => row.keyword);
  product.missing_knowledge = [!product.media_count && 'media', !product.size && 'size', !product.materials && 'material', !product.case_count && 'cases', !product.related_count && 'related_products', !product.knowledge_prompt && 'prompt'].filter(Boolean);
  return product;
}

function knowledgeOptions(productId = 0) {
  return {
    terms: db.prepare('SELECT id, term_type, name FROM product_knowledge_terms WHERE active = 1 ORDER BY term_type, sort_order, name').all(),
    products: db.prepare('SELECT id, sku, name FROM products WHERE id != ? AND status != ? ORDER BY name').all(productId, 'archived'),
    cases: db.prepare("SELECT id, title, location, venue_type FROM project_cases WHERE status = 'published' ORDER BY title").all(),
    media: db.prepare("SELECT id, file_name, media_category FROM media_assets WHERE active = 1 ORDER BY file_name").all()
  };
}

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

function normalizedIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(Number).filter(Number.isInteger))];
}

function normalizedKeywords(value) {
  const values = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(values.map(item => String(item).trim().toLowerCase()).filter(Boolean))].slice(0, 100);
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

const handlers = {
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
    `).all().map(row => productWithTags(row.id));
    const categories = db.prepare(`
      SELECT product_categories.id, product_categories.name, product_categories.slug, COUNT(products.id) AS product_count
      FROM product_categories LEFT JOIN products ON products.category_id = product_categories.id
      GROUP BY product_categories.id ORDER BY product_categories.name
    `).all();
    const tags = db.prepare(`SELECT id, tag_name, tag_type FROM system_tags WHERE active = 1 AND tag_type IN (${productTagTypes.map(() => '?').join(',')}) ORDER BY tag_type, tag_name`).all(...productTagTypes);
    const knowledgeTerms = db.prepare('SELECT id, term_type, name FROM product_knowledge_terms WHERE active = 1 ORDER BY term_type, sort_order, name').all();
    return json(res, 200, { products: rows, categories, tags, knowledgeTerms, skuRules: { categoryCodes: skuCategoryCodes, styleCodes: skuStyleCodes } });
  },

  async mutateProduct(req, res, id = null) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
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
    const values = [categoryId, sku, name, String(body.summary ?? existing?.summary ?? '').trim() || null,
      String(body.materials ?? existing?.materials ?? '').trim() || null, String(body.size ?? existing?.size ?? '').trim() || null,
      String(body.price_range ?? existing?.price_range ?? '').trim() || null, Number(body.lead_time_days ?? existing?.lead_time_days ?? 0) || null,
      Number(body.moq ?? existing?.moq ?? 0) || null, String(body.status ?? existing?.status ?? 'draft')];
    try {
      db.exec('BEGIN IMMEDIATE');
      if (existing) db.prepare('UPDATE products SET category_id = ?, sku = ?, name = ?, summary = ?, materials = ?, size = ?, price_range = ?, lead_time_days = ?, moq = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(...values, id);
      else id = Number(db.prepare('INSERT INTO products (category_id, sku, name, summary, materials, size, price_range, lead_time_days, moq, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...values, user.id).lastInsertRowid);
      db.prepare('DELETE FROM product_tag_links WHERE product_id = ?').run(id);
      const link = db.prepare('INSERT INTO product_tag_links (product_id, tag_id) VALUES (?, ?)');
      for (const tagId of tagIds) link.run(id, tagId);
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (error?.code === '23505' || String(error?.message).includes('UNIQUE constraint failed')) return json(res, 409, { error: 'SKU already exists.' });
      throw error;
    }
    audit(user.id, existing ? 'update' : 'create', 'products', String(id), { sku, tagIds });
    return json(res, existing ? 200 : 201, { product: productWithTags(id) });
  },

  productDetail(req, res, id) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const product = productKnowledge(id);
    return product ? json(res, 200, { product, options: knowledgeOptions(id) }) : json(res, 404, { error: 'Product not found.' });
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
      where.push(`(products.name LIKE ? COLLATE NOCASE OR products.sku LIKE ? COLLATE NOCASE OR products.summary LIKE ? COLLATE NOCASE OR products.materials LIKE ? COLLATE NOCASE OR products.ai_summary LIKE ? COLLATE NOCASE OR EXISTS (SELECT 1 FROM product_keywords WHERE product_keywords.product_id = products.id AND product_keywords.keyword LIKE ? COLLATE NOCASE))`);
      params.push(...Array(6).fill(`%${q}%`));
    }
    contains('products.sku', String(url.searchParams.get('sku') || '').trim());
    contains('products.materials', String(url.searchParams.get('material') || '').trim());
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
    return json(res, 200, { products: ids.map(productWithTags), query: Object.fromEntries(url.searchParams) });
  },

  async mutateKnowledge(req, res, id) {
    const user = currentUser(req);
    if (!requires(user, 'products')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
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
    const aiKeywords = normalizedKeywords(body.ai_keywords);
    const searchKeywords = normalizedKeywords(body.ai_search_keywords);
    const text = value => String(value ?? '').trim() || null;
    const recommendationWeight = Math.min(100, Math.max(0, Number(body.ai_recommendation_weight ?? 50) || 0));
    try {
      db.exec('BEGIN IMMEDIATE');
      db.prepare('UPDATE products SET ai_summary = ?, ai_recommendation_weight = ?, ai_notes = ?, internal_notes = ?, knowledge_prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(text(body.ai_summary), recommendationWeight, text(body.ai_notes), text(body.internal_notes), text(body.knowledge_prompt), id);
      for (const table of ['product_knowledge_links', 'product_case_links', 'product_media_links', 'product_keywords']) db.prepare(`DELETE FROM ${table} WHERE product_id = ?`).run(id);
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
      db.exec('COMMIT');
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      throw error;
    }
    audit(user.id, 'update', 'product_knowledge', String(id), { termIds, recommendedIds, caseIds, mediaIds });
    return json(res, 200, { product: productKnowledge(id) });
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

  imports(req, res) {
    const user = currentUser(req);
    if (!requires(user, 'imports')) return json(res, user ? 403 : 401, { error: 'Access denied.' });
    const rows = db.prepare(`
      SELECT import_jobs.*, users.name AS created_by_name
      FROM import_jobs LEFT JOIN users ON users.id = import_jobs.created_by
      ORDER BY import_jobs.created_at DESC
    `).all();
    return json(res, 200, { imports: rows });
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
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8'
  };
  const cache = extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600';
  res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream', 'Cache-Control': cache });
  res.end(readFileSync(filePath));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      if (databaseStatus !== 'ready') {
        return json(res, 503, { status: databaseStatus, error: databaseInitializationError ? 'database_unavailable' : undefined });
      }
      db.prepare('SELECT 1 AS ok').get();
      return json(res, 200, { status: 'ok' });
    }
    if (url.pathname.startsWith('/api/') && databaseStatus !== 'ready') {
      return json(res, 503, { error: 'Database is not ready.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') return await handlers.login(req, res);
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') return handlers.logout(req, res);
    if (req.method === 'GET' && url.pathname === '/api/auth/me') return handlers.me(req, res);
    if (req.method === 'GET' && url.pathname === '/api/dashboard') return handlers.dashboard(req, res);
    if (req.method === 'GET' && url.pathname === '/api/products') return handlers.products(req, res);
    if (req.method === 'POST' && url.pathname === '/api/products') return await handlers.mutateProduct(req, res);
    if (req.method === 'GET' && url.pathname === '/api/knowledge/dashboard') return handlers.knowledgeDashboard(req, res);
    if (req.method === 'GET' && url.pathname === '/api/products/search') return handlers.searchProducts(req, res, url);
    const productKnowledgeMatch = url.pathname.match(/^\/api\/products\/(\d+)\/knowledge$/);
    if (productKnowledgeMatch && req.method === 'PUT') return await handlers.mutateKnowledge(req, res, Number(productKnowledgeMatch[1]));
    const productMatch = url.pathname.match(/^\/api\/products\/(\d+)$/);
    if (productMatch && req.method === 'GET') return handlers.productDetail(req, res, Number(productMatch[1]));
    if (productMatch && req.method === 'PUT') return await handlers.mutateProduct(req, res, Number(productMatch[1]));
    if (req.method === 'GET' && url.pathname === '/api/opportunities') return handlers.opportunities(req, res);
    if (req.method === 'GET' && url.pathname === '/api/imports') return handlers.imports(req, res);
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
    return json(res, error.status || 500, { error: error.status ? error.message : 'The server could not complete this request.' });
  }
});

server.listen(port, host, () => {
  console.log(`Server listening on port ${port}`);
  setImmediate(initializeDatabase);
});

function shutdown() {
  server.close(() => {
    if (db) db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
