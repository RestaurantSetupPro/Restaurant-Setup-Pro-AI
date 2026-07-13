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
      const response = await fetch(`http://127.0.0.1:${port}/api/ready`);
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
    stdio: process.env.TEST_SERVER_LOGS ? 'inherit' : 'ignore'
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
  const database = await fetch(`http://127.0.0.1:${port}/api/debug/db`).then(response => response.json());
  assert.equal(database.connected, true);
  assert.equal(database.migration, true);
  assert.equal(database.migrationVersion, '027_v53_search_execution_foundation');
  assert.ok(database.tables.includes('search_executions'));
  assert.ok(database.tables.includes('search_result_raw_payloads'));
  assert.equal(database.error, null);
  assert.ok(database.tables.includes('users'));
  const html = await fetch(`http://127.0.0.1:${port}/`).then(response => response.text());
  assert.match(html, /Restaurant Setup Pro/);
  assert.match(html, /id="login-form"/);
  assert.doesNotMatch(html, /__BUILD_VERSION__/);
  assert.match(html, /\/app\.js\?v=(startup-|[a-f0-9])/i);
  for (const asset of ['/app.js', '/styles.css']) {
    const response = await fetch(`http://127.0.0.1:${port}${asset}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') || '', /no-cache/);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
  }
});

test('admin login creates a session with full access', async () => {
  const admin = await login('admin@rspro.ai');
  assert.equal(admin.response.status, 200);
  assert.equal(admin.body.user.role, 'Admin');
  assert.equal(admin.body.user.permissions.length, 24);

  const dashboard = await fetch(`http://127.0.0.1:${port}/api/dashboard`, { headers: { Cookie: admin.cookie } });
  const dashboardBody = await dashboard.json();
  assert.equal(dashboard.status, 200);
  assert.equal(dashboardBody.metrics.activeOpportunities, 4);
  assert.equal(typeof dashboardBody.productIntelligence.proposalReadyProducts, 'number');

  const team = await fetch(`http://127.0.0.1:${port}/api/team`, { headers: { Cookie: admin.cookie } });
  assert.equal(team.status, 200);

  const debug = await fetch(`http://127.0.0.1:${port}/api/debug/system`, { headers: { Cookie: admin.cookie } });
  const debugBody = await debug.json();
  assert.equal(debug.status, 200);
  assert.equal(debugBody.database.connected, true);
  assert.equal(debugBody.database.migration, true);
  assert.ok(debugBody.events.some(event => event.message.includes('Database ready')));
  assert.equal(typeof debugBody.productIntelligence.missingAiTags, 'number');
  assert.equal(debugBody.opportunityIntelligence.scoring_engine_status, 'rules-ready');

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

test('Module 05 saves intelligence data, manages images, generates content, filters, and calculates readiness', async () => {
  const admin = await login('admin@rspro.ai');
  const library = await fetch(`http://127.0.0.1:${port}/api/products`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const chairCategory = library.categories.find(category => category.name === 'Dining Chair');
  const create = await fetch(`http://127.0.0.1:${port}/api/products`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category_id: chairCategory.id, sku: 'CH-JP-505', name: 'Module 05 Japandi Chair',
      materials: 'Solid ash and commercial upholstery', size: 'W520 × D560 × H810 mm',
      color: 'Natural Ash', finish: 'Matte clear coat', price_range: '$180-$240', moq: 20,
      lead_time_days: 35, budget_level: 'Premium', product_series: 'Quiet Form',
      sub_category: 'Upholstered Chair', sales_notes: 'Lead with commercial durability.'
    })
  });
  const created = await create.json();
  assert.equal(create.status, 201);
  assert.equal(created.product.product_readiness_score, 60);
  assert.equal(created.product.proposal_ready_status, 'Needs Review');

  const detail = await fetch(`http://127.0.0.1:${port}/api/products/${created.product.id}`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.equal(detail.product.sub_category, 'Upholstered Chair');
  assert.ok(detail.options.imageTypes.includes('Scene Image - Coffee Shop'));
  assert.deepEqual(detail.options.imageStatuses, ['Uploaded', 'AI Generated', 'Approved', 'Rejected']);

  const generate = type => fetch(`http://127.0.0.1:${port}/api/products/${created.product.id}/generate/${type}`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: '{}'
  }).then(response => response.json());
  const generation = await generate('product-info');
  const seo = await generate('seo');
  const geo = await generate('geo');
  const faq = await generate('faq');
  const guide = await generate('buying-guide');
  assert.equal(generation.mode, 'rules');
  assert.equal(generation.requiresHumanReview, true);
  assert.match(generation.generated.english_description, /Module 05 Japandi Chair/);
  assert.equal(seo.generated.slug, 'module-05-japandi-chair');
  assert.ok(geo.generated.llm_summary && faq.generated.faq && guide.generated.buying_guide);

  const storeTerm = detail.options.terms.find(term => term.term_type === 'store_type' && term.name === 'Coffee Shop');
  const styleTerm = detail.options.terms.find(term => term.term_type === 'style' && term.name === 'Japandi');
  const relatedCategory = detail.options.categories.find(category => category.name === 'Restaurant Table');
  const update = await fetch(`http://127.0.0.1:${port}/api/products/${created.product.id}/knowledge`, {
    method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      term_ids: [storeTerm.id, styleTerm.id], recommended_product_ids: [], ai_related_product_ids: [],
      case_ids: [], media_ids: [], related_category_ids: [relatedCategory.id],
      ai_keywords: generation.generated.ai_keywords, ai_search_keywords: ['japandi restaurant chair'],
      english_description: generation.generated.english_description,
      short_sales_description: generation.generated.short_sales_description,
      proposal_usage_notes: generation.generated.proposal_usage_notes,
      sales_talking_points: generation.generated.sales_talking_points,
      sales_notes: 'Approved sales positioning for hospitality proposals.',
      seo_title: seo.generated.seo_title, seo_description: seo.generated.seo_description, slug: seo.generated.slug,
      llm_summary: geo.generated.llm_summary, faq: faq.generated.faq, buying_guide: guide.generated.buying_guide,
      budget_level: 'Premium'
    })
  });
  const updated = await update.json();
  assert.equal(update.status, 200);
  assert.equal(updated.product.product_readiness_score, 80);
  assert.equal(updated.product.proposal_ready_status, 'Proposal Ready');
  assert.equal(updated.product.related_categories[0].name, 'Restaurant Table');

  const image = await fetch(`http://127.0.0.1:${port}/api/products/${created.product.id}/images`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: 'module-05-main.jpg', file_url: 'https://example.test/module-05-main.jpg', image_type: 'Main Image', image_status: 'Approved', mark_main: true })
  });
  const imaged = await image.json();
  assert.equal(image.status, 201);
  assert.equal(imaged.product.product_readiness_score, 100);
  assert.equal(imaged.product.media[0].image_status, 'Approved');

  const aiTag = encodeURIComponent(generation.generated.ai_keywords[0]);
  const search = await fetch(`http://127.0.0.1:${port}/api/products/search?q=Japandi&category=Dining%20Chair&storeType=Coffee%20Shop&style=Japandi&budgetLevel=Premium&material=ash&proposalReady=Proposal%20Ready&aiTag=${aiTag}`, { headers: { Cookie: admin.cookie } });
  const searchBody = await search.json();
  assert.equal(search.status, 200);
  assert.deepEqual(searchBody.products.map(product => product.sku), ['CH-JP-505']);
});

test('Module 05.1 creates reviewable content drafts and image tasks before applying approved content', async () => {
  const admin = await login('admin@rspro.ai');
  const library = await fetch(`http://127.0.0.1:${port}/api/products`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const product = library.products.find(item => item.sku === 'CH-JP-505');
  const detailResponse = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}`, { headers: { Cookie: admin.cookie } });
  const detail = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detail.aiContentFactory.capabilities.canGenerate, true);
  assert.equal(detail.aiContentFactory.status, 'no_content');
  const source = detail.product.media.find(media => media.image_type === 'Main Image');

  const generate = mode => fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/generate`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ generation_mode: mode, source_media_id: source.id, confirmed: true })
  });
  const standardResponse = await generate('standard');
  const standard = await standardResponse.json();
  assert.equal(standardResponse.status, 201);
  assert.equal(standard.draft.status, 'pending_review');
  assert.equal(standard.draft.generation_mode, 'standard');
  assert.equal(standard.draft.cost_estimate, 0.01);
  assert.equal(standard.imageTasks.length, 3);
  assert.ok(standard.imageTasks.every(task => task.status === 'pending' && task.cost_estimate === 0.05));

  const editResponse = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/drafts/${standard.draft.id}`, {
    method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'pending_review', generated_description_en: 'Human-edited approved English description.',
      generated_seo_title: 'Human Reviewed Japandi Chair', generated_ai_tags: ['japandi chair', 'contract seating'],
      generated_style: ['Japandi'], generated_store_types: ['Coffee Shop', 'Restaurant'], review_notes: 'Edited before review.'
    })
  });
  const edited = await editResponse.json();
  assert.equal(editResponse.status, 200);
  assert.equal(edited.draft.generated_description_en, 'Human-edited approved English description.');
  assert.deepEqual(edited.draft.generated_ai_tags, ['japandi chair', 'contract seating']);

  const prematureApply = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/drafts/${standard.draft.id}/apply`, {
    method: 'POST', headers: { Cookie: admin.cookie }
  });
  assert.equal(prematureApply.status, 409);

  const approveResponse = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/drafts/${standard.draft.id}/approve`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ review_notes: 'Approved by product owner.' })
  });
  assert.equal(approveResponse.status, 200);
  assert.equal((await approveResponse.json()).draft.status, 'approved');

  const applyResponse = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/drafts/${standard.draft.id}/apply`, {
    method: 'POST', headers: { Cookie: admin.cookie }
  });
  const applied = await applyResponse.json();
  assert.equal(applyResponse.status, 200);
  assert.equal(applied.draft.status, 'applied');
  assert.equal(applied.product.english_description, 'Human-edited approved English description.');
  assert.equal(applied.product.seo_title, 'Human Reviewed Japandi Chair');
  assert.deepEqual(applied.product.ai_tags, ['contract seating', 'japandi chair']);

  const fastResponse = await generate('fast');
  const fast = await fastResponse.json();
  assert.equal(fastResponse.status, 201);
  assert.equal(fast.imageTasks.length, 0);
  const rejectResponse = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/drafts/${fast.draft.id}/reject`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ review_notes: 'Regenerate with more context.' })
  });
  assert.equal((await rejectResponse.json()).draft.status, 'rejected');

  const premiumResponse = await generate('premium');
  const premium = await premiumResponse.json();
  assert.equal(premiumResponse.status, 201);
  assert.equal(premium.imageTasks.length, 14);
  assert.ok(premium.imageTasks.some(task => task.image_type === 'Transparent PNG'));
  assert.ok(premium.imageTasks.some(task => task.scene_type === 'Hotel'));
  assert.ok(premium.imageTasks.every(task => task.cost_estimate === 0.15));

  const manualTask = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_media_id: source.id, generation_mode: 'standard', image_type: 'Detail Image', provider: 'flux', prompt: 'Preserve exact chair geometry.' })
  });
  const manualTaskBody = await manualTask.json();
  assert.equal(manualTask.status, 201);
  assert.equal(manualTaskBody.imageTask.provider, 'flux');

  const sales = await login('sales@rspro.ai');
  const salesDrafts = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/drafts`, { headers: { Cookie: sales.cookie } });
  const salesDraftBody = await salesDrafts.json();
  assert.equal(salesDrafts.status, 200);
  assert.deepEqual(salesDraftBody.drafts.map(draft => draft.status), ['applied']);
  const salesGenerate = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/generate`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ generation_mode: 'fast', source_media_id: source.id })
  });
  assert.equal(salesGenerate.status, 403);
  const salesApprove = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/drafts/${premium.draft.id}/approve`, { method: 'POST', headers: { Cookie: sales.cookie } });
  assert.equal(salesApprove.status, 403);

  const designer = await login('designer@rspro.ai');
  const designerGenerate = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/generate`, {
    method: 'POST', headers: { Cookie: designer.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ generation_mode: 'fast', source_media_id: source.id, confirmed: true })
  });
  assert.equal(designerGenerate.status, 201);

  const va = await login('va@rspro.ai');
  const vaDrafts = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/ai-content/drafts`, { headers: { Cookie: va.cookie } });
  assert.equal(vaDrafts.status, 403);

  const debug = await fetch(`http://127.0.0.1:${port}/api/debug/system`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(debug.aiProductFactory.totalDrafts >= 4);
  assert.ok(debug.aiProductFactory.appliedDrafts >= 1);
  assert.ok(debug.aiProductFactory.imageTasks >= 18);
  assert.ok(debug.aiProductFactory.pendingImageTasks >= 18);
  assert.equal(debug.aiProductFactory.failedImageTasks, 0);
});

test('Module 05.2 runs mock image providers with limits, review, retry, apply, and role controls', async () => {
  const admin = await login('admin@rspro.ai');
  const library = await fetch(`http://127.0.0.1:${port}/api/products`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const product = library.products.find(item => item.sku === 'CH-JP-505');
  const detail = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const source = detail.product.media.find(media => media.image_type === 'Main Image');

  const providerStatusResponse = await fetch(`http://127.0.0.1:${port}/api/system/ai-image-provider/status`, { headers: { Cookie: admin.cookie } });
  const providerStatus = await providerStatusResponse.json();
  assert.equal(providerStatusResponse.status, 200);
  assert.equal(providerStatus.currentProvider, 'mock');
  assert.equal(providerStatus.providerAvailable, true);
  assert.equal(providerStatus.apiKeyConfigured, false);
  assert.equal(providerStatus.maxPerRun, 3);

  const createTask = (imageType, prompt, provider = 'mock') => fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_media_id: source.id, generation_mode: 'standard', image_type: imageType, provider, prompt })
  }).then(async response => ({ response, body: await response.json() }));
  const created = [];
  for (const [type, prompt] of [['Front View','Clean commercial chair front view'],['Back View','Clean commercial chair back view'],['Left View','Clean commercial chair left view'],['Right View','Clean commercial chair right view']]) {
    const task = await createTask(type, prompt);
    assert.equal(task.response.status, 201);
    created.push(task.body.imageTask);
  }

  const overLimit = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/run-selected`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed: true, task_ids: created.map(task => task.id) })
  });
  assert.equal(overLimit.status, 400);
  const unconfirmed = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${created[0].id}/run`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(unconfirmed.status, 400);

  const runPromise = fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/run-selected`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed: true, task_ids: created.slice(0, 2).map(task => task.id) })
  });
  await new Promise(resolveWait => setTimeout(resolveWait, 25));
  const duringRun = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(duringRun.imageTasks.some(task => task.id === created[0].id && task.status === 'running'));
  const runResponse = await runPromise;
  const runBody = await runResponse.json();
  assert.equal(runResponse.status, 200);
  assert.equal(runBody.imageTasks.length, 2);
  assert.ok(runBody.imageTasks.every(task => task.status === 'pending_review'));
  assert.ok(runBody.imageTasks[0].status_history.some(entry => entry.status === 'running'));
  assert.ok(runBody.imageTasks[0].status_history.some(entry => entry.status === 'generated'));
  assert.match(runBody.imageTasks[0].output_url, /^\/generated\//);
  const generatedFile = await fetch(`http://127.0.0.1:${port}${runBody.imageTasks[0].output_url}`);
  assert.equal(generatedFile.status, 200);
  assert.match(generatedFile.headers.get('content-type'), /image\/svg\+xml/);

  const approve = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${created[0].id}/approve`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ review_notes: 'Geometry approved.' })
  });
  assert.equal((await approve.json()).imageTask.status, 'approved');
  const apply = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${created[0].id}/apply`, { method: 'POST', headers: { Cookie: admin.cookie } });
  const applied = await apply.json();
  assert.equal(apply.status, 200);
  assert.equal(applied.imageTask.status, 'applied');
  assert.ok(applied.product.media.some(media => media.id === applied.imageTask.output_media_id && media.image_status === 'Approved'));
  const reject = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${created[1].id}/reject`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ review_notes: 'Angle needs correction.' })
  });
  assert.equal((await reject.json()).imageTask.status, 'rejected');

  const failedCreated = await createTask('Detail Image', '[force-fail] detail image');
  const failedRun = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${failedCreated.body.imageTask.id}/run`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true })
  }).then(response => response.json());
  assert.equal(failedRun.imageTask.status, 'failed');
  assert.match(failedRun.imageTask.error_message, /forced failure/);
  const edited = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${failedCreated.body.imageTask.id}`, {
    method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Corrected commercial detail image', provider: 'mock' })
  }).then(response => response.json());
  assert.equal(edited.imageTask.prompt_version, 2);
  const retried = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${failedCreated.body.imageTask.id}/retry`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true })
  }).then(response => response.json());
  assert.equal(retried.imageTask.status, 'pending_review');

  const cancelledCreated = await createTask('Transparent PNG', 'Transparent background product image');
  const cancelled = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${cancelledCreated.body.imageTask.id}/cancel`, { method: 'POST', headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.equal(cancelled.imageTask.status, 'rejected');

  const runAll = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/run-all`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true })
  }).then(response => response.json());
  assert.ok(runAll.imageTasks.length <= 3);
  assert.equal(runAll.limit, 3);

  const sales = await login('sales@rspro.ai');
  const salesRun = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${created[2].id}/run`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true })
  });
  assert.equal(salesRun.status, 403);
  const salesReview = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${retried.imageTask.id}/approve`, { method: 'POST', headers: { Cookie: sales.cookie } });
  assert.equal(salesReview.status, 403);
  const salesTasks = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.ok(salesTasks.imageTasks.every(task => ['approved', 'applied'].includes(task.status)));

  const designer = await login('designer@rspro.ai');
  const designerTask = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks`, {
    method: 'POST', headers: { Cookie: designer.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_media_id: source.id, generation_mode: 'standard', image_type: 'White Background Image', provider: 'mock', prompt: 'Designer white background task' })
  }).then(response => response.json());
  const designerRun = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${designerTask.imageTask.id}/run`, {
    method: 'POST', headers: { Cookie: designer.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true })
  }).then(response => response.json());
  assert.equal(designerRun.imageTask.status, 'pending_review');
  const designerApprove = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${designerTask.imageTask.id}/approve`, { method: 'POST', headers: { Cookie: designer.cookie } });
  assert.equal(designerApprove.status, 200);
  const designerApply = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${designerTask.imageTask.id}/apply`, { method: 'POST', headers: { Cookie: designer.cookie } });
  assert.equal(designerApply.status, 200);

  const debug = await fetch(`http://127.0.0.1:${port}/api/debug/system`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.equal(debug.aiImageGeneration.currentProvider, 'mock');
  assert.ok(debug.aiImageGeneration.appliedTasks >= 2);
  assert.ok(debug.aiImageGeneration.failedTasks >= 0);
});

test('Module 06A imports, scores, matches, drafts, hands off, and enforces role permissions', async () => {
  const admin = await login('admin@rspro.ai');
  const create = await fetch(`http://127.0.0.1:${port}/api/customers`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: '  pacific bean group  ', business_type: 'coffee shop', country: 'united states', city: 'los angeles',
      website: 'pacificbean.example', email: 'HELLO@PACIFICBEAN.EXAMPLE', whatsapp: '+1 (310) 555-0102', phone: '310-555-0101',
      store_count: 4, opening_year: 2018, source: 'Google Maps', source_url: 'https://maps.example/pacific-bean',
      source_confidence: 92, expansion_probability: 95, renovation_probability: 85, furniture_need_probability: 100,
      budget_estimate: 'Premium', style_signal: 'California'
    })
  });
  const created = await create.json();
  assert.equal(create.status, 201);
  assert.equal(created.customer.company_name, 'Pacific Bean Group');
  assert.equal(created.customer.website, 'https://pacificbean.example');
  const customerId = created.customer.id;

  const contact = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/contacts`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'Maya Chen', role: 'Founder', email: 'maya@pacificbean.example', source: 'LinkedIn', confidence_score: 95, is_primary_decision_maker: true })
  });
  assert.equal(contact.status, 201);

  const run = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/run-ai`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: '{}'
  });
  const processed = await run.json();
  assert.equal(run.status, 200);
  assert.ok(processed.customer.opportunity_score >= 90);
  assert.equal(processed.customer.opportunity_grade, 'A+');
  assert.equal(processed.customer.opportunity_status, 'Ready for Sales');
  assert.ok(processed.customer.recommended_products.length > 0);
  assert.ok(processed.customer.recommended_products.every(item => item.product_id || item.category_id));
  assert.ok(processed.customer.outreach_drafts.some(draft => draft.status === 'Ready'));
  assert.ok(processed.customer.activity.some(item => item.activity_type === 'product matched'));
  assert.ok(processed.customer.gaps.some(gap => gap.gap_type === 'Missing LinkedIn'));

  const queue = await fetch(`http://127.0.0.1:${port}/api/opportunity-queue`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(queue.customers.some(customer => customer.id === customerId));
  const handoff = await fetch(`http://127.0.0.1:${port}/api/customers/sales-handoff`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(handoff.customers.some(customer => customer.id === customerId));

  const draft = processed.customer.outreach_drafts[0];
  const editDraft = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/outreach-drafts/${draft.id}`, {
    method: 'PUT', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: 'Pacific Bean expansion furniture', body: `${draft.body}\n\nPrepared for review.` })
  });
  assert.equal(editDraft.status, 200);
  const approve = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/outreach-drafts/${draft.id}/approve`, { method: 'POST', headers: { Cookie: admin.cookie } });
  assert.equal(approve.status, 200);

  const csv = await fetch(`http://127.0.0.1:${port}/api/customers/import`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'CSV', csv: 'company_name,business_type,city,country,email\nHarbor Sushi,Restaurant,Seattle,United States,hello@harborsushi.example' })
  }).then(response => response.json());
  assert.equal(csv.imported, 1);
  const text = await fetch(`http://127.0.0.1:${port}/api/customers/import`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'Manual', text: 'Moon Bakery | Bakery | Austin | United States | hi@moonbakery.example | moonbakery.example' })
  }).then(response => response.json());
  assert.equal(text.imported, 1);

  const va = await login('va@rspro.ai');
  const vaImport = await fetch(`http://127.0.0.1:${port}/api/customers`, {
    method: 'POST', headers: { Cookie: va.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ company_name: 'VA Research Lead', source: 'Manual' })
  });
  assert.equal(vaImport.status, 201);
  const vaRun = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/run-ai`, { method: 'POST', headers: { Cookie: va.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(vaRun.status, 403);
  const vaScoreAttempt = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}`, {
    method: 'PUT', headers: { Cookie: va.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ opportunity_score: 1, city: 'Los Angeles' })
  }).then(response => response.json());
  assert.equal(vaScoreAttempt.customer.opportunity_score, processed.customer.opportunity_score);
  const openGap = processed.customer.gaps.find(gap => gap.status === 'Open');
  const gapUpdate = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/gaps/${openGap.id}`, {
    method: 'PUT', headers: { Cookie: va.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Filled', notes: 'Research completed.' })
  });
  assert.equal(gapUpdate.status, 200);

  const sales = await login('sales@rspro.ai');
  const accept = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/accept-lead`, { method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  const accepted = await accept.json();
  assert.equal(accept.status, 200);
  assert.equal(accepted.customer.opportunity_status, 'In Progress');
  assert.equal(accepted.customer.assigned_sales_id, sales.body.user.id);
  const sent = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/outreach-drafts/${draft.id}/mark-sent-manually`, { method: 'POST', headers: { Cookie: sales.cookie } });
  assert.equal(sent.status, 200);
  const salesDelete = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}`, { method: 'DELETE', headers: { Cookie: sales.cookie } });
  assert.equal(salesDelete.status, 404);

  const designer = await login('designer@rspro.ai');
  const designerAccess = await fetch(`http://127.0.0.1:${port}/api/customers`, { headers: { Cookie: designer.cookie } });
  assert.equal(designerAccess.status, 403);
  const debug = await fetch(`http://127.0.0.1:${port}/api/debug/system`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(debug.opportunityIntelligence.customers_count >= 3);
  assert.ok(debug.opportunityIntelligence.contacts_count >= 1);
  assert.equal(debug.opportunityIntelligence.product_matching_status, 'product-intelligence-connected');
});

test('Workflow 1A manages approved knowledge revisions with role-safe deterministic context', async () => {
  const [admin, sales, designer, va] = await Promise.all(['admin@rspro.ai', 'sales@rspro.ai', 'designer@rspro.ai', 'va@rspro.ai'].map(login));
  const request = async (path, session, method = 'GET', body) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { Cookie: session.cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { response, body: await response.json() };
  };
  const costBefore = await request('/api/ai-cost/logs', admin);
  const masterBefore = await request('/api/products', admin);
  const created = await request('/api/knowledge-center', sales, 'POST', { knowledge_key: 'company-core', knowledge_type: 'company', title: 'Company Core', summary: 'Approved facts only', content_json: { company_introduction: 'Restaurant furniture partner', prohibited_sales_promises: 'No guaranteed delivery without confirmation' }, tags_json: ['company'] });
  assert.equal(created.response.status, 201); assert.equal(created.body.item.status, 'Draft');
  const id = created.body.item.id;
  assert.equal((await request(`/api/knowledge-center/${id}/submit-review`, sales, 'POST', {})).body.item.status, 'Needs Review');
  assert.equal((await request(`/api/knowledge-center/${id}/approve`, sales, 'POST', {})).response.status, 403);
  assert.equal((await request(`/api/knowledge-center/${id}/approve`, admin, 'POST', { review_note: 'Approved' })).body.item.status, 'Active');
  const revision = await request(`/api/knowledge-center/${id}`, sales, 'PUT', { title: 'Company Core Updated', summary: 'Draft update', content_json: { company_introduction: 'Unapproved revision' }, tags_json: [] });
  assert.equal(revision.body.item.revision_no, 2); assert.equal(revision.body.item.status, 'Draft');
  const previewDuringReview = await request('/api/knowledge-center/context-preview?knowledgeKeys=company-core', sales);
  assert.equal(previewDuringReview.body.context.companyKnowledge[0].revision_no, 1);
  assert.equal(previewDuringReview.body.cost.aiCalled, false); assert.equal(previewDuringReview.body.cost.estimatedCostUsd, 0);
  assert.doesNotMatch(JSON.stringify(previewDuringReview.body), /supplier_cost|converted_cost|minimum_margin|supplier_name/i);
  await request(`/api/knowledge-center/${revision.body.item.id}/submit-review`, sales, 'POST', {});
  await request(`/api/knowledge-center/${revision.body.item.id}/approve`, admin, 'POST', {});
  const history = await request(`/api/knowledge-center/${revision.body.item.id}/history`, admin);
  assert.deepEqual(history.body.history.map(item => item.status), ['Active', 'Outdated']);
  const salesList = await request('/api/knowledge-center', sales); assert.ok(salesList.body.items.every(item => item.status === 'Active' || item.created_by === sales.body.user.id));
  const designerCreate = await request('/api/knowledge-center', designer, 'POST', { knowledge_key: 'forbidden', knowledge_type: 'company', title: 'Forbidden' }); assert.equal(designerCreate.response.status, 403);
  const vaList = await request('/api/knowledge-center/context-preview', va); assert.doesNotMatch(JSON.stringify(vaList.body), /supplier_cost|converted_cost|minimum_margin|supplier_name/i);
  const missing = await request('/api/knowledge-center/context-preview?knowledgeKeys=missing-key', sales); assert.match(missing.body.context.warnings.join(' '), /No Active Knowledge/);
  const costAfter = await request('/api/ai-cost/logs', admin); assert.equal(costAfter.body.logs.length, costBefore.body.logs.length);
  const masterAfter = await request('/api/products', admin); assert.equal(masterAfter.body.products.length, masterBefore.body.products.length);
  const debug = await request('/api/debug/system', admin); assert.equal(debug.body.knowledgeCenter.singleActiveValid, true);
  assert.doesNotMatch(JSON.stringify(debug.body.knowledgeCenter), /supplier_cost|minimum_margin/i);
});

test('all five roles receive Knowledge Dashboard access with server-enforced Workflow 1A RBAC', async () => {
  const sessions = Object.fromEntries(await Promise.all(['Admin', 'Owner', 'Sales', 'Designer', 'VA'].map(async role => [role, await login(`${role.toLowerCase()}@rspro.ai`)])));
  for (const role of Object.keys(sessions)) {
    const list = await fetch(`http://127.0.0.1:${port}/api/knowledge-center`, { headers: { Cookie: sessions[role].cookie } });
    assert.equal(list.status, 200, `${role} can open Knowledge Dashboard`);
    const body = await list.json();
    assert.equal(body.capabilities.canCreate, ['Admin', 'Owner', 'Sales', 'VA'].includes(role));
  }
  for (const role of ['Admin', 'Owner', 'Sales', 'VA']) {
    const create = await fetch(`http://127.0.0.1:${port}/api/knowledge-center`, { method: 'POST', headers: { Cookie: sessions[role].cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ knowledge_key: `rbac-${role.toLowerCase()}`, knowledge_type: 'target_customer_profile', title: `${role} Draft`, content_json: {} }) });
    assert.equal(create.status, 201, `${role} can create Draft`);
  }
  const designerCreate = await fetch(`http://127.0.0.1:${port}/api/knowledge-center`, { method: 'POST', headers: { Cookie: sessions.Designer.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ knowledge_key: 'rbac-designer', knowledge_type: 'company', title: 'Forbidden' }) });
  assert.equal(designerCreate.status, 403);
  const salesItems = await fetch(`http://127.0.0.1:${port}/api/knowledge-center`, { headers: { Cookie: sessions.Sales.cookie } }).then(response => response.json());
  const salesOwnDraft = salesItems.items.find(item => item.knowledge_key === 'rbac-sales');
  const salesApprove = await fetch(`http://127.0.0.1:${port}/api/knowledge-center/${salesOwnDraft.id}/approve`, { method: 'POST', headers: { Cookie: sessions.Sales.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(salesApprove.status, 403);
});

test('Workflow 1B enforces structured Search Strategy approval, revision, cost, RBAC, and Search Task gates', async () => {
  const [admin, owner, sales, va, designer] = await Promise.all(['admin@rspro.ai','owner@rspro.ai','sales@rspro.ai','va@rspro.ai','designer@rspro.ai'].map(login));
  const call = async (path, session, method='GET', body) => { const response=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{Cookie:session.cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {response,body:await response.json()}; };
  const companyScope=await call('/api/knowledge-center',admin,'POST',{knowledge_key:'workflow-1b-company-scope',knowledge_type:'company',title:'Company Service Scope',content_json:{target_countries:['United States','Canada'],customer_types:['Restaurant Chains','Cafe Owners','Restaurant Owners'],main_product_categories:['Restaurant Furniture']}});
  await call(`/api/knowledge-center/${companyScope.body.item.id}/submit-review`,admin,'POST',{});
  await call(`/api/knowledge-center/${companyScope.body.item.id}/approve`,owner,'POST',{});
  const target=await call('/api/knowledge-center',admin,'POST',{knowledge_key:'workflow-1b-target',knowledge_type:'target_customer_profile',title:'Restaurant Growth Buyers',content_json:{target_countries:['United States'],customer_types:['Restaurant Furniture Dealers','Hospitality Furniture Distributors','Commercial Furniture Importers'],target_business_signals:'Restaurant renovation, New location expansion, Multi-location growth',product_directions:['Restaurant Chairs','Commercial Tables'],exclusions:'Residential-only stores, Job listings'}});
  await call(`/api/knowledge-center/${target.body.item.id}/submit-review`,admin,'POST',{});
  await call(`/api/knowledge-center/${target.body.item.id}/approve`,owner,'POST',{});
  const created=await call('/api/search-strategies',sales,'POST',{title:'AI Restaurant Growth Search',objective:'Find restaurant groups planning expansion'});
  assert.equal(created.response.status,201);assert.equal(created.body.strategy.status,'Draft');
  const id=created.body.strategy.id;
  const countBeforeGenerate=(await call('/api/search-strategies',sales)).body.strategies.length;
  const generated=await call(`/api/search-strategies/${id}/generate`,sales,'POST',{provider:'rules'});
  assert.equal(generated.response.status,200,generated.body.error);assert.equal(generated.body.strategy.status,'Draft');
  assert.deepEqual(generated.body.strategy.strategy_data_json.targetMarket.countries,['United States']);
  assert.deepEqual(generated.body.strategy.strategy_data_json.targetCustomerProfile.customerTypes,['Restaurant Furniture Dealers','Hospitality Furniture Distributors','Commercial Furniture Importers']);
  assert.ok(generated.body.strategy.strategy_data_json.searchKeywords.includes('restaurant furniture dealer'));
  assert.ok(generated.body.strategy.strategy_data_json.searchKeywords.includes('hospitality furniture distributor'));
  assert.ok(generated.body.strategy.strategy_data_json.searchKeywords.includes('commercial furniture importer'));
  assert.ok(generated.body.strategy.strategy_data_json.searchKeywords.length>=8&&generated.body.strategy.strategy_data_json.searchKeywords.length<=20);
  assert.equal(new Set(generated.body.strategy.strategy_data_json.searchKeywords.map(keyword=>keyword.toLowerCase())).size,generated.body.strategy.strategy_data_json.searchKeywords.length);
  assert.ok(generated.body.strategy.strategy_data_json.searchKeywords.every(keyword=>!/(.+)\s+\1$/i.test(keyword)));
  assert.doesNotMatch(JSON.stringify(generated.body.strategy.strategy_data_json),/Restaurant Chains|Cafe Owners|Restaurant Owners/i);
  assert.ok(generated.body.strategy.strategy_data_json.positiveSignals.buyingSignals.includes('Restaurant renovation'));
  assert.ok(generated.body.strategy.strategy_data_json.exclusionRules.includes('Residential-only stores'));
  assert.doesNotMatch(JSON.stringify(generated.body.strategy.strategy_data_json),/Needs Clarification/);
  assert.equal(generated.body.strategy.generation_metadata_json.provider,'rules');assert.ok(generated.body.strategy.context_snapshot_id);
  assert.ok(generated.body.strategy.knowledge_references_json.some(reference=>reference.revision));
  assert.doesNotMatch(JSON.stringify(generated.body),/supplier_cost|minimum_margin|providerConfiguration|api[_-]?key/i);
  const regenerated=await call(`/api/search-strategies/${id}/generate`,sales,'POST',{provider:'rules'});
  assert.equal(regenerated.body.strategy.id,id);assert.equal(regenerated.body.strategy.revision_no,1);assert.deepEqual(regenerated.body.strategy.strategy_data_json.targetMarket.countries,['United States']);
  assert.equal((await call('/api/search-strategies',sales)).body.strategies.length,countBeforeGenerate);
  const estimate=await call(`/api/search-strategies/${id}/estimate-search-cost`,sales,'POST',{});
  assert.equal(estimate.body.estimate.estimateType,'planning');assert.match(estimate.body.estimate.assumptions.join(' '),/No connector call/);
  assert.equal((await call(`/api/search-strategies/${id}/submit-review`,sales,'POST',{})).body.strategy.status,'Needs Review');
  assert.equal((await call(`/api/search-strategies/${id}/approve`,sales,'POST',{})).response.status,403);
  assert.equal((await call(`/api/search-strategies/${id}/approve`,va,'POST',{})).response.status,403);
  const changes=await call(`/api/search-strategies/${id}/request-changes`,owner,'POST',{review_note:'Narrow the target market'});
  assert.equal(changes.body.strategy.status,'Draft');assert.equal(changes.body.strategy.review_note,'Narrow the target market');
  await call(`/api/search-strategies/${id}/submit-review`,sales,'POST',{});
  const approved=await call(`/api/search-strategies/${id}/approve`,owner,'POST',{review_note:'Approved for planning'});
  assert.equal(approved.body.strategy.status,'Approved');
  assert.equal((await call(`/api/search-strategies/${id}/create-search-task`,sales,'POST',{})).response.status,403);
  const task=await call(`/api/search-strategies/${id}/create-search-task`,owner,'POST',{});
  assert.equal(task.response.status,201,task.body.error);assert.equal(task.body.task.status,'Draft');
  const linkedArchive=await call(`/api/search-strategies/${id}/archive`,owner,'POST',{});
  assert.equal(linkedArchive.response.status,409);assert.match(linkedArchive.body.error,/Search Task #\d+ is Draft/);
  assert.equal((await call(`/api/search-strategies/${id}`,owner)).body.strategy.status,'Approved');
  assert.equal((await call(`/api/search-tasks/${task.body.task.id}/ready`,sales,'POST',{connectorKey:'rules-mock'})).response.status,403);
  const ready=await call(`/api/search-tasks/${task.body.task.id}/ready`,owner,'POST',{connectorKey:'rules-mock'});assert.equal(ready.response.status,200,ready.body.error);
  const connectors=await call('/api/search-connectors',sales);assert.deepEqual(connectors.body.connectors.map(item=>item.key),['rules-mock']);
  const executionEstimate=await call(`/api/search-tasks/${task.body.task.id}/estimate-execution`,sales,'POST',{connectorKey:'rules-mock'});assert.equal(executionEstimate.body.estimate.expected,0);
  const createdExecution=await call(`/api/search-tasks/${task.body.task.id}/create-execution`,sales,'POST',{connectorKey:'rules-mock',idempotencyKey:`workflow-1c-${task.body.task.id}`});
  assert.equal(createdExecution.body.execution.status,'Awaiting Approval');
  assert.equal((await call(`/api/search-executions/${createdExecution.body.execution.id}/start`,owner,'POST',{})).response.status,409);
  assert.equal((await call(`/api/search-executions/${createdExecution.body.execution.id}/approve`,sales,'POST',{})).response.status,403);
  assert.equal((await call(`/api/search-executions/${createdExecution.body.execution.id}/approve`,owner,'POST',{})).body.execution.status,'Approved');
  const executed=await call(`/api/search-executions/${createdExecution.body.execution.id}/start`,owner,'POST',{});assert.equal(executed.body.execution.status,'Completed');assert.ok(executed.body.execution.inserted_count>0);assert.ok(executed.body.execution.duplicate_count>0);
  const connectorResults=await call(`/api/search-executions/${createdExecution.body.execution.id}/results`,sales);assert.ok(connectorResults.body.results.every(result=>result.evidence_json.connectorKey==='rules-mock'&&result.captured_at&&result.search_execution_id));
  const pendingLead=await call(`/api/search-results/${connectorResults.body.results[0].id}`,sales);assert.equal(pendingLead.body.result.ai_qualification_status,'Pending');assert.equal(pendingLead.body.result.ai_qualification_at,null);
  const safeLeadPayload=JSON.stringify(pendingLead.body);assert.doesNotMatch(safeLeadPayload,/payload_json|authorization|api_key|secret|token/i);assert.equal(pendingLead.body.result.evidence_json.connectorKey,'rules-mock');assert.equal(pendingLead.body.result.evidence_json.externalId,'mock-001');
  const customerCountBeforeQualification=(await call('/api/customers',owner)).body.customers.length;
  const qualifiedLead=await call(`/api/search-results/${pendingLead.body.result.id}`,owner,'PUT',pendingLead.body.result);assert.equal(qualifiedLead.response.status,200,qualifiedLead.body.error);assert.equal(qualifiedLead.body.result.ai_qualification_status,'Qualified');assert.ok(qualifiedLead.body.result.ai_qualification_at);
  assert.equal((await call('/api/customers',owner)).body.customers.length,customerCountBeforeQualification);
  const revision=await call(`/api/search-strategies/${id}`,sales,'PUT',{title:'AI Restaurant Growth Search v2',strategy_data_json:{...approved.body.strategy.strategy_data_json,searchObjective:'Find multi-location restaurant groups planning expansion'}});
  assert.equal(revision.body.strategy.revision_no,2);assert.equal(revision.body.strategy.status,'Draft');
  assert.equal((await call(`/api/search-strategies/${id}`,owner)).body.strategy.status,'Approved');
  await call(`/api/search-strategies/${revision.body.strategy.id}/submit-review`,sales,'POST',{});
  await call(`/api/search-strategies/${revision.body.strategy.id}/approve`,owner,'POST',{});
  const history=await call(`/api/search-strategies/${revision.body.strategy.id}/history`,owner);
  assert.deepEqual(history.body.history.map(item=>item.status),['Approved','Superseded']);
  assert.equal((await call(`/api/search-strategies/${revision.body.strategy.id}/archive`,sales,'POST',{})).response.status,403);
  const archived=await call(`/api/search-strategies/${revision.body.strategy.id}/archive`,owner,'POST',{});
  assert.equal(archived.response.status,200,archived.body.error);assert.equal(archived.body.strategy.status,'Archived');
  assert.ok((await call('/api/search-strategies',owner)).body.strategies.some(item=>item.id===revision.body.strategy.id&&item.status==='Archived'));
  assert.equal((await call(`/api/search-tasks/${task.body.task.id}`,owner)).body.task.id,task.body.task.id);
  assert.equal((await call('/api/search-strategies',designer)).response.status,403);
  const debug=await call('/api/debug/system',admin);assert.ok(debug.body.opportunityIntelligence.search_strategies_count>=2);assert.equal(typeof debug.body.opportunityIntelligence.blocked_strategy_task_attempts,'number');
  const logs=await call('/api/ai-cost/logs',admin);assert.ok(logs.body.logs.some(log=>log.module_name==='search-strategy'&&log.status==='executed'));
  const detail=await call(`/api/search-tasks/${task.body.task.id}`,owner);assert.equal(detail.body.task.search_results.length,executed.body.execution.inserted_count);
});

test('Owner and Sales Admin can create and edit Product Library records', async () => {
  const owner = await login('owner@rspro.ai');
  const salesAdmin = await login('salesadmin@rspro.ai');
  assert.equal(owner.response.status, 200);
  assert.equal(salesAdmin.response.status, 200);
  assert.equal(salesAdmin.body.user.businessRole, 'Sales Admin');
  const categories = await fetch(`http://127.0.0.1:${port}/api/product-categories`, { headers: { Cookie: owner.cookie } }).then(response => response.json());
  const chair = categories.categories.find(category => category.name === 'Dining Chair');
  const createAs = async (session, sku, name) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/products`, { method: 'POST', headers: { Cookie: session.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ category_id: chair.id, sku, name, status: 'approved', library_status: 'Active', visibility: 'Website + Quote' }) });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.ok(body.product.id);
    const edit = await fetch(`http://127.0.0.1:${port}/api/products/${body.product.id}`, { method: 'PUT', headers: { Cookie: session.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body.product, name: `${name} Updated`, tag_ids: body.product.tag_ids }) });
    assert.equal(edit.status, 200);
    return body.product.id;
  };
  const ownerProductId = await createAs(owner, 'ALPHA008-OWNER', 'Owner Created Chair');
  const salesAdminProductId = await createAs(salesAdmin, 'ALPHA008-SA', 'Sales Admin Created Chair');
  const library = await fetch(`http://127.0.0.1:${port}/api/products`, { headers: { Cookie: owner.cookie } }).then(response => response.json());
  assert.ok(library.products.some(product => product.id === ownerProductId && product.name.endsWith('Updated')));
  assert.ok(library.products.some(product => product.id === salesAdminProductId && product.name.endsWith('Updated')));
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
  const debug = await fetch(`http://127.0.0.1:${port}/api/debug/system`, { headers: { Cookie: sales.cookie } });
  assert.equal(debug.status, 403);
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

test('Module 06A Supplement 01 controls AI budgets, confirmations, logs, providers, and cache', async () => {
  const admin = await login('admin@rspro.ai');
  const sales = await login('sales@rspro.ai');

  const settingsResponse = await fetch(`http://127.0.0.1:${port}/api/ai-cost/settings`, { headers: { Cookie: admin.cookie } });
  const settings = await settingsResponse.json();
  assert.equal(settingsResponse.status, 200);
  assert.equal(settings.settings.daily_budget_usd, 2);
  assert.equal(settings.settings.monthly_budget_usd, 50);
  assert.equal(settings.settings.allow_paid_provider, false);
  assert.equal(settings.settings.cache_ttl_days, 7);

  const salesUpdate = await fetch(`http://127.0.0.1:${port}/api/ai-cost/settings`, {
    method: 'PUT', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ allow_paid_provider: true })
  });
  assert.equal(salesUpdate.status, 403);

  const estimateResponse = await fetch(`http://127.0.0.1:${port}/api/ai-cost/estimate`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ module_name: 'test', action_name: 'batch-test', entity_type: 'test', entity_id: '1', provider: 'openai', estimated_cost_usd: 0.02 })
  });
  const estimate = await estimateResponse.json();
  assert.equal(estimateResponse.status, 201);
  assert.equal(estimate.estimate.requires_confirmation, true);
  const confirmation = await fetch(`http://127.0.0.1:${port}/api/ai-cost/confirm`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ log_id: estimate.estimate.id })
  });
  assert.equal(confirmation.status, 200);

  const library = await fetch(`http://127.0.0.1:${port}/api/products`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const product = library.products.find(item => item.sku === 'CH-JP-505');
  const detail = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const source = detail.product.media.find(media => media.image_type === 'Main Image');
  const createTask = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_media_id: source.id, image_type: 'Detail Image', generation_mode: 'standard', provider: 'openai', prompt: 'Cost control fallback test.' })
  }).then(response => response.json());
  const runTask = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/image-generation-tasks/${createTask.imageTask.id}/run`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true })
  }).then(response => response.json());
  assert.equal(runTask.imageTask.provider, 'mock');

  const customers = await fetch(`http://127.0.0.1:${port}/api/customers`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const customerId = customers.customers[0].id;
  const firstRun = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/run-ai`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ regenerate: true, confirmed: true })
  }).then(response => response.json());
  assert.ok(firstRun.customer);
  const cachedRun = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/run-ai`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: '{}'
  }).then(response => response.json());
  assert.equal(cachedRun.cached, true);

  const dashboard = await fetch(`http://127.0.0.1:${port}/api/ai-cost/dashboard`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(dashboard.blockedRuns >= 1);
  const logs = await fetch(`http://127.0.0.1:${port}/api/ai-cost/logs`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(logs.logs.some(log => log.status === 'blocked' && log.blocked_reason === 'Paid provider is disabled.'));
  assert.ok(logs.logs.some(log => log.status === 'cached'));
  assert.ok(logs.logs.some(log => log.provider === 'rules' && log.status === 'executed'));

  const debug = await fetch(`http://127.0.0.1:${port}/api/debug/system`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.equal(debug.aiCostControl.settingsStatus, 'ready');
  assert.ok(debug.aiCostControl.logsCount > 0);
  assert.ok(debug.aiCostControl.cacheRecordsCount > 0);
});

test('V5.3 Phase 1 AI Business Brain runs through context, provider, cost control, and logging without mutating source records', async () => {
  const admin = await login('admin@rspro.ai');
  const sales = await login('sales@rspro.ai');
  const library = await fetch(`http://127.0.0.1:${port}/api/products`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  const product = library.products.find(item => item.sku === 'CH-JP-505') || library.products[0];
  assert.ok(product?.id);
  const before = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}`, { headers: { Cookie: admin.cookie } }).then(response => response.json());

  const runResponse = await fetch(`http://127.0.0.1:${port}/api/ai-brain/actions/run`, {
    method: 'POST',
    headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moduleName: 'ai-business-brain',
      actionName: 'foundation-check',
      entityType: 'product',
      entityId: product.id,
      contextType: 'product',
      promptTemplateKey: 'v53.foundation.mock.v1',
      options: { provider: 'rules' }
    })
  });
  const run = await runResponse.json();
  assert.equal(runResponse.status, 200);
  assert.equal(run.status, 'completed');
  assert.equal(run.provider, 'rules');
  assert.equal(run.result.outputType, 'analysis');
  assert.equal(run.result.reviewRequired, true);
  assert.ok(run.result.guardrails.some(item => item.includes('No source-of-truth')));
  assert.ok(run.executionLogId);
  assert.ok(run.contextSnapshotId);

  const after = await fetch(`http://127.0.0.1:${port}/api/products/${product.id}`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.equal(after.product.id, before.product.id);
  assert.equal(after.product.sku, before.product.sku);
  assert.equal(after.product.name, before.product.name);

  const status = await fetch(`http://127.0.0.1:${port}/api/ai-brain/status`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.equal(status.status, 'ready');
  assert.ok(status.promptTemplates >= 1);
  assert.ok(status.contextSnapshots >= 1);
  assert.ok(status.executionLogs >= 1);
  assert.ok(status.completedRuns >= 1);

  const logs = await fetch(`http://127.0.0.1:${port}/api/ai-cost/logs`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(logs.logs.some(log => log.module_name === 'ai-business-brain' && log.action_name === 'foundation-check' && log.status === 'executed'));

  const forbidden = await fetch(`http://127.0.0.1:${port}/api/ai-brain/actions/run`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ moduleName: 'ai-business-brain', actionName: 'foundation-check', entityType: 'product', entityId: product.id, contextType: 'product' })
  });
  assert.equal(forbidden.status, 403);

  const debug = await fetch(`http://127.0.0.1:${port}/api/debug/system`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.equal(debug.aiBusinessBrain.status, 'ready');
  assert.ok(debug.aiBusinessBrain.executionLogs >= 1);
});

test('V5.3 Phase 2A Customer Intelligence separates customer value, buying opportunity, priority, and feedback', async () => {
  const admin = await login('admin@rspro.ai');
  const sales = await login('sales@rspro.ai');
  const create = await fetch(`http://127.0.0.1:${port}/api/customers`, {
    method: 'POST',
    headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: 'Phase 2A Hospitality Supply',
      business_type: 'Hospitality Furniture Distributor',
      country: 'United States',
      city: 'Los Angeles',
      website: 'https://phase2a.example.com',
      source: 'Manual',
      source_confidence: 80
    })
  });
  const created = await create.json();
  assert.equal(create.status, 201, created.error);
  const customerId = created.customer.id;

  const firstRun = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/customer-intelligence/run`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_type: 'Hospitality Furniture Distributor', industry: 'Hospitality Furniture' })
  });
  const first = await firstRun.json();
  assert.equal(firstRun.status, 200, first.error);
  assert.equal(first.customer.customer_type, 'Hospitality Furniture Distributor');
  assert.equal(first.customer.industry, 'Hospitality Furniture');
  assert.ok(first.customer.customer_value_score >= 70);
  assert.equal(first.customer.purchase_timing, 'Unknown');
  assert.equal(first.customer.purchase_timing_confidence, 'Low');
  assert.ok(first.customer.sales_priority_score > 0);
  assert.ok(first.customer.intelligence_profiles.length >= 1);
  assert.ok(first.customer.score_history.some(row => row.score_type === 'customer_value'));
  assert.ok(first.ai.executionLogId);

  const secondRun = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/customer-intelligence/run`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_information: 'New restaurant project opening soon, RFQ for tables and chairs.',
      expected_purchase_timing: 'Near term',
      opportunity_notes: 'Customer asked for a commercial furniture package quote.'
    })
  });
  const second = await secondRun.json();
  assert.equal(secondRun.status, 200, second.error);
  assert.equal(second.customer.purchase_timing, 'Near term');
  assert.equal(second.customer.purchase_timing_confidence, 'High');
  assert.ok(second.customer.buying_opportunity_score > first.customer.buying_opportunity_score);

  const feedbackResponse = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/customer-intelligence/feedback`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback_type: 'Interested', feedback_note: 'Sales confirmed distributor wants future package pricing.' })
  });
  const feedback = await feedbackResponse.json();
  assert.equal(feedbackResponse.status, 201, feedback.error);
  assert.equal(feedback.feedback.feedback_type, 'Interested');
  assert.ok(feedback.customer.intelligence_feedback.some(item => item.feedback_type === 'Interested'));

  const updateResponse = await fetch(`http://127.0.0.1:${port}/api/customers/${customerId}/customer-intelligence/updates`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      update_reason: 'New customer requirement',
      original_input: 'Customer is planning a second restaurant location and asked about booth seating.',
      reference_note: 'Future attachment placeholder: customer-wechat-note.png'
    })
  });
  const update = await updateResponse.json();
  assert.equal(updateResponse.status, 201, update.error);
  assert.equal(update.update.update_reason, 'New customer requirement');
  assert.match(update.update.ai_summary, /Latest customer situation:/);
  assert.match(update.update.ai_summary, /Important changes:/);
  assert.match(update.update.ai_summary, /Opportunity impact:/);
  assert.match(update.update.ai_summary, /Recommended next action:/);
  assert.ok(update.customer.intelligence_updates.some(item => item.id === update.update.id));
  assert.equal(update.customer.project_information, 'New restaurant project opening soon, RFQ for tables and chairs.');

  const priority = await fetch(`http://127.0.0.1:${port}/api/customer-intelligence/priority`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.ok(priority.customers.some(customer => customer.id === customerId));

  const logs = await fetch(`http://127.0.0.1:${port}/api/ai-cost/logs`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(logs.logs.some(log => log.module_name === 'customer-intelligence' && log.action_name === 'phase2a-score-explanation' && log.status === 'executed'));
  assert.ok(logs.logs.some(log => log.module_name === 'customer-intelligence' && log.action_name === 'manual-intelligence-update' && log.status === 'executed'));

  const debug = await fetch(`http://127.0.0.1:${port}/api/debug/system`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(debug.opportunityIntelligence.customer_intelligence_profiles_count >= 2);
  assert.ok(debug.opportunityIntelligence.customer_intelligence_feedback_count >= 1);
  assert.ok(debug.opportunityIntelligence.score_history_count >= 3);
});

test('V3.1 Restaurant owner scoring uses owner-specific opportunity factors', async () => {
  const admin = await login('admin@rspro.ai');
  const sales = await login('sales@rspro.ai');
  const create = await fetch(`http://127.0.0.1:${port}/api/customers`, {
    method: 'POST',
    headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: 'V3.1 Cafe Owner Test',
      business_type: 'Cafe Owner',
      country: 'United States',
      city: 'Pasadena',
      website: 'https://v31-cafe.example.com',
      years_in_business: 5,
      renovation_probability: 80,
      expansion_probability: 70,
      source: 'Manual',
      source_confidence: 85
    })
  });
  const created = await create.json();
  assert.equal(create.status, 201, created.error);

  const runResponse = await fetch(`http://127.0.0.1:${port}/api/customers/${created.customer.id}/customer-intelligence/run`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_type: 'Cafe Owner',
      industry: 'Hospitality Furniture',
      opportunity_notes: 'Owner mentioned renovation planning and possible new location expansion.'
    })
  });
  const run = await runResponse.json();
  assert.equal(runResponse.status, 200, run.error);
  assert.equal(run.customer.customer_type, 'Cafe Owner');
  assert.ok(run.customer.buying_opportunity_score >= 70);
  assert.match(run.customer.buying_opportunity_explanation, /Renovation Opportunity 24\/30/);
  assert.match(run.customer.buying_opportunity_explanation, /Years Operating 30\/30/);
  assert.match(run.customer.buying_opportunity_explanation, /Expansion Signal 16\/20/);
  assert.match(run.customer.buying_opportunity_explanation, /Contact Availability 20\/20/);
});

test('V5.3 Opportunity Intelligence V2 creates AI customer discovery plans with dynamic scoring profiles', async () => {
  const admin = await login('admin@rspro.ai');
  const sales = await login('sales@rspro.ai');

  const configResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/config`, { headers: { Cookie: sales.cookie } });
  const config = await configResponse.json();
  assert.equal(configResponse.status, 200, config.error);
  assert.ok(config.customerTypes.some(profile => profile.customer_type === 'Restaurant Furniture Distributor'));
  assert.ok(config.customerTypes.some(profile => profile.customer_type === 'Restaurant Interior Design Company'));
  for (const ownerType of ['Independent Restaurant Owner', 'Multi-location Restaurant Group', 'Cafe Owner', 'Bar Owner', 'Bubble Tea Shop Owner']) {
    assert.ok(config.customerTypes.some(profile => profile.customer_type === ownerType), `${ownerType} should be available`);
  }
  const ownerProfile = config.customerTypes.find(profile => profile.customer_type === 'Independent Restaurant Owner');
  assert.ok(ownerProfile.dimensions.some(dimension => dimension.name === 'Renovation Opportunity' && dimension.weight === 30));
  assert.ok(ownerProfile.dimensions.some(dimension => dimension.name === 'Years Operating' && dimension.weight === 30));
  assert.ok(ownerProfile.dimensions.some(dimension => dimension.name === 'Expansion Signal' && dimension.weight === 20));
  assert.ok(ownerProfile.dimensions.some(dimension => dimension.name === 'Contact Availability' && dimension.weight === 20));

  const distributorResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/analyze`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_text: 'Find restaurant furniture suppliers in California' })
  });
  const distributor = await distributorResponse.json();
  assert.equal(distributorResponse.status, 201, distributor.error);
  assert.equal(distributor.plan.target_customer_type, 'Restaurant Furniture Distributor');
  assert.equal(distributor.plan.country, 'USA');
  assert.equal(distributor.plan.region_city, 'California');
  assert.ok(distributor.plan.recommended_keywords.includes('restaurant furniture supplier'));
  assert.ok(distributor.scoring_profile.dimensions.some(dimension => dimension.name === 'Business Match' && dimension.weight === 40));
  assert.equal(distributor.ai.provider, 'rules');
  assert.ok(distributor.ai.executionLogId);

  const incompleteResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/generate-plan`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_text: 'Find restaurant customers' })
  });
  const incomplete = await incompleteResponse.json();
  assert.equal(incompleteResponse.status, 201, incomplete.error);
  assert.equal(incomplete.guidance.needs_more_information, true);
  assert.equal(incomplete.generated_search_plan.status, 'Draft Search Plan');
  assert.ok(incomplete.generated_search_plan.recommended_data_fields.includes('Company Name'));
  assert.ok(incomplete.generated_search_plan.recommended_data_fields.includes('LinkedIn'));
  assert.ok(incomplete.guidance.suggestions.includes('Target country'));
  assert.ok(incomplete.guidance.suggestions.includes('Company size'));

  const generatedResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/generate-plan`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_text: 'Find restaurant furniture distributors in California' })
  });
  const generated = await generatedResponse.json();
  assert.equal(generatedResponse.status, 201, generated.error);
  assert.equal(generated.action_name, 'generate-search-plan');
  assert.equal(generated.generated_search_plan.status, 'Ready for Search');
  assert.equal(generated.generated_search_plan.customer_type, 'Restaurant Furniture Distributor');
  assert.match(generated.generated_search_plan.search_objective, /sales qualification/i);
  assert.deepEqual(generated.generated_search_plan.recommended_filters, ['Location', 'Company Size', 'Customer Type', 'Decision Maker', 'Business Type', 'Purchase Potential']);
  assert.ok(generated.generated_search_plan.search_keywords.includes('hospitality furniture distributor'));
  assert.ok(generated.generated_search_plan.exclude.includes('Residential furniture stores'));
  assert.equal(generated.generated_search_plan.priority, 'High');
  assert.equal(generated.generated_search_plan.recommended_search_volume, '100 companies');
  assert.ok(generated.generated_search_plan.priority_reasons.includes('Hospitality related business'));
  assert.ok(generated.generated_search_plan.priority_reasons.includes('Potential repeat buyer'));

  const sizedResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/generate-plan`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_text: 'Find restaurant furniture distributors in California with 5-50 employees' })
  });
  const sized = await sizedResponse.json();
  assert.equal(sizedResponse.status, 201, sized.error);
  assert.equal(sized.generated_search_plan.company_size, 'Small company');
  assert.equal(sized.generated_search_plan.company_size_detail, '5-50 employees');
  assert.match(sized.generated_search_plan.target_customer, /Small company/);

  const directTaskResponse = await fetch(`http://127.0.0.1:${port}/api/search-tasks`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_discovery_request_id: sized.request.id, generated_search_plan: sized.generated_search_plan })
  });
  assert.equal(directTaskResponse.status, 409);
  const strategyData = {
    targetMarket: { countries: ['USA'], cities: ['California'], regions: [] },
    targetCustomerProfile: { customerTypes: ['Restaurant Furniture Distributor'], companySize: { description: '5-50 employees' }, businessAge: {}, locationCount: {}, expectedOrderRange: {} },
    searchObjective: sized.generated_search_plan.search_objective, productCategories: ['Restaurant Furniture'],
    searchKeywords: sized.generated_search_plan.search_keywords, negativeKeywords: [], platforms: ['Company Websites'], sourcePriority: ['Company Websites'],
    positiveSignals: { buyingSignals: [], renovationSignals: [], expansionSignals: [] }, exclusionRules: sized.generated_search_plan.recommended_filters,
    resultTarget: { expectedCount: 100, minimumQualifiedCount: 20 }, stopConditions: [], reasoning: [], warnings: [], confidence: 0.8
  };
  const strategyResponse = await fetch(`http://127.0.0.1:${port}/api/search-strategies`, { method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ customer_discovery_request_id: sized.request.id, title: 'Distributor Search Strategy', objective: strategyData.searchObjective, strategy_data_json: strategyData }) });
  const strategy = await strategyResponse.json(); assert.equal(strategyResponse.status, 201, strategy.error);
  await fetch(`http://127.0.0.1:${port}/api/search-strategies/${strategy.strategy.id}/submit-review`, { method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  const approveResponse = await fetch(`http://127.0.0.1:${port}/api/search-strategies/${strategy.strategy.id}/approve`, { method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(approveResponse.status, 200);
  const createTaskResponse = await fetch(`http://127.0.0.1:${port}/api/search-strategies/${strategy.strategy.id}/create-search-task`, { method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  const createdTask = await createTaskResponse.json();
  assert.equal(createTaskResponse.status, 201, createdTask.error);
  assert.match(createdTask.task.task_name, /Search Task #/);
  assert.equal(createdTask.task.customer_discovery_request_id, sized.request.id);
  assert.equal(createdTask.task.target_customer, 'Restaurant Furniture Distributor');
  assert.equal(createdTask.task.customer_type, 'Restaurant Furniture Distributor');
  assert.equal(createdTask.task.industry, 'Hospitality Furniture');
  assert.equal(createdTask.task.location, 'California, USA');
  assert.equal(createdTask.task.company_size, '5-50 employees');
  assert.equal(createdTask.task.target_quantity, 100);
  assert.equal(createdTask.task.priority, 'Medium');
  assert.equal(createdTask.task.status, 'Draft');
  assert.ok(createdTask.task.keywords.includes('restaurant furniture supplier'));
  assert.ok(createdTask.task.filters.includes('Purchase Potential'));
  assert.ok(createdTask.task.required_data_fields.includes('Company Name'));
  assert.ok(createdTask.task.required_data_fields.includes('Source URL'));

  const tasks = await fetch(`http://127.0.0.1:${port}/api/search-tasks`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.ok(tasks.tasks.some(task => task.id === createdTask.task.id && task.status === 'Draft'));

  const taskDetail = await fetch(`http://127.0.0.1:${port}/api/search-tasks/${createdTask.task.id}`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.equal(taskDetail.task.id, createdTask.task.id);
  assert.equal(taskDetail.task.search_objective, sized.generated_search_plan.search_objective);

  const readyResponse = await fetch(`http://127.0.0.1:${port}/api/search-tasks/${createdTask.task.id}/ready`, {
    method: 'POST',
    headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectorKey: 'rules-mock' })
  });
  const ready = await readyResponse.json();
  assert.equal(readyResponse.status, 200, ready.error);
  assert.equal(ready.task.status, 'Ready');

  const resultResponse = await fetch(`http://127.0.0.1:${port}/api/search-tasks/${createdTask.task.id}/results`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: 'V3.2 Hospitality Distributor',
      customer_type: 'Restaurant Furniture Distributor',
      country: 'USA',
      city: 'Irvine',
      website: 'v32-distributor.example.com',
      contact_person: 'Morgan Smith',
      email: 'morgan@v32-distributor.example.com',
      phone: '+1 555 3200',
      linkedin: 'linkedin.com/company/v32-distributor',
      instagram: 'instagram.com/v32distributor',
      company_size: '5-50 employees',
      business_type: 'Hospitality furniture distributor',
      purchase_potential: 'High',
      opportunity_score: 82,
      qualification_reason: 'Distributor matches target customer type and has contact information.',
      source_type: 'Manual',
      source_reference: 'Manual alpha search'
    })
  });
  const searchResult = await resultResponse.json();
  assert.equal(resultResponse.status, 201, searchResult.error);
  assert.equal(searchResult.result.company_name, 'V3.2 Hospitality Distributor');
  assert.equal(searchResult.result.status, 'reviewed');
  assert.equal(searchResult.result.website, 'https://v32-distributor.example.com');
  assert.match(searchResult.result.opportunity_summary, /V3\.2 Hospitality Distributor/);
  assert.match(searchResult.result.why_customer_matters, /Restaurant Furniture Distributor/);
  assert.ok(searchResult.ai.executionLogId);

  const resultsList = await fetch(`http://127.0.0.1:${port}/api/search-tasks/${createdTask.task.id}/results`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.equal(resultsList.summary.total, 1);
  assert.ok(resultsList.results.some(result => result.id === searchResult.result.id));

  const resultDetail = await fetch(`http://127.0.0.1:${port}/api/search-results/${searchResult.result.id}`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.equal(resultDetail.result.company_name, 'V3.2 Hospitality Distributor');

  const editedResponse = await fetch(`http://127.0.0.1:${port}/api/search-results/${searchResult.result.id}`, {
    method: 'PUT',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...resultDetail.result, opportunity_score: 88, status: 'reviewed', purchase_potential: 'High' })
  });
  const edited = await editedResponse.json();
  assert.equal(editedResponse.status, 200, edited.error);
  assert.equal(edited.result.opportunity_score, 88);
  assert.equal(edited.result.status, 'reviewed');

  const convertResponse = await fetch(`http://127.0.0.1:${port}/api/search-results/${searchResult.result.id}/convert`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: '{}'
  });
  const converted = await convertResponse.json();
  assert.equal(convertResponse.status, 200, converted.error);
  assert.equal(converted.result.status, 'converted');
  assert.equal(converted.customer.company_name, 'V3.2 Hospitality Distributor');
  assert.equal(converted.customer.customer_type, 'Restaurant Furniture Distributor');
  assert.equal(converted.customer.customer_source, 'Search Result');
  assert.equal(converted.customer.is_test_data, false);
  assert.match(converted.customer.recommended_product_reason, /Hospitality furniture reseller/);
  assert.ok(converted.customer.contacts.some(contact => contact.email === 'morgan@v32-distributor.example.com'));

  const sourceFilteredCustomers = await fetch(`http://127.0.0.1:${port}/api/customers?customer_source=Search%20Result`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.ok(sourceFilteredCustomers.customers.some(customer => customer.id === converted.customer.id && customer.customer_source === 'Search Result'));
  const typeFilteredCustomers = await fetch(`http://127.0.0.1:${port}/api/customers?customer_type=Restaurant%20Furniture%20Distributor`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.ok(typeFilteredCustomers.customers.some(customer => customer.id === converted.customer.id));

  const simplifiedResultResponse = await fetch(`http://127.0.0.1:${port}/api/search-tasks/${createdTask.task.id}/results`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: 'V3.15.2 Quick Entry Distributor',
      customer_type: 'Restaurant Furniture Distributor',
      country: 'USA',
      city: 'Anaheim',
      source_type: 'Google Maps',
      website: 'https://v3152-distributor.example.com',
      source_url: 'https://www.google.com/maps/place/V3152+Quick+Entry+Distributor',
      reference_note: 'Found during manual Google Maps review.'
    })
  });
  const simplifiedResult = await simplifiedResultResponse.json();
  assert.equal(simplifiedResultResponse.status, 201, simplifiedResult.error);
  assert.equal(simplifiedResult.result.status, 'reviewed');
  assert.ok(simplifiedResult.result.opportunity_score > 0);
  assert.equal(simplifiedResult.result.purchase_potential, 'High');
  assert.match(simplifiedResult.result.qualification_reason, /Source evidence is saved/);
  assert.equal(simplifiedResult.result.source_url, 'https://www.google.com/maps/place/V3152+Quick+Entry+Distributor');
  assert.equal(simplifiedResult.result.reference_note, 'Found during manual Google Maps review.');
  assert.match(simplifiedResult.result.recommended_product_reason, /Hospitality furniture reseller/);

  const duplicateResult = await fetch(`http://127.0.0.1:${port}/api/search-tasks/${createdTask.task.id}/results`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: 'V3.2 Hospitality Distributor Duplicate',
      customer_type: 'Restaurant Furniture Distributor',
      country: 'USA',
      city: 'Irvine',
      website: 'https://v32-distributor.example.com',
      opportunity_score: 72
    })
  }).then(response => response.json());
  const duplicateConvertResponse = await fetch(`http://127.0.0.1:${port}/api/search-results/${duplicateResult.result.id}/convert`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: '{}'
  });
  const duplicateConvert = await duplicateConvertResponse.json();
  assert.equal(duplicateConvertResponse.status, 409);
  assert.equal(duplicateConvert.error, 'Possible existing customer found.');
  assert.equal(duplicateConvert.duplicate.company_name, 'V3.2 Hospitality Distributor');

  const discardResponse = await fetch(`http://127.0.0.1:${port}/api/search-results/${duplicateResult.result.id}/discard`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: '{}'
  });
  const discarded = await discardResponse.json();
  assert.equal(discardResponse.status, 200, discarded.error);
  assert.equal(discarded.result.status, 'discarded');

  const designResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/analyze`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_text: 'Find restaurant design companies in Texas' })
  });
  const design = await designResponse.json();
  assert.equal(designResponse.status, 201, design.error);
  assert.equal(design.plan.target_customer_type, 'Restaurant Interior Design Company');
  assert.ok(design.scoring_profile.dimensions.some(dimension => dimension.name === 'Project Capability' && dimension.weight === 40));

  const cafeResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/analyze`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_text: 'Find cafe owners in California' })
  });
  const cafe = await cafeResponse.json();
  assert.equal(cafeResponse.status, 201, cafe.error);
  assert.equal(cafe.plan.target_customer_type, 'Cafe Owner');
  assert.ok(cafe.scoring_profile.dimensions.some(dimension => dimension.name === 'Years Operating' && dimension.weight === 30));

  const bubbleTeaResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/analyze`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_text: 'Find bubble tea shop owners in Texas' })
  });
  const bubbleTea = await bubbleTeaResponse.json();
  assert.equal(bubbleTeaResponse.status, 201, bubbleTea.error);
  assert.equal(bubbleTea.plan.target_customer_type, 'Bubble Tea Shop Owner');

  const barResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/analyze`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_text: 'Find bar owners in Florida' })
  });
  const bar = await barResponse.json();
  assert.equal(barResponse.status, 201, bar.error);
  assert.equal(bar.plan.target_customer_type, 'Bar Owner');

  const groupResponse = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/analyze`, {
    method: 'POST',
    headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ request_text: 'Find multi-location restaurant groups in California' })
  });
  const group = await groupResponse.json();
  assert.equal(groupResponse.status, 201, group.error);
  assert.equal(group.plan.target_customer_type, 'Multi-location Restaurant Group');

  const createCustomer = await fetch(`http://127.0.0.1:${port}/api/customers`, {
    method: 'POST',
    headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: 'Discovery Flow Furniture Supplier',
      business_type: distributor.plan.target_customer_type,
      country: distributor.plan.country,
      city: distributor.plan.region_city,
      source: 'Manual',
      is_test_data: true
    })
  });
  const created = await createCustomer.json();
  assert.equal(createCustomer.status, 201, created.error);
  assert.equal(created.customer.customer_source, 'Manual Import');
  assert.equal(created.customer.is_test_data, true);
  const customers = await fetch(`http://127.0.0.1:${port}/api/customers?q=Discovery%20Flow`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.ok(customers.customers.some(customer => customer.company_name === 'Discovery Flow Furniture Supplier'));

  for (const source of ['Google Maps', 'Website', 'Instagram', 'Facebook']) {
    const sourceCustomerResponse = await fetch(`http://127.0.0.1:${port}/api/customers`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: `V3.2.1 ${source} Source Customer`,
        business_type: 'Restaurant Furniture Distributor',
        country: 'USA',
        city: 'Los Angeles',
        source
      })
    });
    const sourceCustomer = await sourceCustomerResponse.json();
    assert.equal(sourceCustomerResponse.status, 201, sourceCustomer.error);
    assert.equal(sourceCustomer.customer.customer_source, source);
  }
  const googleMapsUrlCustomerResponse = await fetch(`http://127.0.0.1:${port}/api/customers`, {
    method: 'POST',
    headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: 'V3.2.1.1 Restaurant Furniture Wooden',
      business_type: 'Restaurant Furniture Distributor',
      country: 'USA',
      city: 'Los Angeles',
      source: 'Manual',
      google_maps_url: 'https://www.google.com/maps/place/Restaurant+Furniture+Wooden'
    })
  });
  const googleMapsUrlCustomer = await googleMapsUrlCustomerResponse.json();
  assert.equal(googleMapsUrlCustomerResponse.status, 201, googleMapsUrlCustomer.error);
  assert.equal(googleMapsUrlCustomer.customer.customer_source, 'Google Maps');
  const googleMapsFilteredCustomers = await fetch(`http://127.0.0.1:${port}/api/customers?customer_source=Google%20Maps`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.ok(googleMapsFilteredCustomers.customers.some(customer => customer.id === googleMapsUrlCustomer.customer.id && customer.customer_source === 'Google Maps'));

  const history = await fetch(`http://127.0.0.1:${port}/api/customer-discovery/requests`, { headers: { Cookie: sales.cookie } }).then(response => response.json());
  assert.ok(history.requests.length >= 3);
  assert.ok(history.requests.some(request => request.target_customer_type === 'Restaurant Furniture Distributor'));

  const logs = await fetch(`http://127.0.0.1:${port}/api/ai-cost/logs`, { headers: { Cookie: admin.cookie } }).then(response => response.json());
  assert.ok(logs.logs.some(log => log.module_name === 'customer-discovery' && log.action_name === 'analyze-requirement' && log.status === 'executed'));
  assert.ok(logs.logs.some(log => log.module_name === 'opportunity-intelligence' && log.action_name === 'search-result-qualification' && log.status === 'executed'));

  const appJs = await fetch(`http://127.0.0.1:${port}/app.js`).then(response => response.text());
  assert.match(appJs, /AI Discovery/);
  assert.match(appJs, /Describe your ideal customer/);
  assert.match(appJs, /Customer Discovery Plan/);
  assert.match(appJs, /Generated Search Plan/);
  assert.match(appJs, /Create Search Task/);
  assert.match(appJs, /Search Tasks/);
  assert.match(appJs, /Mark Ready/);
  assert.match(appJs, /Estimate Execution/);
  assert.match(appJs, /AI Qualification Pending/);
  assert.match(appJs, /aiStatus==='Qualified'\?'AI Qualified'/);
  assert.match(appJs, /Source & Evidence/);
  assert.match(appJs, /Connector Version/);
  assert.match(appJs, /Normalization Version/);
  assert.match(appJs, /Search Execution/);
  assert.match(appJs, /View Source/);
  assert.match(appJs, /Recommended Data Fields/);
  assert.match(appJs, /Recommended Search Volume/);
  assert.match(appJs, /Update Customer Intelligence/);
  assert.match(appJs, /New salesperson handoff/);
  assert.match(appJs, /Future Attachment/);
  assert.match(appJs, /Search Results/);
  assert.match(appJs, /Lead Pool/);
  assert.match(appJs, /Lead Detail/);
  assert.match(appJs, /Customers CRM/);
  assert.match(appJs, /Add Search Result/);
  assert.match(appJs, /Save Search Result/);
  const stylesCss=await fetch(`http://127.0.0.1:${port}/styles.css`).then(response=>response.text());
  assert.match(stylesCss,/\.lead-pool-table\{[^}]*table-layout:fixed/);
  assert.match(stylesCss,/\.lead-recommendation\{white-space:normal/);
  assert.match(stylesCss,/\.lead-actions-cell\{position:sticky;right:0/);
  assert.match(stylesCss,/@media\(max-width:900px\)\{\.lead-pool-table\{min-width:920px/);
  assert.match(appJs, /Contact Information \(Optional\)/);
  assert.match(appJs, /Customer Evidence/);
  assert.match(appJs, /AI Analysis Completed/);
  assert.match(appJs, /Customer Evidence History/);
  assert.match(appJs, /Convert to Customer/);
  assert.match(appJs, /30-second entry/);
  assert.match(appJs, /Analyze Selected Customers/);
  assert.match(appJs, /AI Customer Analysis/);
  assert.match(appJs, /\$0\/customer \(Rule-based analysis\)/);
  assert.match(appJs, /Total Estimated Cost/);
  assert.match(appJs, /AI analysis will update scoring fields/);
  assert.match(appJs, /Existing customer information will not be deleted/);
  assert.match(appJs, /Opportunity Analysis/);
  assert.match(appJs, /Customer Source/);
  assert.match(appJs, /TEST/);
});

test('Module 07 Part 1 completes the simple inquiry to quote and order workflow', async () => {
  const admin = await login('admin@rspro.ai');
  await fetch(`http://127.0.0.1:${port}/api/customers`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_name: 'Module 07 Coffee Group', country: 'Malaysia', city: 'Kuala Lumpur', source: 'Manual' })
  });
  const sales = await login('sales@rspro.ai');
  assert.ok(['new-inquiry', 'sales-customers', 'sales-quotes', 'sales-orders', 'sales-tasks'].every(permission => sales.body.user.permissions.includes(permission)));
  const workspace = await fetch(`http://127.0.0.1:${port}/api/sales-workspace`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  assert.ok(workspace.customers.length >= 4);
  assert.ok(['California Coffee Lab', 'Tokyo Sushi House', 'Harbor Bakery Cafe', 'Metro Bubble Tea'].every(name => workspace.customers.some(customer => customer.company_name === name)));
  assert.deepEqual(workspace.inquiryTypes, ['Product Inquiry', 'Restaurant Project', 'Freight Quote', 'Mixed Inquiry']);
  const newLeadResponse = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_mode: 'new', new_customer: { customer_name: 'Alpha Test Bistro', company: 'Alpha Test Hospitality LLC', country: 'United States', contact_name: 'Alex Rivera', email: 'alex@example.com', phone: '+1 555 0100', source: 'Website' }, inquiry_type: 'Restaurant Project', customer_message: 'Hi, We are opening a California coffee shop. Need: 50 dining chairs, 15 restaurant tables, one custom booth seating. Please quote DDP Los Angeles. Thank you.', priority: 'High' })
  });
  const newLead = await newLeadResponse.json();
  assert.equal(newLeadResponse.status, 201);
  assert.equal(newLead.customer_created, true);
  assert.equal(newLead.inquiry.customer_name, 'Alpha Test Hospitality LLC');
  const newLeadAnalyze = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${newLead.inquiry.id}/analyze`, { method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(newLeadAnalyze.status, 200);
  const newLeadAnalyzed = await newLeadAnalyze.json();
  const quantitiesByCategory = Object.fromEntries(newLeadAnalyzed.inquiry.products.map(product => [product.category, product.quantity]));
  assert.equal(quantitiesByCategory['Dining Chair'], 50);
  assert.equal(quantitiesByCategory['Restaurant Table'], 15);
  assert.equal(quantitiesByCategory['Booth Seating'], 1);
  const extractedQuoteResponse = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${newLead.inquiry.id}/quote`, { method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  const extractedQuote = await extractedQuoteResponse.json();
  assert.equal(extractedQuoteResponse.status, 201);
  assert.equal(extractedQuote.quote.trade_term, 'DDP');
  assert.equal(extractedQuote.quote.destination, 'Los Angeles');
  assert.equal(extractedQuote.quote.shipping_method, 'Sea');
  assert.deepEqual(Object.fromEntries(extractedQuote.quote.items.map(item => [item.category, item.quantity])), { 'Booth Seating': 1, 'Dining Chair': 50, 'Restaurant Table': 15 });
  assert.equal(extractedQuote.quote.summary.grand_total, extractedQuote.quote.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0));
  const newLeadWorkspace = await fetch(`http://127.0.0.1:${port}/api/sales-workspace`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  assert.ok(newLeadWorkspace.customers.some(customer => customer.company_name === 'Alpha Test Hospitality LLC'));
  const customer = workspace.customers[0];
  const createResponse = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_id: customer.id, inquiry_type: 'Mixed Inquiry', customer_message: 'We are opening a coffee shop and need 60 chairs and tables with DDP Malaysia.', country: 'Malaysia', priority: 'High' })
  });
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(created.inquiry.status, 'New');

  const analyzedResponse = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${created.inquiry.id}/analyze`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: '{}'
  });
  const analyzed = await analyzedResponse.json();
  assert.equal(analyzedResponse.status, 200);
  assert.equal(analyzed.inquiry.analysis.restaurant_type, 'Coffee Shop');
  assert.equal(analyzed.inquiry.analysis.opportunity_size, 'Large');
  assert.ok(analyzed.inquiry.products.length > 0);
  assert.ok(analyzed.inquiry.products.every(item => item.product_id && item.sku && item.name));
  const defaultSelections = analyzed.inquiry.products.filter(item => item.selected);
  assert.ok(defaultSelections.length > 0, 'relevant AI recommendations are selected by default');
  assert.equal(new Set(defaultSelections.map(item => item.category)).size, defaultSelections.length, 'only the best product in each requested category is selected');

  const selected = analyzed.inquiry.products.slice(0, 2).map(item => ({ product_id: item.product_id, selected: true, quantity: 60, unit_price: 125 }));
  const selectionResponse = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${created.inquiry.id}/products`, {
    method: 'PUT', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ products: selected })
  });
  assert.equal(selectionResponse.status, 200);
  const quoteResponse = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${created.inquiry.id}/quote`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ trade_term: 'DDP', destination: 'Malaysia' })
  });
  const quote = await quoteResponse.json();
  assert.equal(quoteResponse.status, 201);
  assert.match(quote.quote.quote_number, /^PI-/);
  assert.ok(quote.quote.total > 0);

  const orderResponse = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${created.inquiry.id}/convert-order`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: '{}'
  });
  const order = await orderResponse.json();
  assert.equal(orderResponse.status, 201);
  assert.match(order.order.order_number, /^SO-/);
  const finalDetail = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${created.inquiry.id}`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  assert.ok(finalDetail.inquiry.timeline.some(event => event.event_type === 'AI Analysis'));
  assert.ok(finalDetail.inquiry.timeline.some(event => event.event_type === 'Quote Generated'));
  assert.ok(finalDetail.inquiry.timeline.some(event => event.event_type === 'Order Created'));

  const finalWorkspace = await fetch(`http://127.0.0.1:${port}/api/sales-workspace`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  assert.ok(finalWorkspace.quotes.some(item => item.id === quote.quote.id));
  assert.ok(finalWorkspace.orders.some(item => item.id === order.order.id));
  assert.ok(finalWorkspace.tasks.some(item => item.inquiry_id === created.inquiry.id));
});

test('Module 07 Part 2 builds, versions, previews, exports, and converts a complete PI', async () => {
  const sales = await login('sales@rspro.ai');
  const workspace = await fetch(`http://127.0.0.1:${port}/api/sales-workspace`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  const quote = workspace.quotes[0];
  const detailResponse = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}`, { headers: { Cookie: sales.cookie } });
  const detail = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.ok(detail.quote.items.every(item => item.product_id && item.name && item.sku && item.category));
  assert.equal(detail.quote.summary.total_cbm, null);
  assert.equal(detail.quote.versions.length, 1);

  const customResponse = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}/items/custom`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_name: 'Custom Channel-Back Booth', category: 'Custom Booth Seating', specification: 'Wall-to-wall project-specific design', material: 'Plywood / high-density foam / vinyl', color_finish: 'Customer-selected olive green', size_dimensions: '4200 × 650 × 1100 mm', quantity: 1, unit_price: 4800, cbm: '', gross_weight_kg: '', net_weight_kg: '', remark: 'Final dimensions subject to site measurement.' })
  });
  const withCustom = await customResponse.json();
  assert.equal(customResponse.status, 201);
  assert.equal(withCustom.quote.custom_items[0].product_id, undefined);
  assert.equal(withCustom.quote.custom_items[0].item_name, 'Custom Channel-Back Booth');
  assert.equal(withCustom.quote.custom_items[0].cbm, null);

  const protectedProduct = await fetch(`http://127.0.0.1:${port}/api/products/${detail.quote.items[0].product_id}`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  const items = detail.quote.items.map((item, index) => ({ id: item.id, quantity: 20 + index, unit_price: 150 + index * 25, discount_percent: 5, remark: 'Approved commercial specification.', confirmed_material: index===0?'Customer selected PU leather':'', confirmed_finish: index===0?'Matte commercial finish':'', confirmed_color_name: index===0?'Mocha Brown':'', customer_remark: index===0?'Customer approved finish.':'', swatch_image_url: index===0?'https://example.com/mocha-swatch.jpg':'' }));
  const updateResponse = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}`, {
    method: 'PUT', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, custom_items: withCustom.quote.custom_items, currency: 'USD', valid_until: '2026-08-01', deposit_percent: 50, balance_percent: 70,
      payment_method: 'TT Bank Transfer', payment_note: '50% deposit before production. 50% balance before shipment.', trade_term: 'DDP',
      shipping_method: 'Sea', destination: 'Malaysia', origin_port: 'Shenzhen', destination_port: 'Port Klang', destination_address: 'Kuala Lumpur',
      freight_cost: 1250, transit_time: '28-35 days', production_time: '35-45 days', freight_remark: 'Subject to final packing list.', other_charges: 100,
      contact_person: 'Jamie Tan', buyer_phone: '+60 12 345 6789', buyer_email: 'jamie@example.com', billing_address: 'Kuala Lumpur, Malaysia',
      buyer_reference_no: 'BUYER-001', project_name: 'California Coffee Lab LLC', total_packages: 66, total_cbm_override: 18.5, total_gross_weight_override: 2250, total_net_weight_override: 1980,
      other_remark: 'Final color approval required.', special_terms: 'Approved drawings govern final dimensions.' })
  });
  const updated = await updateResponse.json();
  assert.equal(updateResponse.status, 200);
  assert.equal(updated.quote.current_version, 3);
  assert.equal(updated.quote.all_items.length, updated.quote.items.length + 1);
  assert.equal(updated.quote.summary.freight_cost, 1250);
  assert.equal(updated.quote.deposit_percent, 50);
  assert.equal(updated.quote.balance_percent, 50);
  assert.equal(updated.quote.project_name, 'California Coffee Lab LLC');
  assert.equal(updated.quote.total_packages, 66);
  assert.equal(updated.quote.summary.total_cbm, 18.5);
  assert.equal(updated.quote.items[0].confirmed_color_name, 'Mocha Brown');
  const protectedProductAfter = await fetch(`http://127.0.0.1:${port}/api/products/${detail.quote.items[0].product_id}`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  assert.equal(protectedProductAfter.product.materials, protectedProduct.product.materials);
  assert.equal(protectedProductAfter.product.color, protectedProduct.product.color);
  assert.equal(updated.quote.company_settings.company_name, 'Restaurant Setup Pro');
  assert.equal(updated.quote.selected_bank_account, null);
  assert.ok(updated.quote.summary.grand_total > updated.quote.summary.product_total);
  assert.equal(Math.round(updated.quote.summary.deposit_amount + updated.quote.summary.balance_amount), Math.round(updated.quote.summary.grand_total));

  const version = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}/versions/1`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  assert.equal(version.version.version_number, 1);
  const whatsapp = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}/whatsapp`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  assert.match(whatsapp.message, /Proforma Invoice .* is ready/i);
  assert.match(whatsapp.message, /Grand Total: USD/);
  assert.match(whatsapp.message, /Custom Channel-Back Booth/);
  const email = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}/email`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  assert.match(email.subject, /Proforma Invoice/);
  const pdf = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}/export/pdf`, { headers: { Cookie: sales.cookie } });
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF');
  assert.match(pdfBytes.toString(), /Custom Channel-Back Booth/);
  assert.match(pdfBytes.toString(), /SKU \/ Model/);
  assert.match(pdfBytes.toString(), /Variant Size/);
  assert.match(pdfBytes.toString(), /VARIANT BREAKDOWN/);
  assert.match(pdfBytes.toString(), /FINISH \/ COLOR SECTION/);
  assert.match(pdfBytes.toString(), /TERMS & CONDITIONS/);
  assert.match(pdfBytes.toString(), /Bank information to be provided separately/);
  const excel = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}/export/excel`, { headers: { Cookie: sales.cookie } });
  assert.match(excel.headers.get('content-type'), /excel/);
  const excelBody = await excel.text();
  assert.match(excelBody, /Workbook/);
  assert.match(excelBody, /Custom Channel-Back Booth/);
  assert.match(excelBody, /SKU \/ Model/);
  assert.match(excelBody, /Variant Size/);
  assert.match(excelBody, /VARIANT BREAKDOWN/);
  assert.match(excelBody, /FINISH \/ COLOR SECTION/);
  assert.match(excelBody, /PACKING SUMMARY/);
  assert.match(excelBody, /USD 7,?\d{3}\.\d{2}|USD [\d,]+\.\d{2}/);
  assert.match(excelBody, /Mocha Brown/);
  assert.doesNotMatch(excelBody, /Lead Time/);
  assert.match(excelBody, /California Coffee Lab LLC/);

  const duplicateLibrary = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}/items/duplicate`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ item_type: 'library', item_id: updated.quote.items[0].id })
  }).then(r => r.json());
  assert.equal(duplicateLibrary.quote.items.length, updated.quote.items.length + 1);
  assert.equal(duplicateLibrary.quote.items.at(-1).quantity, updated.quote.items[0].quantity);
  const duplicateCustom = await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quote.id}/items/duplicate`, {
    method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ item_type: 'custom', item_id: updated.quote.custom_items[0].id })
  }).then(r => r.json());
  assert.equal(duplicateCustom.quote.custom_items.length, updated.quote.custom_items.length + 1);
  assert.equal(duplicateCustom.quote.custom_items.at(-1).size_dimensions, updated.quote.custom_items[0].size_dimensions);

  const convert = await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${quote.inquiry_id}/convert-order`, { method: 'POST', headers: { Cookie: sales.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  const order = await convert.json();
  assert.equal(convert.status, 201);
  const snapshot = typeof order.order.order_snapshot === 'string' ? JSON.parse(order.order.order_snapshot) : order.order.order_snapshot;
  assert.equal(snapshot.payment_method, 'TT Bank Transfer');
  assert.equal(snapshot.trade_term, 'DDP');
  assert.ok(snapshot.items.length > 0);
  assert.equal(snapshot.custom_items[0].item_name, 'Custom Channel-Back Booth');
});

test('Module 08A builds variants, configurable attributes, product relationships, and protected quote snapshots', async () => {
  const admin = await login('admin@rspro.ai');
  const sales = await login('sales@rspro.ai');
  const categoriesResponse = await fetch(`http://127.0.0.1:${port}/api/product-categories`, { headers: { Cookie: admin.cookie } });
  const categories = (await categoriesResponse.json()).categories;
  for (const name of ['Dining Chair','Bar Stool','Table Top','Table Base','Booth Seating','Sofa','Outdoor Furniture','Cabinet','Divider','Lighting','Decor','Custom Furniture','Others']) assert.ok(categories.some(category => category.name === name));

  const temporary = await fetch(`http://127.0.0.1:${port}/api/product-categories`, { method:'POST', headers:{ Cookie:admin.cookie,'Content-Type':'application/json' }, body:JSON.stringify({ name:'Temporary Foundation Category', slug:'temporary-foundation-category' }) }).then(r=>r.json());
  const renamed = await fetch(`http://127.0.0.1:${port}/api/product-categories/${temporary.category.id}`, { method:'PUT', headers:{ Cookie:admin.cookie,'Content-Type':'application/json' }, body:JSON.stringify({ name:'Temporary Category Updated', slug:'temporary-category-updated' }) }).then(r=>r.json());
  assert.equal(renamed.category.name,'Temporary Category Updated');
  const removedCategory = await fetch(`http://127.0.0.1:${port}/api/product-categories/${temporary.category.id}`, { method:'DELETE', headers:{ Cookie:admin.cookie } });
  assert.equal(removedCategory.status,200);

  const tableTopCategory=categories.find(category=>category.name==='Table Top');
  const tableBaseCategory=categories.find(category=>category.name==='Table Base');
  const boothCategory=categories.find(category=>category.name==='Booth Seating');
  const chairCategory=categories.find(category=>category.name==='Dining Chair');
  const createProduct=async body=>{const response=await fetch(`http://127.0.0.1:${port}/api/products`,{method:'POST',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,201);return (await response.json()).product};
  const harbor=await createProduct({category_id:chairCategory.id,sku:'M08-HARBOR-CHAIR',name:'Harbor Ash Chair',materials:'Ash Wood',library_status:'Active',visibility:'Website + Quote',quote_description:'Harbor Ash Chair'});
  const atlas=await createProduct({category_id:tableTopCategory.id,sku:'M08-ATLAS-TOP',name:'Atlas Stone Top',materials:'Sintered Stone',library_status:'Best Seller',visibility:'Website + Quote',website_price_display:'Starting From'});
  const spider=await createProduct({category_id:tableBaseCategory.id,sku:'M08-SPIDER-BASE',name:'Spider Base',materials:'Powder-coated steel',library_status:'Active',visibility:'Quote Only'});
  const straight=await createProduct({category_id:boothCategory.id,sku:'M08-STRAIGHT-BOOTH',name:'Straight Booth',materials:'Plywood and foam',library_status:'New',visibility:'Website + Quote'});

  const addVariant=async(product,body)=>{const response=await fetch(`http://127.0.0.1:${port}/api/products/${product.id}/variants`,{method:'POST',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,201);return (await response.json()).variant};
  const atlas700=await addVariant(atlas,{variant_name:'700Ø',variant_sku:'M08-ATLAS-700',dimensions:'700Ø x 20 mm',reference_price:180,cost_price:90,status:'Active'});
  await addVariant(atlas,{variant_name:'1200×700',variant_sku:'M08-ATLAS-1200',dimensions:'1200 x 700 x 20 mm',reference_price:260,status:'Active'});
  await addVariant(harbor,{variant_name:'Standard',variant_sku:'M08-HARBOR-STD',dimensions:'520 x 560 x 820 mm',reference_price:95,status:'Active'});

  const thickness=await fetch(`http://127.0.0.1:${port}/api/product-attributes`,{method:'POST',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({category_id:tableTopCategory.id,name:'Thickness',code:'m08-thickness',data_type:'Number',unit:'mm'})}).then(r=>r.json());
  const foundationResponse=await fetch(`http://127.0.0.1:${port}/api/products/${atlas.id}/foundation`,{method:'PUT',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({attribute_values:[{attribute_id:thickness.attribute.id,value:'20'}],related_product_ids:[spider.id],frequently_bought_together_ids:[harbor.id,straight.id]})});
  assert.equal(foundationResponse.status,200);
  const atlasDetail=await fetch(`http://127.0.0.1:${port}/api/products/${atlas.id}`,{headers:{Cookie:admin.cookie}}).then(r=>r.json());
  assert.equal(atlasDetail.foundation.variants.length,2);
  assert.equal(atlasDetail.foundation.attributeValues[0].value,'20');
  assert.deepEqual(atlasDetail.foundation.relatedProducts.map(product=>product.id),[spider.id]);
  assert.deepEqual(atlasDetail.foundation.frequentlyBoughtTogether.map(product=>product.id),[harbor.id,straight.id]);

  const drawing=await fetch(`http://127.0.0.1:${port}/api/products/${atlas.id}/images`,{method:'POST',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({file_name:'Atlas 700 dimension drawing',file_url:'https://example.com/atlas-700-drawing.pdf',image_type:'Dimension Drawing',image_status:'Approved'})});
  assert.equal(drawing.status,201);

  const workspace=await fetch(`http://127.0.0.1:${port}/api/sales-workspace`,{headers:{Cookie:sales.cookie}}).then(r=>r.json());
  const quoteId=workspace.quotes[0].id;
  const quoteAdd=await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quoteId}/items/library`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:JSON.stringify({product_id:atlas.id,variant_id:atlas700.id})}).then(r=>r.json());
  const added=quoteAdd.quote.items.find(item=>item.product_id===atlas.id&&item.variant_id===atlas700.id);
  assert.equal(added.unit_price,180);
  assert.equal(added.variant_snapshot.name,'700Ø');
  const originalProduct=atlasDetail.product;
  await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quoteId}`,{method:'PUT',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:JSON.stringify({items:quoteAdd.quote.items.map(item=>({id:item.id,quantity:item.id===added.id?12:item.quantity,unit_price:item.id===added.id?199:item.unit_price,discount_percent:item.discount_percent,remark:item.remark,confirmed_material:item.confirmed_material,confirmed_finish:item.confirmed_finish,confirmed_color_name:item.confirmed_color_name,customer_remark:item.customer_remark,swatch_image_url:item.swatch_image_url})),custom_items:quoteAdd.quote.custom_items,currency:'USD',deposit_percent:30})});
  const protectedProduct=await fetch(`http://127.0.0.1:${port}/api/products/${atlas.id}`,{headers:{Cookie:admin.cookie}}).then(r=>r.json());
  assert.equal(protectedProduct.product.materials,originalProduct.materials);
  assert.equal(protectedProduct.foundation.variants.find(variant=>variant.id===atlas700.id).reference_price,180);
  const disposable=await createProduct({category_id:chairCategory.id,sku:'M08-DISPOSABLE',name:'Disposable Alpha Product',library_status:'Active',visibility:'Internal Only'});
  const deleted=await fetch(`http://127.0.0.1:${port}/api/products/${disposable.id}`,{method:'DELETE',headers:{Cookie:admin.cookie}});
  assert.equal(deleted.status,200);
  const tagCreated=await fetch(`http://127.0.0.1:${port}/api/product-tags`,{method:'POST',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({tag_name:'Alpha Test Venue',code:'ALPHA-TEST-VENUE',tag_type:'Store Type Tags',sort_order:9})}).then(response=>response.json());
  assert.equal(tagCreated.tag.tag_type,'Store Type Tags');
  const tagUpdated=await fetch(`http://127.0.0.1:${port}/api/product-tags/${tagCreated.tag.id}`,{method:'PUT',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({active:false,sort_order:20})}).then(response=>response.json());
  assert.equal(Number(tagUpdated.tag.active),0);
  const tableBaseAttribute=await fetch(`http://127.0.0.1:${port}/api/product-attributes`,{method:'POST',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Base Finish',code:'m08-base-finish',data_type:'Select',category_ids:[tableBaseCategory.id],options:['Brushed Stainless','Black Powder Coat'],show_in_library:true,show_in_quote:true,show_in_pi:true})}).then(response=>response.json());
  assert.deepEqual(tableBaseAttribute.attribute.category_ids,[tableBaseCategory.id]);
  assert.deepEqual(tableBaseAttribute.attribute.options.map(option=>option.option_value),['Brushed Stainless','Black Powder Coat']);
  const stainlessBase=await createProduct({category_id:tableBaseCategory.id,sku:'M08-STAINLESS-BASE',name:'Stainless Steel Table Base',library_status:'Active',visibility:'Website + Quote'});
  const stainlessVariant=await addVariant(stainlessBase,{variant_name:'600 mm Base',variant_sku:'M08-STAINLESS-600',dimensions:'600 x 720 mm',reference_price:85,status:'Active'});
  await fetch(`http://127.0.0.1:${port}/api/products/${stainlessBase.id}/foundation`,{method:'PUT',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({attribute_values:[{attribute_id:tableBaseAttribute.attribute.id,value:'Brushed Stainless'},{attribute_id:tableBaseAttribute.attribute.id,variant_id:stainlessVariant.id,value:'Black Powder Coat'}]})});
  const stainlessDetail=await fetch(`http://127.0.0.1:${port}/api/products/${stainlessBase.id}`,{headers:{Cookie:admin.cookie}}).then(response=>response.json());
  assert.ok(stainlessDetail.foundation.attributeDefinitions.some(attribute=>attribute.code==='m08-base-finish'));
  assert.ok(!stainlessDetail.foundation.attributeDefinitions.some(attribute=>attribute.code==='m08-thickness'));
  assert.equal(stainlessDetail.foundation.attributeValues.find(value=>value.variant_id===stainlessVariant.id).value,'Black Powder Coat');
  for(const [categoryName,expectedCode] of [['Dining Chair','PIM-DINING-CHAIR-FRAME-MATERIAL'],['Table Top','PIM-TABLE-TOP-SHAPE'],['Table Base','PIM-TABLE-BASE-BASE-TYPE'],['Kitchen Equipment','PIM-KITCHEN-EQUIPMENT-VOLTAGE'],['Tableware','PIM-TABLEWARE-DIAMETER'],['Lighting','PIM-LIGHTING-WATTAGE']]){
    const category=categories.find(item=>item.name===categoryName);assert.ok(category,`${categoryName} category should exist`);
    const probe=await createProduct({category_id:category.id,sku:`PIM-${category.id}-${Date.now()}`,name:`PIM ${categoryName} Acceptance`,library_status:'Active',visibility:'Quote Only'});
    const detail=await fetch(`http://127.0.0.1:${port}/api/products/${probe.id}`,{headers:{Cookie:admin.cookie}}).then(response=>response.json());
    assert.ok(detail.foundation.attributeDefinitions.some(attribute=>attribute.code===expectedCode));
  }
  const kitchenCategory=categories.find(item=>item.name==='Kitchen Equipment');
  const dishwasher=await createProduct({category_id:kitchenCategory.id,sku:'PIM-COMMERCIAL-DISHWASHER',name:'Commercial Dishwasher',library_status:'Active',visibility:'Website + Quote',default_supplier:'Future Supplier',supplier_sku:'SUP-DW-001',supplier_cost:1200,supplier_lead_time_days:30,supplier_moq:1,supplier_notes:'Reserved only'});
  const dishwasherVariant=await addVariant(dishwasher,{variant_name:'220V 60Hz',variant_sku:'PIM-DW-220V',dimensions:'600 x 650 x 820 mm',material:'Stainless Steel',finish:'Brushed',color:'Silver',reference_price:2200,cost_price:1200,moq:1,lead_time_days:30,cbm:.45,gross_weight_kg:85,net_weight_kg:72,packing_info:'Export carton',default_supplier:'Future Supplier',supplier_sku:'SUP-DW-220V',supplier_cost:1200,supplier_lead_time_days:30,supplier_moq:1,status:'Active'});
  assert.equal(dishwasherVariant.cbm,.45);assert.equal(dishwasherVariant.supplier_sku,'SUP-DW-220V');
  const frozenQuote=await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quoteId}/items/library`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:JSON.stringify({product_id:dishwasher.id,variant_id:dishwasherVariant.id})}).then(response=>response.json());
  const frozenItem=frozenQuote.quote.items.find(item=>item.product_id===dishwasher.id);assert.equal(frozenItem.product_snapshot.name,'Commercial Dishwasher');assert.equal('supplier' in frozenItem.product_snapshot,false);
  await fetch(`http://127.0.0.1:${port}/api/products/${dishwasher.id}`,{method:'PUT',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({...dishwasher,name:'Commercial Dishwasher Updated',category_id:kitchenCategory.id,tag_ids:[]})});
  const quoteAfterMasterChange=await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quoteId}`,{headers:{Cookie:sales.cookie}}).then(response=>response.json());
  assert.equal(quoteAfterMasterChange.quote.items.find(item=>item.product_id===dishwasher.id).name,'Commercial Dishwasher');
  const uiSource=await fetch(`http://127.0.0.1:${port}/app.js`).then(response=>response.text());
  for(const contract of ['product-library-products','product-library-categories','product-library-tags','product-library-attributes','product-library-variants','Frequently Bought Together','Upload Image','delete-library-product','Category Attributes'])assert.match(uiSource,new RegExp(contract));
  for(const contract of ['data-submit-intent="draft"','data-submit-intent="create"','Save Draft','Create Product','Product created successfully.','Please complete the highlighted required fields'])assert.match(uiSource,new RegExp(contract));
  const styles=await fetch(`http://127.0.0.1:${port}/styles.css`).then(response=>response.text());
  assert.match(styles,/\.product-modal-actions\{position:sticky/);
});

test('Module 08B Part 1 analyzes bilingual spreadsheets into reviewable drafts and imports approved products',async()=>{
  const admin=await login('admin@rspro.ai'),va=await login('va@rspro.ai');
  const categories=(await fetch(`http://127.0.0.1:${port}/api/product-categories`,{headers:{Cookie:admin.cookie}}).then(response=>response.json())).categories;
  const tableBase=categories.find(category=>category.name==='Table Base');
  const tableCsv=['型号,产品名称,尺寸,材质,表面处理,总高度,人民币,美元,包装,起订量,交期','UP-A002,UP-A002 Table Base,380×380,Steel,Black Powder Coat,720,280,42,1 carton,10,25','UP-A002,UP-A002 Table Base,400×400,Steel,Black Powder Coat,720,300,45,1 carton,10,25','UP-A002,UP-A002 Table Base,450×450,Steel,Black Powder Coat,720,330,49,1 carton,10,25','UP-A002,UP-A002 Table Base,500×500,Steel,Black Powder Coat,720,360,53,1 carton,10,25','UP-A002,UP-A002 Table Base,550×550,Steel,Black Powder Coat,720,390,58,1 carton,10,25'].join('\n');
  const analyze=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:va.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'table-base-mixed.csv',file_base64:Buffer.from(tableCsv).toString('base64'),import_mode:'Smart Import',supplier_name:'Alpha Base Factory',supplier_currency:'USD',exchange_rate:7.2,default_category_id:tableBase.id})});
  const analyzed=await analyze.json();assert.equal(analyze.status,201);assert.equal(analyzed.batch.drafts.length,1);assert.equal(analyzed.batch.drafts[0].suggested_variants.length,5);assert.equal(analyzed.batch.drafts[0].mapped_product.material,'Steel');assert.equal(analyzed.batch.drafts[0].mapped_product.reference_price,42);assert.ok(analyzed.batch.detected_columns.includes('型号'));
  const vaApprove=await fetch(`http://127.0.0.1:${port}/api/imports/drafts/${analyzed.batch.drafts[0].id}/approve`,{method:'POST',headers:{Cookie:va.cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(vaApprove.status,403);
  const approve=await fetch(`http://127.0.0.1:${port}/api/imports/drafts/${analyzed.batch.drafts[0].id}/approve`,{method:'POST',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({resolution_action:'create_new'})});const approved=await approve.json();assert.equal(approve.status,200,approved.error);assert.ok(approved.result.productId);assert.equal(approved.result.createdVariants,5);
  const product=await fetch(`http://127.0.0.1:${port}/api/products/${approved.result.productId}`,{headers:{Cookie:admin.cookie}}).then(response=>response.json());assert.equal(product.product.default_supplier,'Alpha Base Factory');assert.equal(product.product.source_row,2);assert.equal(product.foundation.variants.length,5);assert.equal(product.foundation.variants[0].source_row,2);assert.ok(product.foundation.attributeValues.some(value=>value.name==='Material'&&value.value==='Steel'));assert.ok(product.foundation.attributeValues.some(value=>value.variant_id&&value.name==='Material'&&value.value==='Steel'));
  const chairCsv=['Model,Product Name,Material,Package Size,USD','A2501,A2501 Dining Chair,Ash Wood,600x500x900,95','A2502,A2502 Dining Chair,Metal,620x520x910,88','A2503,A2503 Dining Chair,Oak,610x510x890,105','A2505,A2505 Dining Chair,Ash Wood,600x500x900,99','A2506,A2506 Dining Chair,Metal,620x520x910,92'].join('\n');
  const chairAnalyze=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:admin.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'chair-list.csv',file_base64:Buffer.from(chairCsv).toString('base64'),import_mode:'Standard Template Import',supplier_currency:'USD',default_category_id:categories.find(category=>category.name==='Dining Chair').id})}).then(response=>response.json());assert.equal(chairAnalyze.batch.drafts.length,5);assert.ok(chairAnalyze.batch.drafts.every(draft=>draft.suggested_variants.length===0));assert.ok(chairAnalyze.batch.drafts.every(draft=>draft.missing_fields.includes('Image Assets Needed')));
  const ui=await fetch(`http://127.0.0.1:${port}/app.js`).then(response=>response.text());for(const contract of ['AI Product Import Center','Smart Analysis Result','Draft Review','Approve Selected','Image Assets Needed'])assert.match(ui,new RegExp(contract));
});

test('Module 08C protects purchasing data and makes imports business-ready',async()=>{
  const owner=await login('owner@rspro.ai'),sales=await login('sales@rspro.ai'),va=await login('va@rspro.ai');
  const ownerLibrary=await fetch(`http://127.0.0.1:${port}/api/products`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());
  const category=ownerLibrary.categories.find(row=>row.name==='Dining Chair');
  const csv=['SKU,Product Name,Material,Dimensions,Supplier SKU,Cost Price,USD','BETA-CHAIR-01,Beta Dining Chair,Ash Wood,520x560x820,SUP-BETA-01,38,88'].join('\n');
  const analyzedResponse=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'Dining Chair.xlsx.csv',file_base64:Buffer.from(csv).toString('base64'),supplier_name:'Beta Seating Factory',supplier_code:'SUP-BETA',supplier_currency:'USD',exchange_rate:1,import_remark:'Business Beta',default_category_id:category.id})});
  const analyzed=await analyzedResponse.json();assert.equal(analyzedResponse.status,201,analyzed.error);assert.equal(analyzed.batch.supplier_code,'SUP-BETA');assert.equal(analyzed.batch.statistics.images_missing,1);assert.equal(analyzed.batch.statistics.products_created,0);
  const draft=analyzed.batch.drafts[0];const approvedResponse=await fetch(`http://127.0.0.1:${port}/api/imports/drafts/${draft.id}/approve`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({resolution_action:'create_new'})});const approved=await approvedResponse.json();assert.equal(approvedResponse.status,200,approved.error);
  const ownerProduct=await fetch(`http://127.0.0.1:${port}/api/products/${approved.result.productId}`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());assert.equal(ownerProduct.product.library_status,'Approved');assert.equal(ownerProduct.product.source_supplier,'Beta Seating Factory');assert.equal(ownerProduct.product.source_file,'Dining Chair.xlsx.csv');assert.equal(ownerProduct.product.import_batch_id,analyzed.batch.id);assert.ok(ownerProduct.product.imported_at);assert.ok(ownerProduct.product.imported_by_name);
  const salesProduct=await fetch(`http://127.0.0.1:${port}/api/products/${approved.result.productId}`,{headers:{Cookie:sales.cookie}}).then(r=>r.json());const salesJson=JSON.stringify(salesProduct);for(const secret of ['default_supplier','supplier_sku','supplier_cost','supplier_notes','source_supplier','cost_price'])assert.equal(salesJson.includes(`"${secret}"`),false,`Sales response leaked ${secret}`);
  const vaImport=await fetch(`http://127.0.0.1:${port}/api/imports?batch_id=${analyzed.batch.id}`,{headers:{Cookie:va.cookie}}).then(r=>r.json());assert.equal(vaImport.batch.supplier_name,undefined);assert.equal(vaImport.batch.supplier_code,undefined);assert.equal(vaImport.batch.drafts[0].original_values&&Object.keys(vaImport.batch.drafts[0].original_values).length,0);
  const duplicate=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'duplicate.csv',file_base64:Buffer.from(csv).toString('base64'),supplier_name:'Beta Seating Factory',supplier_code:'SUP-BETA',default_category_id:category.id})}).then(r=>r.json());assert.equal(duplicate.batch.statistics.duplicate_matches,1);assert.ok(duplicate.batch.drafts[0].possible_match_product_id);assert.equal(duplicate.batch.drafts[0].mapped_product.duplicate_match.suggested_action,'Update Existing');
  const errorReport=await fetch(`http://127.0.0.1:${port}/api/imports/${duplicate.batch.id}/errors.xlsx`,{headers:{Cookie:owner.cookie}});assert.equal(errorReport.status,200);assert.match(errorReport.headers.get('content-type'),/excel/);
  const draftCreate=await fetch(`http://127.0.0.1:${port}/api/products`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({category_id:category.id,sku:'BETA-DRAFT-ONLY',name:'Draft Only Chair',library_status:'Draft',visibility:'Website + Quote'})}).then(r=>r.json());
  const workspace=await fetch(`http://127.0.0.1:${port}/api/sales-workspace`,{headers:{Cookie:sales.cookie}}).then(r=>r.json());
  let quoteId=workspace.quotes[0]?.id;
  if(!quoteId){
    const inquiryResponse=await fetch(`http://127.0.0.1:${port}/api/sales-inquiries`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:JSON.stringify({customer_id:workspace.customers[0].id,inquiry_type:'Product Inquiry',source:'Manual',customer_message:'Need dining chairs for a restaurant.'})});const inquiry=await inquiryResponse.json();assert.equal(inquiryResponse.status,201,inquiry.error);
    const analysisResponse=await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${inquiry.inquiry.id}/analyze`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(analysisResponse.status,200);
    const quoteResponse=await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${inquiry.inquiry.id}/quote`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:'{}'});const generated=await quoteResponse.json();assert.equal(quoteResponse.status,201,generated.error);quoteId=generated.quote.id;
  }
  const quote=await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quoteId}`,{headers:{Cookie:sales.cookie}}).then(r=>r.json());assert.equal(quote.quote.library_options.some(row=>row.id===draftCreate.product.id),false);assert.equal(quote.quote.library_options.some(row=>row.id===approved.result.productId),true);
  const categoriesBefore=ownerLibrary.categories.length;const clearResponse=await fetch(`http://127.0.0.1:${port}/api/products/clear-demo-data`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({confirm:'CLEAR DEMO DATA'})});const clear=await clearResponse.json();assert.equal(clearResponse.status,200,clear.error);assert.equal(clear.cleared,true);const categoriesAfter=(await fetch(`http://127.0.0.1:${port}/api/product-categories`,{headers:{Cookie:owner.cookie}}).then(r=>r.json())).categories.length;assert.equal(categoriesAfter,categoriesBefore);
});

test('Module 08D calculates reference prices, preserves overrides, and protects cost snapshots',async()=>{
  const owner=await login('owner@rspro.ai'),sales=await login('sales@rspro.ai');
  const library=await fetch(`http://127.0.0.1:${port}/api/products`,{headers:{Cookie:owner.cookie}}).then(r=>r.json()),tableBase=library.categories.find(c=>c.name==='Table Base'),chair=library.categories.find(c=>c.name==='Dining Chair');
  const createRule=body=>fetch(`http://127.0.0.1:${port}/api/price-rules`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const ruleAResponse=await createRule({rule_name:'UP Table Base USD',supplier_name:'UP Furniture',category_id:tableBase.id,multiplier:2,fixed_addon:0,rounding_rule:'Round to nearest 1',currency:'USD',active:true,effective_date:'2026-01-01'});const ruleA=await ruleAResponse.json();assert.equal(ruleAResponse.status,201,ruleA.error);
  const ruleBResponse=await createRule({rule_name:'Chair Factory USD',supplier_name:'Chair Factory',category_id:chair.id,multiplier:2.2,rounding_rule:'Round to nearest 1',currency:'USD',active:true,effective_date:'2026-01-01'});assert.equal(ruleBResponse.status,201);
  const tableCsv=['SKU,Product Name,Dimensions,Material,RMB','UP-PRICE-01,UP Table Base,380x380,Steel,156','UP-PRICE-01,UP Table Base,450x450,Steel,156'].join('\n');
  const importResponse=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'Table Base Price.xlsx.csv',file_base64:Buffer.from(tableCsv).toString('base64'),supplier_name:'UP Furniture',supplier_currency:'CNY',exchange_rate:7.2,default_category_id:tableBase.id})});const imported=await importResponse.json();assert.equal(importResponse.status,201,imported.error);const draft=imported.batch.drafts[0];assert.equal(draft.mapped_product.converted_cost,21.67);assert.equal(draft.mapped_product.reference_price,43);assert.equal(draft.mapped_product.pricing_rule_applied,'UP Table Base USD');assert.equal(draft.mapped_product.pricing_confidence,100);
  const approveResponse=await fetch(`http://127.0.0.1:${port}/api/imports/drafts/${draft.id}/approve`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({resolution_action:'create_new'})});const approved=await approveResponse.json();assert.equal(approveResponse.status,200,approved.error);const detail=await fetch(`http://127.0.0.1:${port}/api/products/${approved.result.productId}`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());assert.equal(detail.foundation.variants.length,2);assert.equal(detail.foundation.variants[0].reference_price,43);assert.equal(detail.foundation.variants[0].supplier_cost,156);assert.equal(detail.foundation.variants[0].supplier_currency,'CNY');assert.equal(detail.foundation.variants[0].converted_cost,21.67);assert.equal(detail.foundation.variants[0].pricing_rule_id,ruleA.rule.id);
  const ownerPricingDetail=await fetch(`http://127.0.0.1:${port}/api/product-intelligence/products/${approved.result.productId}`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());const ownerVariantPricing=ownerPricingDetail.product.pricing_summary.variants[0];assert.equal(ownerVariantPricing.supplier_cost,156);assert.equal(ownerVariantPricing.supplier_currency,'CNY');assert.equal(ownerVariantPricing.converted_cost,21.67);assert.equal(ownerVariantPricing.converted_cost_currency,'USD');assert.equal(ownerVariantPricing.recommended_selling_price,43);assert.equal(ownerVariantPricing.selling_currency,'USD');
  const chairCsv=['SKU,Product Name,Material,RMB','CHAIR-PRICE-01,Chair Factory Dining Chair,Ash Wood,153'].join('\n');const chairImport=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'Chair Price.csv',file_base64:Buffer.from(chairCsv).toString('base64'),supplier_name:'Chair Factory',supplier_currency:'CNY',exchange_rate:7.2,default_category_id:chair.id})}).then(r=>r.json());assert.equal(chairImport.batch.drafts[0].mapped_product.reference_price,47);
  const salesDetail=await fetch(`http://127.0.0.1:${port}/api/products/${approved.result.productId}`,{headers:{Cookie:sales.cookie}}).then(r=>r.json()),salesText=JSON.stringify(salesDetail);for(const key of ['supplier_cost','supplier_currency','converted_cost','converted_cost_currency','pricing_rule_id','multiplier','minimum_margin'])assert.equal(salesText.includes(`"${key}"`),false);
  const salesPricingDetail=await fetch(`http://127.0.0.1:${port}/api/product-intelligence/products/${approved.result.productId}`,{headers:{Cookie:sales.cookie}}).then(r=>r.json()),salesPricingText=JSON.stringify(salesPricingDetail);for(const key of ['supplier_cost','supplier_currency','converted_cost','converted_cost_currency','pricing_rule_id'])assert.equal(salesPricingText.includes(`"${key}"`),false);assert.equal(salesPricingDetail.product.pricing_summary.variants[0].recommended_selling_price,43);assert.equal(salesPricingDetail.product.pricing_summary.variants[0].selling_currency,'USD');
  const salesRuleAccess=await fetch(`http://127.0.0.1:${port}/api/price-rules`,{headers:{Cookie:sales.cookie}});assert.equal(salesRuleAccess.status,403);
  const workspace=await fetch(`http://127.0.0.1:${port}/api/sales-workspace`,{headers:{Cookie:sales.cookie}}).then(r=>r.json());let quoteId=workspace.quotes[0]?.id;if(!quoteId){const inquiry=await fetch(`http://127.0.0.1:${port}/api/sales-inquiries`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:JSON.stringify({customer_id:workspace.customers[0].id,inquiry_type:'Product Inquiry',customer_message:'Need table bases.'})}).then(r=>r.json());await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${inquiry.inquiry.id}/analyze`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:'{}'});quoteId=(await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${inquiry.inquiry.id}/quote`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:'{}'}).then(r=>r.json())).quote.id}const variant=detail.foundation.variants[0];const quoteAddResponse=await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quoteId}/items/library`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:JSON.stringify({product_id:approved.result.productId,variant_id:variant.id})});const quoteAdd=await quoteAddResponse.json();assert.equal(quoteAddResponse.status,201,quoteAdd.error);const item=quoteAdd.quote.items.find(row=>row.product_id===approved.result.productId);assert.equal(item.unit_price,43);assert.equal(item.reference_price_snapshot,43);assert.equal(item.pricing_source,'Reference');assert.equal('cost_snapshot' in item,false);const piExport=await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quoteId}/export/excel`,{headers:{Cookie:sales.cookie}});assert.equal(piExport.status,200);const piText=await piExport.text();assert.equal(piText.includes('supplier_cost'),false);assert.equal(piText.includes('CNY'),false);assert.equal(piText.includes('156'),false);
  const overrideResponse=await fetch(`http://127.0.0.1:${port}/api/products/${approved.result.productId}/variants/${variant.id}/price-override`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({reference_price:50})});assert.equal(overrideResponse.status,200);const preview=await fetch(`http://127.0.0.1:${port}/api/pricing/recalculate/preview?product_ids=${approved.result.productId}`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());assert.equal(preview.preview[0].old_reference_price,50);assert.equal(preview.preview[0].new_reference_price,43);assert.equal(preview.preview[0].manual_override,true);await fetch(`http://127.0.0.1:${port}/api/pricing/recalculate/apply`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({confirm:true,variant_ids:[variant.id]})});const after=await fetch(`http://127.0.0.1:${port}/api/products/${approved.result.productId}`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());assert.equal(after.foundation.variants[0].reference_price,50);assert.equal(after.foundation.variants[0].pricing_status,'Manual Override');
});

test('V5.3 PIC-2C normalizes supplier imports and preserves Product Library to Quote to PI flow',async()=>{
  const owner=await login('owner@rspro.ai'),sales=await login('sales@rspro.ai');
  const categories=(await fetch(`http://127.0.0.1:${port}/api/product-categories`,{headers:{Cookie:owner.cookie}}).then(r=>r.json())).categories;
  const tableBase=categories.find(category=>category.name==='Table Base')||categories[0],chair=categories.find(category=>category.name==='Dining Chair')||categories[0];

  const chineseCsv=['型号,图片,材质,尺寸,单价,特殊说明','PIC2C-CN-01,,钢,1200*700*750,150,供应商备注需要人工确认'].join('\n');
  const chineseResponse=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'PIC2C Chinese Supplier.csv',file_base64:Buffer.from(chineseCsv).toString('base64'),import_mode:'Smart Import',supplier_name:'PIC2C Factory',supplier_currency:'CNY',exchange_rate:7.2,default_category_id:tableBase.id})});
  const chinese=await chineseResponse.json();assert.equal(chineseResponse.status,201,chinese.error);const chineseDraft=chinese.batch.drafts[0];assert.equal(chineseDraft.product_sku,'PIC2C-CN-01');assert.equal(chineseDraft.mapped_product.material,'钢');assert.equal(chineseDraft.mapped_product.normalization_summary.length_mm,1200);assert.equal(chineseDraft.mapped_product.normalization_summary.width_mm,700);assert.equal(chineseDraft.mapped_product.normalization_summary.height_mm,750);assert.ok(chineseDraft.missing_fields.some(field=>field.includes('Needs Human Review')));assert.equal(chineseDraft.status,'Needs Review');

  const englishCsv=['SKU,Product Name,Material,Price','PIC2C-EN-01,PIC2C Dining Chair,Ash Wood,95'].join('\n');
  const english=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'PIC2C English Supplier.csv',file_base64:Buffer.from(englishCsv).toString('base64'),import_mode:'Smart Import',supplier_currency:'USD',default_category_id:chair.id})}).then(r=>r.json());assert.equal(english.batch.drafts[0].product_sku,'PIC2C-EN-01');assert.equal(english.batch.drafts[0].mapped_product.material,'Ash Wood');

  const reorderedCsv=['Price,Material,Product Name,SKU','108,Metal,PIC2C Reordered Chair,PIC2C-ORDER-01'].join('\n');
  const reordered=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'PIC2C Reordered Supplier.csv',file_base64:Buffer.from(reorderedCsv).toString('base64'),import_mode:'Smart Import',supplier_currency:'USD',default_category_id:chair.id})}).then(r=>r.json());assert.equal(reordered.batch.drafts[0].product_name,'PIC2C Reordered Chair');assert.equal(reordered.batch.drafts[0].mapped_product.reference_price,108);

  const missingCsv=['SKU,Material,Price','PIC2C-MISSING-01,Steel,88'].join('\n');
  const missing=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'PIC2C Missing Fields.csv',file_base64:Buffer.from(missingCsv).toString('base64'),import_mode:'Smart Import',supplier_currency:'USD',default_category_id:tableBase.id})}).then(r=>r.json());assert.equal(missing.batch.drafts[0].status,'Needs Review');assert.ok(missing.batch.drafts[0].missing_fields.includes('Product Name'));

  const approveResponse=await fetch(`http://127.0.0.1:${port}/api/imports/drafts/${english.batch.drafts[0].id}/approve`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({resolution_action:'create_new'})});const approved=await approveResponse.json();assert.equal(approveResponse.status,200,approved.error);
  const product=await fetch(`http://127.0.0.1:${port}/api/products/${approved.result.productId}`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());assert.equal(product.product.sku,'PIC2C-EN-01');assert.equal(product.product.library_status,'Approved');
  const intelligence=await fetch(`http://127.0.0.1:${port}/api/product-intelligence/products/${approved.result.productId}`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());assert.equal(intelligence.product.basic_information.sku,'PIC2C-EN-01');
  const workspace=await fetch(`http://127.0.0.1:${port}/api/sales-workspace`,{headers:{Cookie:sales.cookie}}).then(r=>r.json());let quoteId=workspace.quotes[0]?.id;if(!quoteId){const inquiry=await fetch(`http://127.0.0.1:${port}/api/sales-inquiries`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:JSON.stringify({customer_id:workspace.customers[0].id,inquiry_type:'Product Inquiry',customer_message:'Need PIC2C chair.'})}).then(r=>r.json());quoteId=(await fetch(`http://127.0.0.1:${port}/api/sales-inquiries/${inquiry.inquiry.id}/quote`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:'{}'}).then(r=>r.json())).quote.id}
  const quoteAddResponse=await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quoteId}/items/library`,{method:'POST',headers:{Cookie:sales.cookie,'Content-Type':'application/json'},body:JSON.stringify({product_id:approved.result.productId})});const quoteAdd=await quoteAddResponse.json();assert.equal(quoteAddResponse.status,201,quoteAdd.error);const item=quoteAdd.quote.items.find(row=>row.product_id===approved.result.productId);assert.equal(item.unit_price,95);assert.equal('cost_snapshot' in item,false);
  const piExport=await fetch(`http://127.0.0.1:${port}/api/sales-quotes/${quoteId}/export/excel`,{headers:{Cookie:sales.cookie}});assert.equal(piExport.status,200);const piText=await piExport.text();assert.equal(piText.includes('supplier_cost'),false);assert.ok(piText.includes('PIC2C Dining Chair'));

  const ui=await fetch(`http://127.0.0.1:${port}/app.js`).then(r=>r.text());for(const contract of ['Product Import Review','Image Evidence','Product Completeness','Needs Human Review','importReviewRow'])assert.match(ui,new RegExp(contract));
});

test('V5.3 PIC-1 exposes Product Intelligence API boundary without leaking supplier data',async()=>{
  const owner=await login('owner@rspro.ai'),sales=await login('sales@rspro.ai');
  const library=await fetch(`http://127.0.0.1:${port}/api/products`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());
  const category=library.categories.find(row=>row.name==='Dining Chair')||library.categories[0];
  const createResponse=await fetch(`http://127.0.0.1:${port}/api/products`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({category_id:category.id,sku:'PIC1-BOUNDARY-CHAIR',name:'PIC1 Boundary Chair',materials:'Ash Wood',size:'520 x 560 x 820 mm',color:'Walnut',finish:'Matte PU',price_range:'USD 100 - 150',moq:20,lead_time_days:30,sales_notes:'Use for Product Intelligence API boundary regression.',library_status:'Approved',visibility:'Website + Quote',default_supplier:'PIC1 Factory',supplier_sku:'PIC1-SUP-001',supplier_cost:42,supplier_notes:'Confidential supplier note'})});
  const created=await createResponse.json();assert.equal(createResponse.status,201,created.error);
  const variantResponse=await fetch(`http://127.0.0.1:${port}/api/products/${created.product.id}/variants`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({variant_name:'Standard',variant_sku:'PIC1-STD',dimensions:'520 x 560 x 820 mm',material:'Ash Wood',finish:'Matte PU',color:'Walnut',reference_price:128,cost_price:42,supplier_cost:42,supplier_sku:'PIC1-SUP-V1',supplier_currency:'USD',status:'Active'})});
  const variant=await variantResponse.json();assert.equal(variantResponse.status,201,variant.error);

  const listResponse=await fetch(`http://127.0.0.1:${port}/api/product-intelligence/products`,{headers:{Cookie:owner.cookie}});
  const list=await listResponse.json();assert.equal(listResponse.status,200,list.error);
  const listItem=list.products.find(product=>product.id===created.product.id);assert.ok(listItem);assert.equal(listItem.product_name,'PIC1 Boundary Chair');assert.equal(typeof listItem.data_quality,'number');assert.equal(list.aiIntegration.externalProviderCalled,false);

  const ownerDetailResponse=await fetch(`http://127.0.0.1:${port}/api/product-intelligence/products/${created.product.id}`,{headers:{Cookie:owner.cookie}});
  const ownerDetail=await ownerDetailResponse.json();assert.equal(ownerDetailResponse.status,200,ownerDetail.error);
  assert.equal(ownerDetail.product.basic_information.sku,'PIC1-BOUNDARY-CHAIR');
  assert.ok(ownerDetail.product.variants.some(row=>row.id===variant.variant.id));
  assert.ok(ownerDetail.product.attributes.definitions);
  assert.ok(ownerDetail.product.media);
  assert.equal(ownerDetail.product.pricing_summary.variants[0].supplier_cost,42);
  assert.ok(ownerDetail.product.source_information);

  const qualityResponse=await fetch(`http://127.0.0.1:${port}/api/product-intelligence/products/${created.product.id}/quality`,{headers:{Cookie:owner.cookie}});
  const quality=await qualityResponse.json();assert.equal(qualityResponse.status,200,quality.error);assert.equal(quality.sku,'PIC1-BOUNDARY-CHAIR');assert.equal(typeof quality.quality.data_quality,'number');assert.ok(Array.isArray(quality.quality.missing_fields));

  const salesDetail=await fetch(`http://127.0.0.1:${port}/api/product-intelligence/products/${created.product.id}`,{headers:{Cookie:sales.cookie}}).then(r=>r.json());
  const salesText=JSON.stringify(salesDetail);for(const secret of ['default_supplier','supplier_sku','supplier_cost','supplier_notes','cost_price','converted_cost','exchange_rate','source_supplier'])assert.equal(salesText.includes(`"${secret}"`),false,`Sales Product Intelligence detail leaked ${secret}`);
  assert.equal(salesDetail.product.source_information,null);

  const contextResponse=await fetch(`http://127.0.0.1:${port}/api/product-intelligence/context/products/${created.product.id}`,{headers:{Cookie:sales.cookie}});
  const context=await contextResponse.json();assert.equal(contextResponse.status,200,context.error);
  assert.equal(context.context.product.sku,'PIC1-BOUNDARY-CHAIR');
  assert.ok(context.context.usage_contract.allowed_for.includes('AI recommendation'));
  assert.ok(context.context.variants.some(row=>row.variant_sku==='PIC1-STD'));
  const contextText=JSON.stringify(context);for(const secret of ['supplier_cost','supplier_sku','cost_price','source_supplier'])assert.equal(contextText.includes(`"${secret}"`),false,`Sales Product Intelligence context leaked ${secret}`);
});

test('Alpha Test Issue 012 keeps a failed Import Batch with a clear spreadsheet error report',async()=>{
  const owner=await login('owner@rspro.ai');const response=await fetch(`http://127.0.0.1:${port}/api/imports/analyze`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({filename:'broken-DUBA.xlsx',file_base64:Buffer.from('not a valid xlsx').toString('base64'),import_mode:'Smart Import'})});const body=await response.json();assert.equal(response.status,400);assert.match(body.error,/valid XLSX|save it again/i);assert.equal(body.batch.status,'Failed');assert.ok(body.batch.error_count>=1);const imports=await fetch(`http://127.0.0.1:${port}/api/imports?batch_id=${body.batch.id}`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());assert.equal(imports.batch.id,body.batch.id);assert.equal(imports.batch.status,'Failed');const report=await fetch(`http://127.0.0.1:${port}/api/imports/${body.batch.id}/errors.xlsx`,{headers:{Cookie:owner.cookie}});assert.equal(report.status,200);
});

test('Alpha Test Issue 010 clears all Product Library and import trial data while preserving master data',async()=>{
  const owner=await login('owner@rspro.ai');
  const beforeProducts=await fetch(`http://127.0.0.1:${port}/api/products`,{headers:{Cookie:owner.cookie}}).then(r=>r.json()),beforeImports=await fetch(`http://127.0.0.1:${port}/api/imports`,{headers:{Cookie:owner.cookie}}).then(r=>r.json()),beforeRules=await fetch(`http://127.0.0.1:${port}/api/price-rules`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());
  assert.ok(beforeProducts.products.length>0);assert.ok(beforeImports.batches.length>0);assert.ok(beforeRules.rules.length>=2);
  const response=await fetch(`http://127.0.0.1:${port}/api/products/clear-demo-data`,{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({confirm:'CLEAR DEMO DATA'})});const result=await response.json();assert.equal(response.status,200,result.error);assert.equal(result.cleared,true);assert.ok(result.counts.products>0);assert.ok(result.counts.variants>0);assert.ok(result.counts.batches>0);assert.ok(result.counts.drafts>0);assert.match(result.message,/Products deleted: \d+\. Variants deleted: \d+\. Import batches deleted: \d+\. Drafts deleted: \d+\./);
  const afterProducts=await fetch(`http://127.0.0.1:${port}/api/products`,{headers:{Cookie:owner.cookie}}).then(r=>r.json()),afterImports=await fetch(`http://127.0.0.1:${port}/api/imports`,{headers:{Cookie:owner.cookie}}).then(r=>r.json()),afterRules=await fetch(`http://127.0.0.1:${port}/api/price-rules`,{headers:{Cookie:owner.cookie}}).then(r=>r.json());
  assert.equal(afterProducts.products.length,0);assert.equal(afterProducts.categories.length,beforeProducts.categories.length);assert.equal(afterProducts.attributeDefinitions.length,beforeProducts.attributeDefinitions.length);assert.equal(afterImports.batches.length,0);assert.equal(afterImports.batch,null);assert.equal(afterRules.rules.length,beforeRules.rules.length);
});
