import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function safePart(value) {
  return String(value || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'image';
}

export async function saveGeneratedImage({ publicDir, productId, taskId, imageType, result }) {
  const directory = join(publicDir, 'generated');
  await mkdir(directory, { recursive: true });
  const extension = String(result.extension || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
  const fileName = `product-${productId}-task-${taskId}-${safePart(imageType)}-${Date.now()}.${extension}`;
  await writeFile(join(directory, fileName), result.bytes);
  return { fileName, fileUrl: `/generated/${fileName}`, storageProvider: 'local-generated' };
}
