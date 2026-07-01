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
  assert.equal(database.migrationVersion, '007_sales_intelligence_part1');
  assert.equal(database.error, null);
  assert.ok(database.tables.includes('users'));
  const html = await fetch(`http://127.0.0.1:${port}/`).then(response => response.text());
  assert.match(html, /Restaurant Setup Pro/);
  assert.match(html, /id="login-form"/);
});

test('admin login creates a session with full access', async () => {
  const admin = await login('admin@rspro.ai');
  assert.equal(admin.response.status, 200);
  assert.equal(admin.body.user.role, 'Admin');
  assert.equal(admin.body.user.permissions.length, 19);

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

test('Module 07 Part 1 completes the simple inquiry to quote and order workflow', async () => {
  const admin = await login('admin@rspro.ai');
  await fetch(`http://127.0.0.1:${port}/api/customers`, {
    method: 'POST', headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ company_name: 'Module 07 Coffee Group', country: 'Malaysia', city: 'Kuala Lumpur', source: 'Manual' })
  });
  const sales = await login('sales@rspro.ai');
  assert.ok(['new-inquiry', 'sales-customers', 'sales-quotes', 'sales-orders', 'sales-tasks'].every(permission => sales.body.user.permissions.includes(permission)));
  const workspace = await fetch(`http://127.0.0.1:${port}/api/sales-workspace`, { headers: { Cookie: sales.cookie } }).then(r => r.json());
  assert.ok(workspace.customers.length > 0);
  assert.deepEqual(workspace.inquiryTypes, ['Product Inquiry', 'Restaurant Project', 'Freight Quote', 'Mixed Inquiry']);
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
