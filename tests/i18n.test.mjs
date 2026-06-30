import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import en from '../public/locales/en.js';
import zh from '../public/locales/zh-CN.js';

function flatten(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' ? flatten(value, path) : [path];
  });
}

test('English and Chinese resources have identical key coverage', () => {
  assert.deepEqual(flatten(zh).sort(), flatten(en).sort());
});

test('all requested navigation modules and product fields are localized', () => {
  const navigation = ['dashboard', 'products', 'imports', 'images', 'proposals', 'cases', 'crm', 'salesAi', 'contentAi', 'coreFoundation', 'debugCenter', 'settings'];
  const fields = ['sku', 'productName', 'category', 'material', 'size', 'priceRange', 'leadTime', 'moq', 'tags', 'status'];
  for (const key of navigation) {
    assert.ok(en.nav[key]);
    assert.ok(zh.nav[key]);
    assert.notEqual(en.nav[key], zh.nav[key]);
  }
  for (const key of fields) {
    assert.ok(en.fields[key]);
    assert.ok(zh.fields[key]);
  }
});

test('the app uses the shared i18n module and exposes a language switcher', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(app, /from '\.\/i18n\.js'/);
  assert.match(html, /id="language-button"/);
  assert.match(html, /id="language-menu"/);
});
