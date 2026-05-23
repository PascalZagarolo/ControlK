import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto';

/**
 * Symmetric secret encryption for BYOK and similar user-provided credentials.
 *
 * Algorithm: AES-256-GCM. Format on disk: `<iv-b64>:<authTag-b64>:<ct-b64>`.
 *
 * The 32-byte key is derived from APP_ENCRYPTION_KEY env var via SHA-256. We
 * deliberately do NOT use a per-user key — losing APP_ENCRYPTION_KEY rotates
 * the entire user-settings table, and rotation is documented in DEPLOY.md.
 *
 * If APP_ENCRYPTION_KEY is unset we throw on encrypt + return null on decrypt,
 * so the BYOK feature simply stays disabled in misconfigured environments.
 */
function keyMaterial(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) return null;
  // SHA-256 normalizes whatever length the user supplies to exactly 32 bytes.
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptSecret(plaintext: string): string {
  const key = keyMaterial();
  if (!key) throw new Error('APP_ENCRYPTION_KEY not configured');
  const iv = randomBytes(12); // GCM standard nonce size
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decryptSecret(blob: string): string | null {
  const key = keyMaterial();
  if (!key) return null;
  const parts = blob.split(':');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const ct = Buffer.from(parts[2], 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch {
    return null;
  }
}
