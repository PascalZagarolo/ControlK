import 'server-only';
import { put, del, type PutBlobResult } from '@vercel/blob';

const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function uploadBlob(
  path: string,
  body: Buffer | Blob | ArrayBuffer | ReadableStream,
  options?: { access?: 'public'; contentType?: string }
): Promise<PutBlobResult | null> {
  if (!blobEnabled()) return null;
  return put(path, body, {
    access: options?.access ?? 'public',
    contentType: options?.contentType,
    addRandomSuffix: true,
  });
}

export async function deleteBlob(url: string) {
  if (!blobEnabled()) return;
  await del(url);
}
