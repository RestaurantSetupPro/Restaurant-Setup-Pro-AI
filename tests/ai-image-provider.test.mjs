import test from 'node:test';
import assert from 'node:assert/strict';
import { aiImageProviderConfig, createAiImageProvider } from '../src/services/ai-image-provider.mjs';

test('AI image provider falls back to mock when OpenAI key is absent', async () => {
  const environment = { AI_IMAGE_PROVIDER: 'openai', AI_IMAGE_MODEL: 'gpt-image-1', AI_IMAGE_SIZE: '1024x1024', AI_IMAGE_MAX_PER_RUN: '3' };
  const config = aiImageProviderConfig(environment);
  assert.equal(config.requestedProvider, 'openai');
  assert.equal(config.activeProvider, 'mock');
  assert.equal(config.apiKeyConfigured, false);
  assert.match(config.fallbackReason, /OPENAI_API_KEY/);
  const { provider } = createAiImageProvider(environment);
  const result = await provider.generate({ prompt: 'Commercial chair front view', productName: 'Test Chair', imageType: 'Front View' });
  assert.equal(result.mimeType, 'image/svg+xml');
  assert.ok(result.bytes.length > 500);
});

test('OpenAI provider configuration is recognized without making a network call', () => {
  const config = aiImageProviderConfig({
    AI_IMAGE_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key-not-used', AI_IMAGE_MODEL: 'gpt-image-1',
    AI_IMAGE_SIZE: '1024x1024', AI_IMAGE_MAX_PER_RUN: '5'
  });
  assert.equal(config.activeProvider, 'openai');
  assert.equal(config.providerAvailable ?? config.available, true);
  assert.equal(config.apiKeyConfigured, true);
  assert.equal(config.model, 'gpt-image-1');
  assert.equal(config.maxPerRun, 5);
});
