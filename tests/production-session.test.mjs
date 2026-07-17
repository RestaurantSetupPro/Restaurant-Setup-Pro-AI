import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const root = resolve(import.meta.dirname, '..');
const port = 4199;
const databaseDir = mkdtempSync(join(tmpdir(), 'rspro-production-session-'));
const databasePath = join(databaseDir, 'session.db');
let server;
const appSource = readFileSync(join(root, 'public', 'app.js'), 'utf8');

async function waitUntilReady() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/ready`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error('Production-session test server did not become ready.');
}

test.before(async () => {
  server = spawn(process.execPath, ['src/server.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      HOST: '127.0.0.1',
      DATABASE_PATH: databasePath,
      DEMO_MODE: 'false',
      ENABLE_DEMO_SEED: 'true',
      RULES_MOCK_CONNECTOR_ENABLED: 'false',
      WEBSITE_ENRICHMENT_DISCOVERY_PROVIDER: 'disabled'
    },
    stdio: process.env.TEST_SERVER_LOGS ? 'inherit' : 'ignore'
  });
  await waitUntilReady();
});

test.after(async () => {
  if (server && !server.killed) {
    server.kill();
    await new Promise(resolveWait => server.once('exit', resolveWait));
  }
  rmSync(databaseDir, { recursive: true, force: true });
});

test('production HTTPS login cookie authenticates protected Search Strategy requests', async () => {
  for (const path of ['/api/health', '/api/ready']) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { 'X-Forwarded-Proto': 'https' } });
    assert.equal(response.status, 200);
  }

  const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
    body: JSON.stringify({ email: 'owner@rspro.ai', password: 'Welcome123!' })
  });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie') || '';
  assert.match(setCookie, /^rsp_session=[a-f0-9]{64};/);
  assert.match(setCookie, /; HttpOnly(?:;|$)/i);
  assert.match(setCookie, /; Secure(?:;|$)/i);
  assert.match(setCookie, /; SameSite=Lax(?:;|$)/i);
  assert.match(setCookie, /; Path=\/(?:;|$)/i);
  assert.doesNotMatch(setCookie, /Domain=/i);

  const sessionCookie = setCookie.split(';', 1)[0];
  const anonymous = await fetch(`http://127.0.0.1:${port}/api/search-strategies`);
  assert.equal(anonymous.status, 401);
  const authenticated = await fetch(`http://127.0.0.1:${port}/api/search-strategies`, {
    headers: { Cookie: sessionCookie, 'X-Forwarded-Proto': 'https' }
  });
  assert.equal(authenticated.status, 200);
  const payload = await authenticated.json();
  assert.ok(Array.isArray(payload.strategies));
});

test('browser confirms the Session before entering the workspace and clears 401 Sessions', () => {
  assert.match(appSource, /credentials: 'include'/);
  assert.match(appSource, /await api\('\/api\/auth\/login'/);
  assert.match(appSource, /const confirmed = await api\('\/api\/auth\/me'\)/);
  assert.ok(appSource.indexOf("const confirmed = await api('/api/auth/me')") < appSource.indexOf('state.user = confirmed.user'));
  assert.ok(appSource.indexOf('state.user = confirmed.user') < appSource.indexOf('enterApp();'));
  assert.match(appSource, /response\.status === 401[\s\S]*await clearInvalidSession\(\)/);
  assert.match(appSource, /fetch\('\/api\/auth\/logout', \{ method: 'POST', credentials: 'include'/);
});

test('logout expires the same secure host-only Session cookie', async () => {
  const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@rspro.ai', password: 'Welcome123!' })
  });
  const cookie = (login.headers.get('set-cookie') || '').split(';', 1)[0];
  const logout = await fetch(`http://127.0.0.1:${port}/api/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
  const expired = logout.headers.get('set-cookie') || '';
  assert.match(expired, /Max-Age=0/);
  assert.match(expired, /HttpOnly/i);
  assert.match(expired, /Secure/i);
  assert.match(expired, /SameSite=Lax/i);
  assert.match(expired, /Path=\//i);
  assert.doesNotMatch(expired, /Domain=/i);

  const protectedResponse = await fetch(`http://127.0.0.1:${port}/api/search-strategies`, { headers: { Cookie: cookie } });
  assert.equal(protectedResponse.status, 401);
});
