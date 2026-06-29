import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

test('cloud deployment files are safe and complete', () => {
  const migration = read('database/migrations/001_initial_schema.sql');
  const render = read('render.yaml');
  const env = read('.env.example');
  const ignore = read('.gitignore');
  const packageJson = JSON.parse(read('package.json'));

  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE)\b/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS products/);
  assert.match(migration, /ON CONFLICT \(version\) DO NOTHING/);
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
  assert.match(server, /const port = Number\(process\.env\.PORT \|\| 3000\)/);
  assert.match(server, /server\.listen\(port, "0\.0\.0\.0"/);
  assert.match(server, /Server listening on 0\.0\.0\.0:\$\{port\}/);
  assert.ok(server.indexOf('server.listen(port, "0.0.0.0"') < server.indexOf('setTimeout(initializeDatabase'));
  assert.match(server, /url\.pathname === '\/api\/ready'/);
});
