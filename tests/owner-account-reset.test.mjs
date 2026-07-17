import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { hashPassword, verifyPassword } from '../src/services/auth-password.mjs';

const script = readFileSync(new URL('../scripts/reset-owner-account.mjs', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const render = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');

test('Owner reset reuses the application password hash contract', () => {
  const encoded = hashPassword('Temporary-Owner-123!');
  assert.match(encoded, /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.equal(verifyPassword('Temporary-Owner-123!', encoded), true);
  assert.equal(verifyPassword('Old-Owner-Password!', encoded), false);
});

test('Owner reset is interactive, updates one existing Owner, and invalidates sessions', () => {
  assert.match(script, /process\.argv\.length > 2/);
  assert.match(script, /stdin\.isTTY/);
  assert.match(script, /stdin\.setRawMode\(true\)/);
  assert.match(script, /WHERE role='Owner' FOR UPDATE/);
  assert.match(script, /ownerResult\.rowCount !== 1/);
  assert.match(script, /UPDATE users SET email=\$1,password_hash=\$2/);
  assert.match(script, /DELETE FROM sessions WHERE user_id=\$1/);
  assert.doesNotMatch(script, /INSERT INTO users/i);
  assert.doesNotMatch(script, /console\.log\([^\n]*(?:newPassword|confirmation|passwordHash)/);
});

test('production hides Demo entry before JavaScript runs and Render disables Demo seeds', () => {
  assert.match(index, /id="demo-login"[^>]+class="demo-login is-hidden"[^>]+hidden/);
  assert.doesNotMatch(index, /All demo accounts use|Welcome123/);
  assert.match(app, /container\.replaceChildren\(\)/);
  assert.match(render, /key: DEMO_MODE\s+value: "false"/);
  assert.match(render, /key: ENABLE_DEMO_SEED\s+value: "false"/);
  assert.match(render, /key: RULES_MOCK_CONNECTOR_ENABLED\s+value: "false"/);
});
