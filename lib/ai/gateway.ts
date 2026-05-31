import 'server-only';

import { getEffectiveAIKey } from './get-effective-key';

// Model ids. Provider-prefixed forms (anthropic/…, openai/…) are understood
// by the Vercel AI Gateway. A direct OpenAI/BYOK key only knows OpenAI ids,
// so for those sources we fall back to the effective key's default model.
export const AI_MODEL_FAST = 'openai/gpt-4o-mini';
export const AI_MODEL_CHAT = 'anthropic/claude-sonnet-4-6';
export const AI_MODEL_PREMIUM = 'anthropic/claude-opus-4-7';

export type AIGenerateOptions = {
  /** Whose key/endpoint to use (BYOK → gateway → OPENAI_API_KEY). */
  userId: string;
  model?: string;
  system?: string;
  prompt: string;
  /** Cap tokens for predictable cost. */
  maxOutputTokens?: number;
  /** 0 = deterministic; 0.7 = creative. */
  temperature?: number;
};

/** True when the user has any usable AI key (BYOK, gateway, or env). */
export async function aiAvailable(userId: string): Promise<boolean> {
  return !!(await getEffectiveAIKey(userId));
}

/**
 * Single-shot text generation against the user's effective AI endpoint via
 * the OpenAI-compatible /chat/completions API (works for BYOK OpenAI, the
 * Vercel AI Gateway, and OPENAI_API_KEY alike — no provider SDK needed).
 *
 * Throws if no key is configured — every call site handles that (typically
 * by surfacing "KI nicht konfiguriert").
 */
export async function aiGenerate(opts: AIGenerateOptions): Promise<string> {
  const key = await getEffectiveAIKey(opts.userId);
  if (!key) throw new Error('AI not configured (no key for user).');
  // Only the gateway understands provider-prefixed model ids; BYOK/OpenAI
  // get the effective default model instead.
  const model = key.source === 'gateway' ? opts.model ?? key.defaultModel : key.defaultModel;

  const res = await fetch(`${key.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key.apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
        { role: 'user', content: opts.prompt },
      ],
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxOutputTokens ?? 800,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

/**
 * Convenience: ask for a JSON object. Best-effort parse of a fenced/labelled
 * JSON block. Returns null on parse failure — caller decides retry/fallback.
 */
export async function aiGenerateJSON<T = unknown>(opts: AIGenerateOptions): Promise<T | null> {
  const text = await aiGenerate({ ...opts, temperature: opts.temperature ?? 0.4 });
  return tryParseJSON<T>(text);
}

function tryParseJSON<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^[^{[]*([{[])/s, '$1')
    .replace(/([}\]])[^}\]]*$/s, '$1');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
