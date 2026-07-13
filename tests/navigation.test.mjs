import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { activateOpportunityTab, navigationItemsForRole, uniqueNavigationItems } from '../public/navigation.js';

const app = readFileSync(resolve(import.meta.dirname, '../public/app.js'), 'utf8');
const styles = readFileSync(resolve(import.meta.dirname, '../public/styles.css'), 'utf8');
const productRoutes = ['product-library-products', 'product-library-categories', 'product-library-tags', 'product-library-attributes', 'product-library-variants'];

test('navigation deduplicates stable menu IDs and routes across repeated shell renders', () => {
  const configured = productRoutes.map(route => ({ id: route, route }));
  const duplicated = [...configured, ...configured, { id: 'duplicate-tags-id', route: 'product-library-tags' }];
  const firstRender = uniqueNavigationItems(duplicated);
  const secondRender = uniqueNavigationItems([...firstRender, ...duplicated]);
  assert.deepEqual(firstRender.map(item => item.route), productRoutes);
  assert.deepEqual(secondRender.map(item => item.route), productRoutes);
  assert.equal(new Set(secondRender.map(item => item.id)).size, secondRender.length);
});

test('five-group role-aware navigation retains unique Product Library and Knowledge routes', () => {
  for (const route of productRoutes) assert.equal((app.match(new RegExp(`route: '${route}'`, 'g')) || []).length, 1);
  assert.equal((app.match(/route: 'knowledge-dashboard'/g) || []).length, 1);
  for (const key of ['workspace', 'opportunities', 'products', 'commercial', 'system']) assert.match(app, new RegExp(`salesOs\\.groups\\.${key}`));
  for (const property of ['allowedRoles', 'requiredPermission', 'featureAvailability', 'activeRoutes', 'order']) assert.match(app, new RegExp(property));
  assert.match(app, /renderedIds\.size !== renderedItems\.length/);
  assert.match(app, /#main-nav'\)\.replaceChildren\(template\.content\.cloneNode\(true\)\)/);
  assert.match(app, /'knowledge-dashboard': renderKnowledgeDashboard/);
});

test('navigation configuration cannot be expanded by category data or repeated rendering', () => {
  assert.match(app, /Object\.freeze\(uniqueNavigationItems\(/);
  assert.match(app, /\.map\(item => Object\.freeze\(item\)\)/);
  assert.doesNotMatch(app, /categories\.(map|forEach).*main-nav/s);
  assert.deepEqual(productRoutes, ['product-library-products','product-library-categories','product-library-tags','product-library-attributes','product-library-variants']);
});

test('role navigation keeps stable order and hides technical or commercial modules as specified', () => {
  const items = [
    { route: 'dashboard', allowedRoles: ['Admin','Owner','Sales','Designer','VA'], requiredPermission: 'dashboard', featureAvailability: 'available', order: 10 },
    { route: 'opportunity-intelligence', allowedRoles: ['Admin','Owner','Sales','VA'], requiredPermission: 'opportunity-intelligence', featureAvailability: 'available', order: 110 },
    { route: 'sales-quotes', allowedRoles: ['Admin','Owner','Sales'], requiredPermission: 'sales-quotes', featureAvailability: 'available', order: 330 },
    { route: 'debug-center', allowedRoles: ['Admin'], requiredPermission: 'debug-center', featureAvailability: 'available', order: 420 }
  ];
  const permissions = items.map(item => item.route);
  assert.deepEqual(navigationItemsForRole(items, 'Admin', permissions).map(item => item.route), ['dashboard','opportunity-intelligence','sales-quotes','debug-center']);
  assert.deepEqual(navigationItemsForRole(items, 'Owner', permissions).map(item => item.route), ['dashboard','opportunity-intelligence','sales-quotes']);
  assert.deepEqual(navigationItemsForRole(items, 'Designer', permissions).map(item => item.route), ['dashboard']);
  assert.deepEqual(navigationItemsForRole(items, 'VA', permissions).map(item => item.route), ['dashboard','opportunity-intelligence']);
});

test('Opportunity tabs clear Lead Pool and Search Task detail state on every switch', () => {
  const state = {
    opportunityView: 'lead-pool',
    searchStrategyDetail: { id: 1 },
    searchStrategyContextOutdated: true,
    searchTaskDetail: { id: 6 },
    searchResultDetail: { id: 7 },
    searchResultEdit: { id: 7 }
  };
  for (const tab of ['dashboard', 'discovery', 'search-strategies', 'search-tasks', 'lead-pool', 'customers', 'priority', 'lead-pool', 'search-tasks']) {
    activateOpportunityTab(state, tab);
    assert.equal(state.opportunityView, tab);
    assert.equal(state.searchStrategyDetail, null);
    assert.equal(state.searchStrategyContextOutdated, false);
    assert.equal(state.searchTaskDetail, null);
    assert.equal(state.searchResultDetail, null);
    assert.equal(state.searchResultEdit, null);
  }
});

test('Search Task criteria and result statistics use separate semantic label and value nodes', () => {
  for (const key of ['customerType', 'location', 'companySize', 'priority', 'targetVolume']) {
    assert.match(app, new RegExp(`<dt>\\$\\{t\\('salesOs\\.terms\\.${key}'\\)\\}</dt><dd>`));
  }
  assert.match(app, /salesOs\.terms\.totalResults.*search-result-stat-value.*summary\.total/);
  assert.match(app, /salesOs\.terms\.converted.*search-result-stat-value.*summary\.converted/);
  assert.match(app, /salesOs\.tabs\.leads.*search-result-stat-value.*summary\.new/);
  assert.match(styles, /\.search-criteria-grid\{display:grid/);
  assert.match(styles, /\.search-result-stat-grid\{display:grid/);
  assert.match(styles, /\.opportunity-tabs \{[^}]*z-index: 2;[^}]*pointer-events: auto;/);
  assert.match(styles, /\.opportunity-pane \{ position: relative; z-index: 1; \}/);
});
