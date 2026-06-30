import { randomUUID } from 'node:crypto';

function xml(value) {
  return String(value || '').replace(/[<>&'"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
}

export class MockImageProvider {
  constructor(config = {}) {
    this.name = 'mock';
    this.model = config.model || 'mock-commercial-image-v1';
    this.size = config.size || '1024x1024';
  }

  async generate(request) {
    if (String(request.prompt).includes('[force-fail]')) throw new Error('Mock provider forced failure for retry testing.');
    await new Promise(resolve => setTimeout(resolve, 80));
    const [width, height] = this.size.split('x').map(Number);
    const title = xml(request.imageType || 'Product Image');
    const product = xml(request.productName || 'Restaurant Furniture Product');
    const prompt = xml(String(request.prompt || '').slice(0, 180));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7f3ea"/><stop offset="1" stop-color="#dfece7"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#bg)"/><rect x="${width * .16}" y="${height * .16}" width="${width * .68}" height="${height * .68}" rx="48" fill="#fff" opacity=".86"/>
      <circle cx="${width / 2}" cy="${height * .43}" r="${Math.min(width, height) * .16}" fill="#275d50" opacity=".18"/>
      <path d="M${width * .38} ${height * .58}h${width * .24}v${height * .12}M${width * .41} ${height * .58}v-${height * .18}h${width * .18}v${height * .18}" fill="none" stroke="#214d43" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="50%" y="${height * .78}" text-anchor="middle" font-family="Arial,sans-serif" font-size="38" font-weight="700" fill="#173e35">${product}</text>
      <text x="50%" y="${height * .83}" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" fill="#427267">${title} · MOCK PREVIEW</text>
      <text x="50%" y="${height * .89}" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#69847d">${prompt}</text>
    </svg>`;
    return {
      bytes: Buffer.from(svg), mimeType: 'image/svg+xml', extension: 'svg', width, height,
      requestId: `mock-${randomUUID()}`, confidence: 0.82, model: this.model
    };
  }
}
