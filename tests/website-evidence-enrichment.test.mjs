import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  createWebsiteEvidenceEnrichmentService,
  cleanWebsiteText,
  domainCandidatesForCompany,
  enrichmentResultStatuses
} from '../src/services/website-evidence-enrichment.mjs';
import {
  classifyEvidenceText,
  evaluateQualificationProfile,
  qualificationProfileForTarget
} from '../src/services/qualification-profile.mjs';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE search_tasks(id INTEGER PRIMARY KEY,customer_type TEXT);
    CREATE TABLE search_executions(id INTEGER PRIMARY KEY,search_task_id INTEGER);
    CREATE TABLE search_results(
      id INTEGER PRIMARY KEY,search_task_id INTEGER NOT NULL,search_execution_id INTEGER,
      company_name TEXT NOT NULL,customer_type TEXT,industry TEXT,country TEXT,city TEXT,address TEXT,
      website TEXT,canonical_website TEXT,email TEXT,phone TEXT,business_type TEXT,source_category TEXT,
      source_reference TEXT,evidence_json TEXT NOT NULL DEFAULT '{}',enrichment_status TEXT NOT NULL DEFAULT 'Pending',
      enrichment_updated_at TEXT,status TEXT NOT NULL DEFAULT 'new',updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE lead_enrichment_jobs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,search_task_id INTEGER NOT NULL,search_execution_id INTEGER,
      status TEXT NOT NULL DEFAULT 'Pending',total_count INTEGER NOT NULL DEFAULT 0,processed_count INTEGER NOT NULL DEFAULT 0,
      completed_count INTEGER NOT NULL DEFAULT 0,failed_count INTEGER NOT NULL DEFAULT 0,retry_failed INTEGER NOT NULL DEFAULT 0,
      checkpoint_json TEXT NOT NULL DEFAULT '{}',pause_requested_at TEXT,heartbeat_at TEXT,last_error TEXT,created_by INTEGER,
      started_at TEXT,completed_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE lead_enrichment_records(
      id INTEGER PRIMARY KEY AUTOINCREMENT,search_result_id INTEGER NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'Pending',
      official_website TEXT,phone TEXT,public_emails_json TEXT NOT NULL DEFAULT '[]',contact_page_url TEXT,
      business_description TEXT,verification_score INTEGER NOT NULL DEFAULT 0,evidence_json TEXT NOT NULL DEFAULT '{}',
      extracted_json TEXT NOT NULL DEFAULT '{}',source_urls_json TEXT NOT NULL DEFAULT '[]',status_history_json TEXT NOT NULL DEFAULT '[]',
      attempt_count INTEGER NOT NULL DEFAULT 0,last_error TEXT,completed_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO users VALUES(1,'Owner');
    INSERT INTO search_tasks VALUES(7,'Restaurant Furniture Distributor');
    INSERT INTO search_executions VALUES(3,7);
  `);
  return db;
}

function page(url, html, links = []) {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { url, html, text: plain, title: plain.slice(0, 100), description: plain.slice(0, 300), links, capturedAt: '2026-07-16T12:00:00.000Z' };
}

test('provider website is preferred and verified evidence is saved before requalification', async () => {
  const db = database();
  db.prepare(`INSERT INTO search_results
    (id,search_task_id,search_execution_id,company_name,country,city,website,phone,source_category,evidence_json)
    VALUES(1,7,3,'Acme Hospitality Furniture','United States','Los Angeles','https://acme.example','+1 213 555 0100','furniture.store','{"connectorKey":"future-connector"}')`).run();
  let discoveryCalls = 0, qualifications = 0;
  const pages = new Map([
    ['https://acme.example/', page('https://acme.example/', '<title>Acme Hospitality Furniture Los Angeles</title><p>Commercial restaurant seating and hotel furniture projects.</p><a href="/about">About</a><a href="/products">Products</a><a href="/contact">Contact</a>', [
      { url: 'https://acme.example/about', label: 'About' },
      { url: 'https://acme.example/products', label: 'Products' },
      { url: 'https://acme.example/contact', label: 'Contact' }
    ])],
    ['https://acme.example/about', page('https://acme.example/about', '<p>Acme provides hospitality and restaurant interior projects.</p>')],
    ['https://acme.example/products', page('https://acme.example/products', '<p>Commercial chairs, tables, booths and custom banquette seating.</p>')],
    ['https://acme.example/contact', page('https://acme.example/contact', '<p>Contact sales@acme.example or +1 213 555 0199 in Los Angeles.</p>')]
  ]);
  const service = createWebsiteEvidenceEnrichmentService({
    db,
    audit() {},
    discoveryProvider: { async findCandidates() { discoveryCalls += 1; return []; } },
    websiteFetcher: { async fetchPage(url) { const result = pages.get(url); if (!result) throw new Error(`Missing ${url}`); return result; } },
    qualifyResult: async () => { qualifications += 1; }
  });
  const record = await service.enrichOne(1, { id: 1, role: 'Owner' });
  const lead = db.prepare('SELECT * FROM search_results WHERE id=1').get();
  const evidence = JSON.parse(lead.evidence_json);
  assert.equal(discoveryCalls, 0);
  assert.equal(qualifications, 1);
  assert.equal(record.status, 'Completed');
  assert.equal(lead.website, 'https://acme.example/');
  assert.equal(lead.email, 'sales@acme.example');
  assert.equal(evidence.connectorKey, 'future-connector');
  assert.equal(evidence.enrichment.status, 'Completed');
  assert.ok(evidence.enrichment.businessEvidence.some(item => item.type === 'restaurant'));
  assert.ok(evidence.enrichment.businessEvidence.some(item => item.type === 'hospitality'));
  assert.ok(evidence.enrichment.businessEvidence.every(item => item.url && item.snippet && item.evidenceType));
  assert.equal(evidence.enrichment.sourceUrls.length, 4);
});

test('missing provider website uses the generic discovery provider and never reads connector-specific fields', async () => {
  const db = database();
  db.prepare(`INSERT INTO search_results
    (id,search_task_id,search_execution_id,company_name,country,city,source_category,evidence_json)
    VALUES(2,7,3,'Universal Contract Seating','United States','Los Angeles','commercial.furniture','{"connectorKey":"google-places-new"}')`).run();
  const service = createWebsiteEvidenceEnrichmentService({
    db,
    audit() {},
    discoveryProvider: { async findCandidates(lead) {
      assert.equal(lead.company_name, 'Universal Contract Seating');
      return ['https://universal-seating.example'];
    } },
    websiteFetcher: { async fetchPage() {
      return page('https://universal-seating.example/', '<title>Universal Contract Seating</title><p>Los Angeles commercial furniture, restaurant chairs and hospitality projects.</p>');
    } },
    qualifyResult: async () => {}
  });
  const record = await service.enrichOne(2, { id: 1, role: 'Owner' });
  assert.equal(record.status, 'Completed');
  assert.equal(db.prepare('SELECT website FROM search_results WHERE id=2').get().website, 'https://universal-seating.example/');
});

test('no candidate is persisted as No Reliable Website and still triggers evidence-only requalification', async () => {
  const db = database();
  db.prepare(`INSERT INTO search_results(id,search_task_id,search_execution_id,company_name,country,city,evidence_json)
    VALUES(3,7,3,'Unknown Local Furnishings','United States','Los Angeles','{"connectorKey":"geoapify-places"}')`).run();
  let qualifications = 0;
  const service = createWebsiteEvidenceEnrichmentService({
    db,
    audit() {},
    discoveryProvider: { async findCandidates() { return []; } },
    websiteFetcher: { async fetchPage() { throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }); } },
    qualifyResult: async () => { qualifications += 1; }
  });
  const record = await service.enrichOne(3, { id: 1, role: 'Owner' });
  const evidence = JSON.parse(db.prepare('SELECT evidence_json FROM search_results WHERE id=3').get().evidence_json);
  assert.equal(record.status, 'No Reliable Website');
  assert.equal(qualifications, 1);
  assert.equal(evidence.enrichment.status, 'No Reliable Website');
  assert.equal(record.evidence_json.status, 'No Reliable Website');
});

test('batch jobs expose reusable progress and the full required status contract', async () => {
  const db = database();
  db.prepare(`INSERT INTO search_results(id,search_task_id,search_execution_id,company_name,country,city,website,evidence_json)
    VALUES(4,7,3,'First Furniture','United States','Los Angeles','https://first.example','{}')`).run();
  db.prepare(`INSERT INTO search_results(id,search_task_id,search_execution_id,company_name,country,city,website,evidence_json)
    VALUES(5,7,3,'Second Furniture','United States','Los Angeles','https://second.example','{}')`).run();
  const service = createWebsiteEvidenceEnrichmentService({
    db,
    audit() {},
    discoveryProvider: { async findCandidates() { return []; } },
    websiteFetcher: { async fetchPage(url) {
      const name = url.includes('first') ? 'First Furniture' : 'Second Furniture';
      return page(`${url}/`, `<title>${name}</title><p>Los Angeles commercial restaurant furniture and hospitality seating.</p>`);
    } },
    qualifyResult: async () => {}
  });
  const job = service.createJob(7, { id: 1, role: 'Owner' }, { executionId: 3 });
  const completed = await service.runJob(job.id, { id: 1, role: 'Owner' });
  const progress = service.taskProgress(7);
  assert.equal(completed.status, 'Completed');
  assert.equal(completed.processed_count, 2);
  assert.equal(completed.completed_count, 2);
  assert.equal(progress.total, 2);
  assert.equal(progress.statuses.Completed, 2);
  assert.deepEqual(enrichmentResultStatuses, ['Pending','Verified Website','Needs Review','No Reliable Website','Completed','Failed']);
});

test('generic domain candidates are connector-independent guesses that still require website verification', () => {
  assert.ok(domainCandidatesForCompany("Bob's Discount Furniture").includes('https://bobsdiscountfurniture.com/'));
  assert.ok(domainCandidatesForCompany('Room and Board').includes('https://roomandboard.com/'));
  assert.ok(domainCandidatesForCompany('Room and Board').includes('https://roomboard.com/'));
  assert.ok(domainCandidatesForCompany('Parachute Home').includes('https://parachute.com/'));
});

test('website text cleanup removes navigation, footer and repeated menu text', () => {
  const cleaned = cleanWebsiteText(`
    <body><header>Home About Products Contact</header><nav>Furniture Furniture Furniture</nav>
    <main><h1>Acme Contract Furniture</h1><p>Restaurant booth seating for commercial dining projects.</p>
    <p>Restaurant booth seating for commercial dining projects.</p></main>
    <footer>Home About Products Contact Newsletter Privacy</footer></body>`);
  assert.equal(cleaned, 'Acme Contract Furniture Restaurant booth seating for commercial dining projects.');
  assert.doesNotMatch(cleaned, /Newsletter|Privacy/);
});

test('Restaurant Furniture profile separates target, general and exclusion evidence', () => {
  const profile = qualificationProfileForTarget('Restaurant Furniture Distributor');
  const evidence = classifyEvidenceText(profile, {
    text: 'We supply contract furniture and booth seating for restaurant projects. We do not focus on bedroom mattresses.',
    url: 'https://example.com/projects',
    pageType: 'products',
    capturedAt: '2026-07-16T12:00:00.000Z'
  });
  assert.ok(evidence.some(item => item.evidenceType === 'positive_target'));
  assert.ok(evidence.some(item => item.evidenceType === 'general_furniture'));
  assert.ok(evidence.some(item => item.evidenceType === 'exclusion'));
  assert.ok(evidence.every(item => item.url && item.snippet && item.type));
});

test('Restaurant Furniture profile caps broad furniture evidence and penalizes residential retail', () => {
  const profile = qualificationProfileForTarget('Restaurant Furniture Distributor');
  const broadEvidence = classifyEvidenceText(profile, {
    text: 'Interior design and furniture for living room, bedroom, sofas and mattresses in your home.',
    url: 'https://home.example',
    pageType: 'home',
    capturedAt: '2026-07-16T12:00:00.000Z'
  });
  const broad = evaluateQualificationProfile(profile, {
    evidence: broadEvidence,
    enrichmentStatus: 'Completed',
    verifiedWebsite: true,
    publicContact: true
  });
  assert.ok(broad.score < 70);
  assert.notEqual(broad.recommendation, 'recommended');
  assert.ok(broad.negativeEvidence.length > 0);
  assert.ok(broad.missingInformation.includes('缺少餐饮、酒店或商业项目的直接证据'));

  const directEvidence = classifyEvidenceText(profile, {
    text: 'Contract furniture, booth seating and restaurant project delivery for commercial dining operators.',
    url: 'https://contract.example/projects',
    pageType: 'products',
    capturedAt: '2026-07-16T12:00:00.000Z'
  });
  const direct = evaluateQualificationProfile(profile, {
    evidence: directEvidence,
    enrichmentStatus: 'Completed',
    verifiedWebsite: true,
    publicContact: true
  });
  assert.ok(direct.score >= 70);
  assert.equal(direct.recommendation, 'recommended');
  assert.ok(direct.keyEvidence.length <= 3);
});

test('insufficient website evidence remains Needs Review instead of being guessed', () => {
  const profile = qualificationProfileForTarget('Restaurant Furniture Distributor');
  const result = evaluateQualificationProfile(profile, {
    evidence: [],
    enrichmentStatus: 'No Reliable Website',
    verifiedWebsite: false,
    publicContact: false
  });
  assert.equal(result.recommendation, 'needs_confirmation');
  assert.ok(result.score < 90);
  assert.ok(result.missingInformation.length >= 2);
});
