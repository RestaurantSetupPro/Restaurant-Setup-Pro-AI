import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiProviderAdapter } from '../src/services/ai-business-brain.mjs';

test('V5.3 AI provider adapter keeps Phase 1 on safe mock/rules providers', () => {
  const rules = createAiProviderAdapter('rules');
  assert.equal(rules.provider, 'rules');
  assert.equal(rules.requestedProvider, 'rules');
  assert.equal(rules.paidProviderReady, false);
  assert.equal(rules.fallbackReason, null);

  const openai = createAiProviderAdapter('openai');
  assert.equal(openai.provider, 'mock');
  assert.equal(openai.requestedProvider, 'openai');
  assert.equal(openai.paidProviderReady, false);
  assert.match(openai.fallbackReason, /reserved for future paid-provider support/);

  const unknown = createAiProviderAdapter('unknown-provider');
  assert.equal(unknown.provider, 'mock');
  assert.equal(unknown.requestedProvider, 'mock');
});
