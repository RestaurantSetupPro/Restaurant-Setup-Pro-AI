import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { activateOpportunityTab, uniqueNavigationItems } from '../public/navigation.js';

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

test('Owner and Sales navigation contracts retain unique Product Library and Knowledge routes', () => {
  for (const route of productRoutes) assert.equal((app.match(new RegExp(`route: '${route}'`, 'g')) || []).length, 1);
  assert.equal((app.match(/route: 'knowledge-dashboard'/g) || []).length, 1);
  assert.match(app, /item\.route === 'knowledge-dashboard'/);
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
  for (const label of ['Customer Type', 'Location', 'Company Size', 'Priority', 'Target Volume']) {
    assert.match(app, new RegExp(`<dt>${label}</dt><dd>`));
  }
  assert.match(app, /<dt>Total Results<\/dt><dd class="search-result-stat-value">\$\{Number\(summary\.total/);
  assert.match(app, /<dt>Converted<\/dt><dd class="search-result-stat-value">\$\{Number\(summary\.converted/);
  assert.match(app, /<dt>Lead Pool<\/dt><dd class="search-result-stat-value">\$\{Number\(\(summary\.new/);
  assert.doesNotMatch(app, /Total Results\$\{Number/);
  assert.doesNotMatch(app, /Converted\$\{Number/);
  assert.doesNotMatch(app, /Lead Pool\$\{Number/);
  assert.match(styles, /\.search-criteria-grid\{display:grid/);
  assert.match(styles, /\.search-result-stat-grid\{display:grid/);
  assert.match(styles, /\.opportunity-tabs \{[^}]*z-index: 2;[^}]*pointer-events: auto;/);
  assert.match(styles, /\.opportunity-pane \{ position: relative; z-index: 1; \}/);
});
