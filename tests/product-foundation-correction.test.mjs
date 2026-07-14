import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('public/app.js');
const styles = read('public/styles.css');
const server = read('src/server.mjs');
const migration = read('database/migrations/029_product_foundation_correction.sql');

test('product foundation uses one Product action and explicit semantic master-data forms',()=>{
  const productPage=app.slice(app.indexOf('async function renderProductLibraryProducts'),app.indexOf('async function renderProductLibraryCategories'));
  assert.equal((productPage.match(/data-action="add-product"/g)||[]).length,1);
  for(const contract of ['name="name_en"','name="name_zh"','name="code" readonly','attributeCodePreview','productFoundation.applicableCategories','productFoundation.categoryAttributes'])assert.match(app,new RegExp(contract));
  assert.match(app,/select name="category_ids" multiple size="5" required/);
  assert.match(app,/option value="\$\{type\}"/);
  assert.match(app,/productFoundation\.categoryChangeWarning/);
  assert.doesNotMatch(app,/Supplier Reserved Fields \(confidential\)/);
});

test('variant UI separates axes and options from closed override fields',()=>{
  for(const contract of ['data-axis-id','data-variant-axis','option_values','productFoundation.overrideDefaults','variantAxisWarning'])assert.match(app,new RegExp(contract));
  assert.match(server,/effective_values/);
  assert.match(app,/<details class="variant-pim-fields">/);
  assert.doesNotMatch(app,/<details class="variant-pim-fields" open>/);
});

test('server owns product role enforcement and strips sensitive writes',()=>{
  assert.match(server,/\['Admin','Owner','Designer','VA'\]/);
  assert.match(server,/productInputForRole/);
  assert.match(server,/if\(!canViewSensitiveProductData\(user\)\)/);
  assert.match(server,/Variant option must use an enabled Product Variant Axis/);
  assert.match(server,/Attribute code is locked because the attribute is already in use/);
});

test('migration 029 is additive and preserves product and variant records',()=>{
  for(const contract of ['ADD COLUMN IF NOT EXISTS name_en','ADD COLUMN IF NOT EXISTS name_zh','CREATE TABLE IF NOT EXISTS product_variant_axes','CREATE TABLE IF NOT EXISTS product_variant_option_values','ON DELETE RESTRICT'])assert.match(migration,new RegExp(contract));
  assert.doesNotMatch(migration,/\bDROP\s+(?:TABLE|COLUMN)\b/i);
  assert.doesNotMatch(migration,/\bDELETE\s+FROM\s+(?:products|product_variants)\b/i);
});

test('desktop product forms retain spacing and safe responsive behavior',()=>{
  assert.match(styles,/\.library-management-grid\{gap:24px\}/);
  assert.match(styles,/\.axis-choice-grid\{display:grid;grid-template-columns:repeat\(3/);
  assert.match(styles,/@media\(max-width:1100px\)/);
  assert.match(styles,/@media\(max-width:700px\)/);
});
