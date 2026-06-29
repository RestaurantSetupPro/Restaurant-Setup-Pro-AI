import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = 4197;
const databaseDir = mkdtempSync(join(tmpdir(), 'rspro-test-'));
const databasePath = join(databaseDir, 'test.db');
let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error('Test server did not start.');
}

async function login(email) {
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Welcome123!' })
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  return { response, cookie, body: await response.json() };
}

test.before(async () => {
  server = spawn(process.execPath, ['src/server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATABASE_PATH: databasePath },
    stdio: 'ignore'
  });
  await waitForServer();
});

test.after(async () => {
  if (server && !server.killed) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  rmSync(databaseDir, { recursive: true, force: true });
});

test('health check and application shell are available', async () => {
  const health = await fetch(`http://127.0.0.1:${port}/api/health`).then(response => response.json());
  assert.equal(health.status, 'ok');
  const html = await fetch(`http://127.0.0.1:${port}/`).then(response => response.text());
  assert.match(html, /Restaurant Setup Pro/);
  assert.match(html, /id="login-form"/);
});

test('admin login creates a session with full access', async () => {
  const admin = await login('admin@rspro.ai');
  assert.equal(admin.response.status, 200);
  assert.equal(admin.body.user.role, 'Admin');
  assert.equal(admin.body.user.permissions.length, 12);

  const dashboard = await fetch(`http://127.0.0.1:${port}/api/dashboard`, { headers: { Cookie: admin.cookie } });
  const dashboardBody = await dashboard.json();
  assert.equal(dashboard.status, 200);
  assert.equal(dashboardBody.metrics.activeOpportunities, 4);

  const team = await fetch(`http://127.0.0.1:${port}/api/team`, { headers: { Cookie: admin.cookie } });
  assert.equal(team.status, 200);

  const products = await fetch(`http://127.0.0.1:${port}/api/products`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(products.products.every(product => product.size && product.price_range && product.moq && product.tags));
});

test('products generate unique SKUs and support categorized tags and manual SKU edits', async () => {
  const admin = await login('admin@rspro.ai');
  const library = await fetch(`http://127.0.0.1:${port}/api/products`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const booth = library.categories.find(category => category.name === 'Booth Seating');
  const selectedTags = [
    library.tags.find(tag => tag.tag_type === 'Store Type Tags' && tag.tag_name === 'Restaurant').id,
    library.tags.find(tag => tag.tag_type === 'Style Tags' && tag.tag_name === 'California').id,
    library.tags.find(tag => tag.tag_type === 'Business Tags' && tag.tag_name === 'Custom Size').id
  ];
  const create = await fetch(`http://127.0.0.1:${port}/api/products`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: booth.id, sku_style: 'California', name: 'Coastal Curve Booth', tag_ids: selectedTags })
  });
  const created = await create.json();
  assert.equal(create.status, 201);
  assert.equal(created.product.sku, 'BS-CA-001');
  assert.deepEqual(created.product.tag_ids.sort((a, b) => a - b), selectedTags.sort((a, b) => a - b));

  const duplicate = await fetch(`http://127.0.0.1:${port}/api/products`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: booth.id, sku: 'bs-ca-001', name: 'Duplicate Booth' })
  });
  assert.equal(duplicate.status, 409);

  const update = await fetch(`http://127.0.0.1:${port}/api/products/${created.product.id}`, {
    method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku: 'BS-CA-120', tag_ids: selectedTags })
  });
  const updated = await update.json();
  assert.equal(update.status, 200);
  assert.equal(updated.product.sku, 'BS-CA-120');
});

test('Module 04 stores normalized product knowledge, computes score, and combines search filters', async () => {
  const admin = await login('admin@rspro.ai');
  const library = await fetch(`http://127.0.0.1:${port}/api/products`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const outdoor = library.products.find(product => product.sku === 'OUT-4044');
  const detailResponse = await fetch(`http://127.0.0.1:${port}/api/products/${outdoor.id}`, { headers: { Cookie: admin.cookie } });
  const detail = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.ok(detail.product.knowledge.store_type.includes('Hotel'));
  assert.ok(detail.product.knowledge_score < 100);
  assert.ok(detail.options.terms.some(term => term.term_type === 'feature' && term.name === 'Fire Resistant'));

  const selectedTerms = detail.options.terms.filter(term =>
    (term.term_type === 'store_type' && term.name === 'Hotel') ||
    (term.term_type === 'style' && term.name === 'Mediterranean') ||
    (term.term_type === 'feature' && term.name === 'Outdoor') ||
    (term.term_type === 'customer_type' && term.name === 'Expansion')
  ).map(term => term.id);
  const update = await fetch(`http://127.0.0.1:${port}/api/products/${outdoor.id}/knowledge`, {
    method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      term_ids: selectedTerms,
      recommended_product_ids: [detail.options.products[0].id],
      ai_related_product_ids: [detail.options.products[1].id],
      case_ids: [detail.options.cases[0].id],
      media_ids: [detail.options.media[0].id],
      ai_summary: 'Outdoor hospitality lounge chair.',
      ai_keywords: ['outdoor lounge', 'hotel patio'],
      ai_search_keywords: 'weather resistant, aluminum',
      ai_recommendation_weight: 91,
      ai_notes: 'Recommend for hotel terraces.',
      internal_notes: 'Confirm UV specification.',
      knowledge_prompt: 'Recommend this product for outdoor hospitality briefs.'
    })
  });
  const updated = await update.json();
  assert.equal(update.status, 200);
  assert.equal(updated.product.knowledge_score, 100);
  assert.deepEqual(updated.product.ai_keywords, ['hotel patio', 'outdoor lounge']);
  assert.equal(updated.product.recommended_products.length, 1);
  assert.equal(updated.product.related_cases.length, 1);

  const search = await fetch(`http://127.0.0.1:${port}/api/products/search?q=outdoor&storeType=Hotel&style=Mediterranean&material=aluminum&feature=Outdoor`, { headers: { Cookie: admin.cookie } });
  const searchBody = await search.json();
  assert.equal(search.status, 200);
  assert.deepEqual(searchBody.products.map(product => product.sku), ['OUT-4044']);

  const dashboard = await fetch(`http://127.0.0.1:${port}/api/knowledge/dashboard`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(dashboard.metrics.productCount >= 4);
  assert.ok(dashboard.top.some(product => product.sku === 'OUT-4044' && product.knowledge_score === 100));
});

test('sales access is scoped and cannot reach settings', async () => {
  const sales = await login('sales@rspro.ai');
  assert.equal(sales.body.user.role, 'Sales');
  assert.equal(sales.body.user.permissions.includes('settings'), false);

  const opportunities = await fetch(`http://127.0.0.1:${port}/api/opportunities`, { headers: { Cookie: sales.cookie } });
  const opportunityBody = await opportunities.json();
  assert.equal(opportunities.status, 200);
  assert.equal(opportunityBody.opportunities.length, 3);
  assert.ok(opportunityBody.opportunities.every(row => row.owner_id === sales.body.user.id));

  const settings = await fetch(`http://127.0.0.1:${port}/api/team`, { headers: { Cookie: sales.cookie } });
  assert.equal(settings.status, 403);
});

test('designer cannot access product imports', async () => {
  const designer = await login('designer@rspro.ai');
  const imports = await fetch(`http://127.0.0.1:${port}/api/imports`, { headers: { Cookie: designer.cookie } });
  assert.equal(imports.status, 403);
});

test('Module 02 seeds all required foundation data', async () => {
  const admin = await login('admin@rspro.ai');
  const response = await fetch(`http://127.0.0.1:${port}/api/foundation`, { headers: { Cookie: admin.cookie } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.capabilities.canEditConfigs, true);
  assert.deepEqual(body.types.configs.includes('Content Status Options'), true);
  assert.deepEqual(body.types.media.includes('3D Model'), true);
  assert.ok(body.configs.some(row => row.config_type === 'Product Categories' && row.name === 'Booth Seating'));
  assert.ok(body.configs.some(row => row.config_type === 'Currencies' && row.code === 'USD'));
  assert.ok(body.configs.some(row => row.config_type === 'Units' && row.name === 'CBM'));
  assert.ok(body.tags.some(row => row.tag_type === 'Customer Signal Tags' && row.tag_name === 'Chain Brand'));
});

test('admin can create, edit, sort, and deactivate a configuration item', async () => {
  const admin = await login('admin@rspro.ai');
  const create = await fetch(`http://127.0.0.1:${port}/api/foundation/configs`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ config_type: 'Colors', name: 'Forest Green', code: 'FOREST-GREEN', description: 'Brand green', sort_order: 4 })
  });
  const created = await create.json();
  assert.equal(create.status, 201);
  assert.equal(created.record.active, 1);

  const update = await fetch(`http://127.0.0.1:${port}/api/foundation/configs/${created.record.id}`, {
    method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Deep Forest Green', sort_order: 2, active: false })
  });
  const updated = await update.json();
  assert.equal(update.status, 200);
  assert.equal(updated.record.name, 'Deep Forest Green');
  assert.equal(updated.record.sort_order, 2);
  assert.equal(updated.record.active, 0);
});

test('tags enforce globally unique names and codes', async () => {
  const admin = await login('admin@rspro.ai');
  const createTag = body => fetch(`http://127.0.0.1:${port}/api/foundation/tags`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const created = await createTag({ tag_type: 'Content Tags', tag_name: 'Specification Guide', code: 'TAG-SPEC-GUIDE' });
  assert.equal(created.status, 201);
  const duplicateName = await createTag({ tag_type: 'AI Recommendation Tags', tag_name: 'Specification Guide', code: 'TAG-OTHER' });
  assert.equal(duplicateName.status, 409);
  const duplicateCode = await createTag({ tag_type: 'AI Recommendation Tags', tag_name: 'Another Tag', code: 'tag-spec-guide' });
  assert.equal(duplicateCode.status, 409);
});

test('AI media receives the mandatory production-use warning', async () => {
  const admin = await login('admin@rspro.ai');
  const response = await fetch(`http://127.0.0.1:${port}/api/foundation/media`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: 'concept-preview.png', file_type: 'image/png', media_category: 'AI Generated Image', is_ai_generated: true })
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.match(body.record.usage_note, /AI Generated Preview - Not for Production Use/);
});

test('admin can manage prompts while sales has read-only config and tag access', async () => {
  const admin = await login('admin@rspro.ai');
  const prompt = await fetch(`http://127.0.0.1:${port}/api/foundation/prompts`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt_name: 'Product summary v1', prompt_type: 'Product Description Prompt', prompt_content: 'Describe {{product_name}}.', variables: 'product_name', version: 1 })
  });
  assert.equal(prompt.status, 201);

  const sales = await login('sales@rspro.ai');
  const foundation = await fetch(`http://127.0.0.1:${port}/api/foundation`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.equal(foundation.capabilities.canEditConfigs, false);
  assert.equal(foundation.capabilities.canEditTags, false);
  assert.equal(foundation.prompts.length, 0);
  assert.ok(foundation.configs.length > 0);
  assert.ok(foundation.tags.length > 0);
  const forbidden = await fetch(`http://127.0.0.1:${port}/api/foundation/configs`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ config_type: 'Colors', name: 'Red', code: 'RED' })
  });
  assert.equal(forbidden.status, 403);
});

test('designer foundation access is limited to styles, materials, tags, and media', async () => {
  const designer = await login('designer@rspro.ai');
  const response = await fetch(`http://127.0.0.1:${port}/api/foundation`, { headers: { Cookie: designer.cookie } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual([...new Set(body.configs.map(row => row.config_type))].sort(), ['Materials', 'Styles']);
  assert.equal(body.capabilities.canViewMedia, true);
  assert.equal(body.capabilities.canEditMedia, false);
  assert.equal(body.capabilities.canViewPrompts, false);
});
