import 'server-only';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

neonConfig.fetchConnectionCache = true;

let _db: NeonHttpDatabase<typeof schema> | null = null;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      '[db] DATABASE_URL is not set. Provision Neon via Vercel Marketplace and add the env var, then `npm run db:migrate`.'
    );
  }
  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

export const hasDb = () => !!process.env.DATABASE_URL;
