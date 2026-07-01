import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

test('cloud deployment files are safe and complete', () => {
  const migration = read('database/migrations/001_initial_schema.sql');
  const intelligenceMigration = read('database/migrations/002_product_intelligence.sql');
  const factoryMigration = read('database/migrations/003_ai_product_content_factory.sql');
  const imageMigration = read('database/migrations/004_real_ai_image_generation.sql');
  const opportunityMigration = read('database/migrations/005_opportunity_intelligence_engine.sql');
  const costMigration = read('database/migrations/006_ai_cost_control.sql');
  const render = read('render.yaml');
  const env = read('.env.example');
  const ignore = read('.gitignore');
  const packageJson = JSON.parse(read('package.json'));

  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\b/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS products/);
  assert.match(migration, /ON CONFLICT \(version\) DO NOTHING/);
  assert.doesNotMatch(intelligenceMigration, /\b(DROP|TRUNCATE)\b/i);
  assert.match(intelligenceMigration, /ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_title/);
  assert.match(intelligenceMigration, /CREATE TABLE IF NOT EXISTS product_related_category_links/);
  assert.match(intelligenceMigration, /'002_product_intelligence'/);
  assert.doesNotMatch(factoryMigration, /\b(DROP|TRUNCATE)\b/i);
  assert.match(factoryMigration, /CREATE TABLE IF NOT EXISTS ai_product_content_drafts/);
  assert.match(factoryMigration, /CREATE TABLE IF NOT EXISTS ai_image_generation_tasks/);
  assert.match(factoryMigration, /'003_ai_product_content_factory'/);
  assert.doesNotMatch(imageMigration, /\b(DROP TABLE|DROP COLUMN|TRUNCATE)\b/i);
  assert.match(imageMigration, /ADD COLUMN IF NOT EXISTS lifecycle_status/);
  assert.match(imageMigration, /ADD COLUMN IF NOT EXISTS provider_request_id/);
  assert.match(imageMigration, /'004_real_ai_image_generation'/);
  assert.doesNotMatch(opportunityMigration, /\b(DROP TABLE|DROP COLUMN|TRUNCATE)\b/i);
  assert.match(opportunityMigration, /CREATE TABLE IF NOT EXISTS customers/);
  assert.match(opportunityMigration, /CREATE TABLE IF NOT EXISTS customer_product_recommendations/);
  assert.match(opportunityMigration, /CREATE TABLE IF NOT EXISTS customer_outreach_drafts/);
  assert.match(opportunityMigration, /'005_opportunity_intelligence_engine'/);
  assert.match(costMigration, /'006_ai_cost_control'/);
  assert.match(costMigration, /CREATE TABLE IF NOT EXISTS ai_cost_settings/);
  assert.match(costMigration, /CREATE TABLE IF NOT EXISTS ai_cost_logs/);
  assert.match(costMigration, /CREATE TABLE IF NOT EXISTS ai_cache_records/);
  assert.doesNotMatch(costMigration, /\b(DROP|TRUNCATE)\b/i);
  assert.match(render, /buildCommand: npm install/);
  assert.match(render, /startCommand: npm start/);
  assert.match(render, /healthCheckPath: \/api\/health/);
  assert.match(render, /key: DATABASE_URL\s+sync: false/);
  assert.match(env, /DATABASE_URL=/);
  assert.match(ignore, /^\.env\.local$/m);
  assert.equal(packageJson.dependencies.pg.startsWith('^8.'), true);
  assert.equal(packageJson.scripts.start, 'node src/server.mjs');
});

test('health check validates the database and returns the required payload', () => {
  const server = read('src/server.mjs');
  assert.match(server, /db\.prepare\('SELECT 1 AS ok'\)\.get\(\)/);
  assert.match(server, /json\(res, 200, \{ status: 'ok' \}\)/);
  assert.match(server, /const PORT = process\.env\.PORT \|\| 3000/);
  assert.match(server, /server\.listen\(PORT, "0\.0\.0\.0"/);
  assert.match(server, /Server listening on 0\.0\.0\.0:\$\{PORT\}/);
  assert.ok(server.indexOf('server.listen(PORT, "0.0.0.0"') < server.indexOf('setTimeout(initializeDatabase, databaseInitializationDelayMs)'));
  assert.match(server, /url\.pathname === '\/api\/ready'/);
  assert.match(server, /url\.pathname === '\/api\/debug\/db'/);
  assert.match(server, /SELECT version FROM schema_migrations WHERE version = \?/);
  assert.match(server, /information_schema\.tables/);
});
