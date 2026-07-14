import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const app = read('public/app.js');
const server = read('src/server.mjs');
const db = new DatabaseSync(resolve(root, 'data/restaurant-setup-pro.db'));

test('multi-variant products share one configuration status across list and detail', () => {
  assert.match(server, /function productVariantSummary\(productOrId, foundation = null\)/);
  assert.match(server, /variantConfigurationStatus/);
  assert.match(server, /hasVariants/);
  assert.match(server, /activeVariantAxis/);
  assert.match(server, /variantCount: variantSummary\.variantCount/);
  assert.match(server, /variant_configuration_status: variantSummary\.variantConfigurationStatus/);
  assert.match(app, /variantConfigurationStatus/);
  assert.match(app, /existingVariantsDetected/);
  assert.match(read('public/locales/en.js'), /configureVariantOption:'Configure Variant Option'/);
  assert.match(read('public/locales/zh-CN.js'), /configureVariantOption:'配置规格变化字段'/);

  const totals = db.prepare('SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM product_variants) AS variants').get();
  assert.equal(Number(totals.products), 8);
  assert.equal(Number(totals.variants), 27);

  const dbA010 = db.prepare(`
    SELECT p.id, p.sku, COUNT(DISTINCT pv.id) AS variant_count,
      COUNT(DISTINCT CASE WHEN pva.active = 1 THEN pva.attribute_id END) AS active_axis_count
    FROM products p
    LEFT JOIN product_variants pv ON pv.product_id = p.id
    LEFT JOIN product_variant_axes pva ON pva.product_id = p.id
    WHERE p.sku = ?
    GROUP BY p.id
  `).get('DB-A010');

  assert.equal(Number(dbA010.variant_count), 3);
  assert.equal(Number(dbA010.active_axis_count), 0);
});

test('DB-A010 keeps its three SKUs and selling prices unchanged', () => {
  const rows = db.prepare(`
    SELECT variant_sku, reference_price
    FROM product_variants
    WHERE product_id = (SELECT id FROM products WHERE sku = ?)
    ORDER BY sort_order, id
  `).all('DB-A010');

  assert.deepEqual(rows.map(row => row.variant_sku), ['DB-A010--400', 'DB-A010--450', 'DB-A010--500']);
  assert.deepEqual(rows.map(row => Number(row.reference_price)), [80, 95, 115]);
});

test('variant configuration writes stay restricted to one active axis and unique values', () => {
  assert.match(server, /updateProductVariantConfiguration/);
  assert.match(server, /A Product can have only one active Variant Option/);
  assert.match(server, /Variant values must be unique within a product/);
  assert.match(server, /All mapped variants must belong to this product/);
  assert.match(server, /Product editing is not allowed/);
});
