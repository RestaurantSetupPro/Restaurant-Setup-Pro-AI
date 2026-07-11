import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { uniqueNavigationItems } from '../public/navigation.js';

const app = readFileSync(resolve(import.meta.dirname, '../public/app.js'), 'utf8');
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
  assert.match(app, /'knowledge-dashboard': renderKnowledgeDashboard/);
});
