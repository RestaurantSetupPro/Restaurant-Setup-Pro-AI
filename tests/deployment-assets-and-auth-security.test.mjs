import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');

test('production assets are commit-versioned and explicitly bypass static caches', () => {
  assert.match(index, /\/app\.js\?v=__BUILD_VERSION__/);
  assert.match(index, /\/styles\.css\?v=__BUILD_VERSION__/);
  assert.match(server, /process\.env\.RENDER_GIT_COMMIT/);
  assert.match(server, /'X-Build-Version': buildVersion/);
  assert.match(server, /'CDN-Cache-Control': 'no-store'/);
  assert.match(server, /'Surrogate-Control': 'no-store'/);
  assert.match(server, /status: 'ok', build: buildVersion/);
});

test('login credentials are POSTed in the request body and never generated as URL query data', () => {
  assert.match(index, /<form id="login-form"[^>]+method="post"[^>]+action="\/api\/auth\/login"/);
  assert.doesNotMatch(index, /id="(?:email|password)"[^>]+value=/);
  assert.match(app, /api\('\/api\/auth\/login', \{ method: 'POST', body: JSON\.stringify\(\{ email:/);
  assert.doesNotMatch(app, /URLSearchParams\([^)]*(?:email|password)/i);
  assert.doesNotMatch(app, /[?&](?:email|password)=/i);
  assert.match(server, /Login credentials must be sent in the POST request body, never in the URL/);
  assert.match(server, /'Referrer-Policy': 'no-referrer'/);
  assert.match(index, /history\.replaceState/);
});
