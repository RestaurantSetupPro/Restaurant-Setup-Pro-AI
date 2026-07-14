import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('public/app.js');
const styles = read('public/styles.css');
const server = read('src/server.mjs');
const importer = read('src/services/smart-product-import.mjs');
const migration = read('database/migrations/030_product_module_finalization.sql');

test('migration 030 is additive and protects the one-active-axis contract', () => {
  for (const contract of ['product_attribute_aliases','supplier_import_mapping_profiles','channel_product_mappings','uq_product_variant_axes_one_active','variant_axis_review_status']) assert.match(migration, new RegExp(contract));
  assert.match(migration, /HAVING COUNT\(\*\)>1/);
  assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+(?:products|product_variants)/i);
});

test('server enforces one Variant Option and human review for multi-variable imports', () => {
  assert.match(server, /axisIds\.length>1/);
  assert.match(server, /options\.length!==1/);
  assert.match(server, /auto_combination_blocked/);
  assert.match(server, /Select one Variant Option or split this draft/);
  assert.match(importer, /variant_axis_candidates/);
  assert.match(importer, /varying\.length>1/);
});

test('product master data supports aliases, controlled tag suggestions, and channel preparation only', () => {
  for (const contract of ['matchProductImportField','addProductAttributeAlias','importMappingProfiles','productTagRecommendations','upsertChannelMapping']) assert.match(server, new RegExp(contract));
  assert.match(server, /requires_human_confirmation:true/);
  assert.match(server, /requires_human_review:true/);
  assert.match(server, /external_api_called:false/);
  assert.doesNotMatch(server, /api\.shopify\.com|woocommerce\.com\/wp-json/i);
});

test('product UI converges on seven tabs and does not expose a default variant or raw import JSON', () => {
  for (const tab of ['overview','media','specifications','variants','pricing','relationships','channelReadiness']) assert.match(app, new RegExp(`productFinal\\.${tab}`));
  assert.match(app, /noVariantProduct/);
  assert.match(app, /document\.querySelectorAll\('\.import-raw-debug,pre'\)/);
  assert.doesNotMatch(app, /route: 'product-library-variants'/);
  assert.match(app, /requiredPermission: 'knowledge-dashboard'/);
});

test('product finalization layout has safe desktop and narrow-screen behavior', () => {
  for (const contract of ['category-config-card','category-summary-name','relationship-list','channel-readiness','axis-choice-grid']) assert.match(styles, new RegExp(contract));
  assert.match(styles, /@media\(max-width:1100px\)/);
  assert.match(styles, /@media\(max-width:700px\)/);
});
