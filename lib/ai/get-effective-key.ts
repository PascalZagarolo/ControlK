import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { decryptSecret } from '@/lib/auth/secret-encryption';

export type EffectiveAIKey = {
  apiKey: string;
  source: 'user-byok' | 'gateway' | 'openai-env';
  baseUrl: string;
  defaultModel: string;
};

/**
 * Resolves which API key + endpoint should be used for AI calls made on
 * behalf of `userId`.
 *
 * Priority:
 *   1. User-configured BYOK key (from user_settings) → direct OpenAI
 *   2. AI_GATEWAY_API_KEY env → Vercel AI Gateway
 *   3. OPENAI_API_KEY env → direct OpenAI
 *   4. null → no AI configured, caller must 503
 */
export async function getEffectiveAIKey(userId: string): Promise<EffectiveAIKey | null> {
  const db = getDb();
  const settings = await db.query.userSettings.findFirst({
    where: eq(s.userSettings.userId, userId),
    columns: { openaiKeyEnc: true, preferredAiModel: true },
  });
  if (settings?.openaiKeyEnc) {
    const apiKey = decryptSecret(settings.openaiKeyEnc);
    if (apiKey) {
      return {
        apiKey,
        source: 'user-byok',
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: settings.preferredAiModel ?? 'gpt-4o-mini',
      };
    }
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    return {
      apiKey: process.env.AI_GATEWAY_API_KEY,
      source: 'gateway',
      baseUrl: 'https://ai-gateway.vercel.sh/v1',
      defaultModel: process.env.NOTES_AI_MODEL ?? 'openai/gpt-4o-mini',
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      source: 'openai-env',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: process.env.NOTES_AI_MODEL ?? 'gpt-4o-mini',
    };
  }
  return null;
}
