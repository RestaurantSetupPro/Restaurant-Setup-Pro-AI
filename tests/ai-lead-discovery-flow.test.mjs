import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
const locationProvider = readFileSync(new URL('../src/services/location-provider.mjs', import.meta.url), 'utf8');
const geoapifyLocationProvider = readFileSync(new URL('../src/services/geoapify-location-provider.mjs', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../public/locales/zh-CN.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('AI Discovery exposes explicit workflow, stale, success, error and separate service states', () => {
  for (const state of ['idle','analyzing','analyzed','generating_plan','plan_generated','creating_strategy','strategy_created','error']) assert.match(app, new RegExp(state));
  assert.match(app, /discoveryStale=true/);
  assert.match(app, /locationService/);
  assert.match(app, /businessSearchSource/);
  assert.match(app, /scrollIntoView/);
  assert.match(app, /state\.discoveryError=error\.message/);
  assert.match(app, /state\.discoveryStrategyCreatedId/);
  assert.match(app, /generated-search-plan'\)\?\.remove/);
  assert.match(app, /strategy_key:`discovery-/);
});

test('Discovery plan uses the generic Location Provider contract without invoking a connector', () => {
  for (const token of ['target_quantity','customer_types','full_location','category_label','provider_category','connector_search_semantics']) assert.match(server, new RegExp(token));
  assert.match(server, /minimumQualifiedCount: null/);
  assert.doesNotMatch(server.slice(server.indexOf('async analyzeCustomerDiscovery'), server.indexOf('searchTasks\(req, res\)')), /executeSearch|geoapify.*fetch/i);
  assert.doesNotMatch(server, /function inferDiscoveryLocation/);
  assert.doesNotMatch(server, /function inferDiscoveryCustomerTypes?/);
  assert.match(server, /selectedDiscoveryLocation\(body\.selected_location\)/);
  assert.match(server, /createLocationProviderRegistry/);
  assert.match(server, /\/api\/location-providers/);
  assert.match(server, /\/api\/location-suggestions/);
  assert.match(geoapifyLocationProvider, /\/v1\/geocode\/autocomplete/);
  for (const field of ['formatted_location','country','country_code','state','city','latitude','longitude','bounds','location_provider','provider_location_id']) assert.match(locationProvider, new RegExp(field));
  assert.doesNotMatch(server, /plan\.location\?\.place_id|placeId: plan\.location/);
  assert.match(app, /customer-discovery-location/);
  assert.match(app, /name="customer-discovery-type"/);
  assert.match(app, /customer_types:state\.discoveryCustomerTypes/);
  assert.match(app, /!state\.discoveryCustomerTypes\.length/);
  assert.match(app, /customer-discovery-quantity/);
  assert.match(app, /customer-discovery-category/);
  const buildPlan = server.slice(server.indexOf('function buildDiscoveryPlan'), server.indexOf('function selectedDiscoveryLocation'));
  assert.match(buildPlan, /inputs\.customerTypes/);
  assert.doesNotMatch(buildPlan, /inferDiscoveryCustomerType|customerTypeLines/);
  assert.match(server, /Select at least one Target Customer Type/);
});

test('Simplified Chinese discovery UI includes generic location and business-search terminology', () => {
  for (const text of ['正在分析……','分析完成','正在生成……','搜索计划已生成','正在创建……','已过期','搜索指导','搜索目标','建议筛选条件','必需字段','可开始搜索','地点服务','企业搜索来源','企业搜索分类']) assert.match(zh, new RegExp(text));
});

test('AI Discovery uses the shared readable UI foundation and responsive layout', () => {
  for (const token of ['--ui-font-page-title','--ui-font-section-title','--ui-font-body','--ui-font-help','--ui-line-height','.ui-card','.ui-field','.ui-status','.discovery-control-grid','.discovery-type-options']) assert.match(styles, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(styles, /@media\(max-width:640px\).*\.discovery-control-grid/);
  assert.match(app, /rows="5"/);
  assert.match(app, /ui-disclosure discovery-customer-system/);
  assert.match(app, /stalePlan\?\.querySelector\('\.stage'\)/);
  assert.match(zh, /viewRules: '查看客户类型规则'/);
  assert.match(zh, /categoryFurniture: '家具与室内'/);
});
