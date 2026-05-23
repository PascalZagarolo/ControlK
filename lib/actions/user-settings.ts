'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { encryptSecret, decryptSecret } from '@/lib/auth/secret-encryption';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const OPENAI_KEY_RE = /^sk-[a-zA-Z0-9_-]{20,}$/;

export async function setOpenAIKey(key: string, model?: string): Promise<Result> {
  const user = await requireUser();
  const trimmed = key.trim();
  if (!OPENAI_KEY_RE.test(trimmed)) {
    return { ok: false, error: 'Sieht nicht nach einem OpenAI-Key aus (Format sk-…).' };
  }
  if (!process.env.APP_ENCRYPTION_KEY) {
    return {
      ok: false,
      error:
        'BYOK ist nicht konfiguriert — APP_ENCRYPTION_KEY env var fehlt auf dem Server.',
    };
  }
  // Validate key reaches the OpenAI API. We don't trust the user's "they
  // typed something starting with sk-" — actually ping /v1/models.
  try {
    const probe = await fetch('https://api.openai.com/v1/models?limit=1', {
      headers: { authorization: `Bearer ${trimmed}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (probe.status === 401) {
      return { ok: false, error: 'OpenAI lehnt diesen Key ab (401).' };
    }
    if (!probe.ok) {
      return { ok: false, error: `OpenAI antwortet mit ${probe.status}.` };
    }
  } catch (e: any) {
    return {
      ok: false,
      error: `Konnte den Key nicht prüfen: ${e?.message ?? 'network-error'}`,
    };
  }

  const enc = encryptSecret(trimmed);
  const db = getDb();
  await db
    .insert(s.userSettings)
    .values({
      userId: user.id,
      openaiKeyEnc: enc,
      preferredAiModel: model?.trim() || null,
    })
    .onConflictDoUpdate({
      target: s.userSettings.userId,
      set: {
        openaiKeyEnc: enc,
        preferredAiModel: model?.trim() || null,
        updatedAt: new Date(),
      },
    });
  revalidatePath('/settings/ai');
  return { ok: true };
}

export async function clearOpenAIKey(): Promise<Result> {
  const user = await requireUser();
  const db = getDb();
  await db
    .update(s.userSettings)
    .set({ openaiKeyEnc: null, updatedAt: new Date() })
    .where(eq(s.userSettings.userId, user.id));
  revalidatePath('/settings/ai');
  return { ok: true };
}

/**
 * Read-only summary for the settings UI. Never returns the plaintext key —
 * just whether one is configured and which model the user prefers. The
 * actual key only ever flows server-side via getEffectiveAIKey.
 */
export async function getAISettingsSummary(): Promise<{
  hasUserKey: boolean;
  preferredModel: string | null;
  serverKeyConfigured: boolean;
  encryptionConfigured: boolean;
}> {
  const user = await requireUser();
  const db = getDb();
  const row = await db.query.userSettings.findFirst({
    where: eq(s.userSettings.userId, user.id),
    columns: { openaiKeyEnc: true, preferredAiModel: true },
  });
  return {
    hasUserKey: !!row?.openaiKeyEnc && !!decryptSecret(row.openaiKeyEnc),
    preferredModel: row?.preferredAiModel ?? null,
    serverKeyConfigured: !!(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY),
    encryptionConfigured: !!process.env.APP_ENCRYPTION_KEY,
  };
}
