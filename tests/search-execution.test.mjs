import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSearchConnectorRegistry } from '../src/services/search-execution.mjs';

const app=readFileSync(resolve(import.meta.dirname,'../public/app.js'),'utf8');
const server=readFileSync(resolve(import.meta.dirname,'../src/server.mjs'),'utf8');
const styles=readFileSync(resolve(import.meta.dirname,'../public/styles.css'),'utf8');
const zh=readFileSync(resolve(import.meta.dirname,'../public/locales/zh-CN.js'),'utf8');
const enrichmentService=readFileSync(resolve(import.meta.dirname,'../src/services/website-evidence-enrichment.mjs'),'utf8');
const testConnectorEnv={...process.env,RULES_MOCK_CONNECTOR_ENABLED:'true'};

test('Workflow 1C registry preserves Rules/Mock for tests and exposes Google Places without leaking credentials', async () => {
  const registry=createSearchConnectorRegistry({env:testConnectorEnv}),listed=registry.list();
  assert.deepEqual(listed.map(item=>item.key),['rules-mock','google-places-new','geoapify-places']);
  assert.equal(listed[0].approved,true);
  assert.equal(listed[0].costType,'zero-cost');
  assert.equal(listed[1].credentialPresent,false);
  assert.equal(listed[1].enabled,false);
  assert.equal(listed[2].enabled,true);
  assert.equal(registry.get('google-maps'),null);
  const connector=registry.get('rules-mock');
  const request={query:{keywords:['restaurant furniture']},limits:{maxPages:3,maxResults:6}};
  assert.deepEqual(connector.estimate(request).expected,0);
  const first=await connector.executePage(request,null,{}),again=await connector.executePage(request,null,{});
  assert.deepEqual(first.records,again.records);
  assert.equal(first.hasMore,true);
  assert.equal(first.records[0].external_id,'mock-001');
});

test('Rules/Mock classifies retryable and terminal failures through the shared contract', async () => {
  const connector=createSearchConnectorRegistry({env:testConnectorEnv}).get('rules-mock'),request={query:{keywords:[]},limits:{}};
  await assert.rejects(()=>connector.executePage(request,null,{scenario:'429',attempt:0}),error=>connector.classifyError(error).retryable);
  await assert.rejects(()=>connector.executePage(request,null,{scenario:'auth'}),error=>!connector.classifyError(error).retryable);
  const recovered=await connector.executePage(request,null,{scenario:'429',attempt:1});
  assert.ok(recovered.records.length);
});

test('Rules/Mock is disabled and hidden unless explicitly enabled for tests', () => {
  const registry=createSearchConnectorRegistry({env:{...process.env,RULES_MOCK_CONNECTOR_ENABLED:'false'}});
  assert.equal(registry.get('rules-mock'),null);
  assert.equal(registry.list().some(item=>item.key==='rules-mock'),false);
  assert.match(server,/ENABLE_DEMO_SEED === 'true'/);
  assert.match(app,/let demoMode = false/);
});

test('Search Task detail is a concise batch summary with only five Lead previews', () => {
  assert.match(app,/task-summary-grid/);
  assert.match(app,/task-kpi-grid/);
  assert.match(app,/results\.slice\(0,5\)/);
  assert.match(app,/data-action="view-task-leads"/);
  assert.doesNotMatch(app.slice(app.indexOf('function renderSearchTaskDetail'),app.indexOf('function renderSearchTasksPane')),/groupedResults|qualification-groups/);
});

test('Geoapify leads remain unclassified before AI Qualification', () => {
  const connector=createSearchConnectorRegistry().get('geoapify-places');
  assert.ok(connector);
  const normalized=connector.normalize({
    external_id:'geo-truth-1',
    company_name:'Example Furniture Store',
    customer_type:'Restaurant Furniture Distributor',
    category:'commercial.furniture_and_interior',
    country:'United States',
    city:'Los Angeles'
  },{
    connectorKey:'geoapify-places',
    connector,
    task:{customer_type:'Restaurant Furniture Distributor',industry:'Hospitality Furniture'}
  });
  assert.equal(normalized.customer_type,'Unclassified / Furniture & Interior Business');
  assert.equal(normalized.source_category,'commercial.furniture_and_interior');
});

test('Lead detail separates provider facts, standardized fields, and AI judgment', () => {
  const detail=app.slice(app.indexOf('function renderLeadDetail'),app.indexOf('function applyCustomerListFilters'));
  assert.match(detail,/lead-decision-card/);
  assert.match(detail,/d\('providerFacts'\)/);
  assert.match(detail,/d\('standardizedFields'\)/);
  assert.match(detail,/d\('aiConclusion'\)/);
  assert.match(detail,/id="lead-evidence-details"/);
  assert.doesNotMatch(detail,/data-action="convert-search-result"/);
  assert.match(server,/row\.connector_key !== 'geoapify-places' && aiQualification\.status === 'Qualified'/);
});

test('Search Task stays concise and Lead Pool uses the grouped AI review table', () => {
  const taskPane=app.slice(app.indexOf('function searchTaskRows'),app.indexOf('function strategyCsv'));
  const leadPool=app.slice(app.indexOf('function leadPoolTable'),app.indexOf('function renderLeadDetail'));
  assert.match(taskPane,/readable-list-table search-task-list-table/);
  assert.match(taskPane,/data-action="view-search-task"/);
  assert.doesNotMatch(taskPane,/<th>Company Size<\/th>|<th>Priority<\/th>/);
  assert.match(leadPool,/readable-list-table lead-pool-table/);
  assert.match(leadPool,/data-action="view-search-result"/);
  assert.match(leadPool,/lead-pool-group-tabs/);
  assert.match(leadPool,/data-lead-filter="taskId"/);
  assert.match(leadPool,/data-lead-filter="region"/);
  assert.match(leadPool,/q\('oneSentenceReason'\)/);
  assert.match(leadPool,/data-action="review-search-result"/);
  assert.match(leadPool,/data-action="discard-search-result"/);
  assert.doesNotMatch(leadPool,/<th>Address<\/th>|<th>Captured<\/th>|convert-search-result/);
  assert.match(styles,/\.readable-list-scroll\{max-width:100%;overflow-x:clip\}/);
  assert.match(styles,/\.readable-list-table td\{[^}]*font-size:14px/);
  assert.match(styles,/\.readable-list-actions\{position:sticky;right:0/);
  for(const label of ['任务名称','客户类型','地区','数量','创建时间','公司名称','AI结论','分数','1句理由','缺失信息','保留','放弃','查看证据'])assert.match(zh,new RegExp(label.replace('/','\\/')));
});

test('completed searches trigger cost-controlled batch qualification with rule pre-screening', () => {
  assert.match(server,/onCompleted: runCompletedSearchExecutionPipeline/);
  assert.match(server,/websiteEnrichmentService\.createJob/);
  assert.match(server,/websiteEnrichmentService\.runJob/);
  assert.match(server,/preQualificationRuleAssessment/);
  assert.match(server,/aiCallSkipped: true/);
  assert.match(server,/runSearchTaskQualificationBatch/);
  assert.match(server,/aiBusinessBrain\.runAiAction\(\{ moduleName: 'opportunity-intelligence', actionName: 'lead-qualification'/);
  assert.match(server,/qualification_progress: searchResultQualificationProgress/);
  assert.match(app,/qualification-progress/);
  assert.match(app,/refreshReanalyze/);
  assert.doesNotMatch(app.slice(app.indexOf('function renderLeadDetail'),app.indexOf('function applyCustomerListFilters')),/data-action="convert-search-result"/);
});

test('Lead Discovery information architecture separates task summary, review center, customers, and Lead detail', () => {
  const taskDetail=app.slice(app.indexOf('function renderSearchTaskDetail'),app.indexOf('function renderSearchTasksPane'));
  const leadPool=app.slice(app.indexOf('function leadPoolTable'),app.indexOf('function renderLeadDetail'));
  const leadDetail=app.slice(app.indexOf('function renderLeadDetail'),app.indexOf('function applyCustomerListFilters'));
  assert.match(taskDetail,/results\.slice\(0,5\)/);
  assert.match(taskDetail,/task-kpi-grid/);
  assert.match(taskDetail,/view-task-leads/);
  assert.doesNotMatch(taskDetail,/results\.map\(resultRow\)/);
  for(const filter of ['taskId','region','conclusion','score','reviewStatus'])assert.match(leadPool,new RegExp(`data-lead-filter="${filter}"`));
  for(const group of ['recommended','needs_confirmation','not_recommended'])assert.match(leadPool,new RegExp(group));
  assert.match(app,/customerPage\.empty/);
  const customerPage=app.slice(app.indexOf("if (view === 'customers')"),app.indexOf("if (view === 'priority')"));
  assert.doesNotMatch(customerPage,/run-selected-customers|Analyze Selected Customers/);
  assert.match(leadDetail,/lead-decision-card/);
  assert.match(leadDetail,/show-lead-evidence/);
  assert.match(leadDetail,/source-evidence-card section-gap/);
  assert.doesNotMatch(leadDetail,/data-action="convert-search-result"/);
  assert.match(styles,/\.qualification-lead-table td:last-child,.qualification-lead-table th:last-child\{position:sticky/);
});

test('Website Evidence Enrichment is connector-independent, evidence-only, and not hard-coded to acceptance data', () => {
  assert.match(server,/createWebsiteEvidenceEnrichmentService/);
  assert.match(server,/unsupportedBusinessFactsForbidden: true/);
  assert.match(server,/evidenceOnly: true/);
  assert.match(server,/searchTaskEnrichmentMatch/);
  assert.match(server,/enrichmentJobActionMatch/);
  assert.match(server,/searchResultEnrichmentMatch/);
  assert.match(enrichmentService,/providerCandidates/);
  assert.match(enrichmentService,/domainCandidatesForCompany/);
  assert.match(enrichmentService,/qualifyResult\(searchResultId, user, \{ force: true, evidenceOnly: true \}\)/);
  assert.doesNotMatch(enrichmentService,/Search Task #007|LA Nayarit|Inmod|Bob's Discount/);
  assert.match(app,/d\('enrichment'\)/);
  assert.match(app,/data-action="enrich-search-result"/);
});
