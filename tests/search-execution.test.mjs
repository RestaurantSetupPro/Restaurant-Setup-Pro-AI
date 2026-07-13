import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSearchConnectorRegistry } from '../src/services/search-execution.mjs';

const app=readFileSync(resolve(import.meta.dirname,'../public/app.js'),'utf8');

test('Workflow 1C registry exposes only the approved deterministic Rules/Mock connector', async () => {
  const registry=createSearchConnectorRegistry(),listed=registry.list();
  assert.deepEqual(listed.map(item=>item.key),['rules-mock']);
  assert.equal(listed[0].approved,true);
  assert.equal(listed[0].costType,'zero-cost');
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
  const connector=createSearchConnectorRegistry().get('rules-mock'),request={query:{keywords:[]},limits:{}};
  await assert.rejects(()=>connector.executePage(request,null,{scenario:'429',attempt:0}),error=>connector.classifyError(error).retryable);
  await assert.rejects(()=>connector.executePage(request,null,{scenario:'auth'}),error=>!connector.classifyError(error).retryable);
  const recovered=await connector.executePage(request,null,{scenario:'429',attempt:1});
  assert.ok(recovered.records.length);
});

test('Search Execution UI renders every statistic in an independent definition-list node', () => {
  for(const label of ['Connector','Version','Phase','Pages','Received','Normalized','Inserted','Duplicates','Estimated Cost','Approved Limit'])assert.match(app,new RegExp(`<dt>${label}</dt><dd>`));
  assert.match(app,/execution\?\.status==='Completed'\?'Complete'/);
  assert.doesNotMatch(app,/<small>v\$\{esc\(execution\.connector_version\)\}<\/small>/);
  assert.doesNotMatch(app,/normalized<\/small>/);
});
