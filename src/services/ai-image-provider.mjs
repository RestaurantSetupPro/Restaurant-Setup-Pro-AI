import { MockImageProvider } from './mock-image-provider.mjs';
import { OpenAIImageProvider } from './openai-image-provider.mjs';

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function aiImageProviderConfig(environment = process.env) {
  const requestedProvider = String(environment.AI_IMAGE_PROVIDER || 'mock').trim().toLowerCase();
  const apiKeyConfigured = Boolean(String(environment.OPENAI_API_KEY || '').trim());
  const activeProvider = requestedProvider === 'openai' && apiKeyConfigured ? 'openai' : 'mock';
  return {
    requestedProvider,
    activeProvider,
    available: activeProvider === 'mock' || apiKeyConfigured,
    apiKeyConfigured,
    model: String(environment.AI_IMAGE_MODEL || 'gpt-image-1').trim(),
    size: String(environment.AI_IMAGE_SIZE || '1024x1024').trim(),
    maxPerRun: Math.min(10, positiveInteger(environment.AI_IMAGE_MAX_PER_RUN, 3)),
    fallbackReason: requestedProvider === 'openai' && !apiKeyConfigured ? 'OPENAI_API_KEY is not configured; mock provider is active.' : null
  };
}

export function createAiImageProvider(environment = process.env) {
  const config = aiImageProviderConfig(environment);
  const provider = config.activeProvider === 'openai'
    ? new OpenAIImageProvider({ apiKey: environment.OPENAI_API_KEY, model: config.model, size: config.size })
    : new MockImageProvider({ model: config.activeProvider === 'mock' ? 'mock-commercial-image-v1' : config.model, size: config.size });
  return { config, provider };
}
