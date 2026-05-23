import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;
const SALT_LEN = 16;
const COST = 16384; // 2^14, OWASP recommended scrypt N
const BLOCK_SIZE = 8;
const PARALLEL = 1;

/**
 * Hashes a password using scrypt (Node native, no external deps).
 * Format: "scrypt:$salt(base64)$derived(base64)"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = (await scryptAsync(password.normalize('NFKC'), salt, KEY_LEN, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLEL,
  })) as Buffer;
  return `scrypt:${salt.toString('base64')}:${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'base64');
  const expected = Buffer.from(parts[2], 'base64');
  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
  const actual = (await scryptAsync(password.normalize('NFKC'), salt, KEY_LEN, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLEL,
  })) as Buffer;
  return timingSafeEqual(actual, expected);
}
