function dimensions(size) {
  const [width, height] = String(size || '1024x1024').split('x').map(Number);
  return { width: width || 1024, height: height || 1024 };
}

async function imageBytes(item) {
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`OpenAI output download failed with HTTP ${response.status}.`);
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error('OpenAI image response did not include image data.');
}

export class OpenAIImageProvider {
  constructor(config = {}) {
    this.name = 'openai';
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-image-1';
    this.size = config.size || '1024x1024';
  }

  async generate(request) {
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is not configured.');
    const combinedPrompt = `${request.prompt}\n\nAvoid: ${request.negativePrompt || 'text, watermark, logos, product geometry changes'}`;
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: combinedPrompt, size: this.size, n: 1 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `OpenAI image generation failed with HTTP ${response.status}.`);
      error.code = payload?.error?.code || `http_${response.status}`;
      throw error;
    }
    const bytes = await imageBytes(payload.data?.[0]);
    const { width, height } = dimensions(this.size);
    return {
      bytes, mimeType: 'image/png', extension: 'png', width, height,
      requestId: response.headers.get('x-request-id') || payload.id || null,
      confidence: null, model: this.model
    };
  }
}
