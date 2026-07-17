import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { normalizePostgresQuery } from '../src/postgres-sql-compat.mjs';

test('PostgreSQL seed parameters use native booleans for boolean columns', () => {
  const normalized = normalizePostgresQuery(
    'INSERT INTO product_attribute_definitions(name,code,data_type,unit,active,sort_order) VALUES(?,?,?,?,?,?)',
    ['Material', 'MATERIAL', 'Select', null, 1, 10]
  );
  assert.equal(normalized.sql, 'INSERT INTO product_attribute_definitions(name,code,data_type,unit,active,sort_order) VALUES($1,$2,$3,$4,$5,$6)');
  assert.deepEqual(normalized.params, ['Material', 'MATERIAL', 'Select', null, true, 10]);
});

test('PostgreSQL compatibility covers boolean literals without changing integer flag tables', () => {
  const booleanQuery = normalizePostgresQuery('SELECT * FROM customer_type_profiles WHERE active=1 AND is_default=0');
  assert.match(booleanQuery.sql, /active=TRUE/);

  const integerQuery = normalizePostgresQuery('UPDATE system_configs SET active=0, is_system=1 WHERE id=?', [5]);
  assert.equal(integerQuery.sql, 'UPDATE system_configs SET active=0, is_system=1 WHERE id=$1');
  assert.deepEqual(integerQuery.params, [5]);

  const insertLiteral = normalizePostgresQuery(
    'INSERT INTO product_variant_axes(product_id,attribute_id,sort_order,active) VALUES(?,?,0,1)',
    [7, 2]
  );
  assert.match(insertLiteral.sql, /VALUES\(\$1,\$2,0,TRUE\)/);
});

test('PostgreSQL compatibility normalizes all migrated boolean field families', () => {
  const cases = [
    ['UPDATE product_categories SET active=? WHERE id=?', [1, 4], [true, 4]],
    ['UPDATE products SET request_quote_enabled=0, customization_available=1 WHERE id=?', [2], [2]],
    ['UPDATE organization_bank_accounts SET is_default=?, active=? WHERE id=?', [0, 1, 8], [false, true, 8]],
    ['UPDATE ai_cost_settings SET allow_paid_provider=? WHERE id=?', [1, 3], [true, 3]],
    ['UPDATE lead_enrichment_jobs SET retry_failed=? WHERE id=?', [0, 9], [false, 9]]
  ];
  for (const [sql, params, expected] of cases) {
    const normalized = normalizePostgresQuery(sql, params);
    assert.deepEqual(normalized.params, expected);
    assert.doesNotMatch(normalized.sql, /(?:active|enabled|is_default|allow_paid_provider|retry_failed)\s*=\s*[01]\b/i);
  }
});

test('SQLite keeps integer boolean storage for local initialization', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE product_attribute_definitions (
    id INTEGER PRIMARY KEY, name TEXT, code TEXT, data_type TEXT, unit TEXT,
    active INTEGER NOT NULL CHECK(active IN (0,1)), sort_order INTEGER
  )`);
  db.prepare('INSERT INTO product_attribute_definitions(name,code,data_type,unit,active,sort_order) VALUES(?,?,?,?,?,?)')
    .run('Material', 'MATERIAL', 'Select', null, 1, 10);
  assert.equal(db.prepare('SELECT active FROM product_attribute_definitions').get().active, 1);
  db.close();
});
