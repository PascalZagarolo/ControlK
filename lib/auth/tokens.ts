import { createHash, randomBytes } from 'node:crypto';

/**
 * Generates a URL-safe 32-byte token + its SHA-256 hex digest.
 * - The plaintext goes into the email link / cookie.
 * - The hash goes into the DB. A read-only DB leak yields no valid tokens.
 */
export function generateToken(): { plain: string; hash: string } {
  const buf = randomBytes(32);
  const plain = buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { plain, hash: hashToken(plain) };
}

export function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export function newUserId(): string {
  return 'usr_' + randomBytes(16).toString('hex');
}
