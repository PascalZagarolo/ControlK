import 'server-only';

import { generateText } from 'ai';

// Vercel AI Gateway model strings. Format: `provider/model-id`.
// Routing is handled by the gateway when AI_GATEWAY_API_KEY is set —
// no provider-specific package install needed.
//
// Defaults chosen for use-case fit, not "biggest model":
//   - FAST  : per-domain classification, status tags, summary chips.
//             Cheap + fast wins; gpt-4o-mini is dialled in for this.
//   - CHAT  : multi-paragraph reasoning (briefing narrative, follow-up
//             drafts). Sonnet 4.6 is the latest balanced Claude model.
//   - PREMIUM: anything that needs slow, careful reasoning. Reserved.
//
// Overrideable per call site if a surface has a strong reason; default
// stays in this file so cost decisions are reviewable.
// Anthropic model IDs follow the hyphenated convention (claude-sonnet-4-6),
// not dotted. Vercel AI Gateway expects `provider/exact-model-id`.
export const AI_MODEL_FAST = 'openai/gpt-4o-mini';
export const AI_MODEL_CHAT = 'anthropic/claude-sonnet-4-6';
export const AI_MODEL_PREMIUM = 'anthropic/claude-opus-4-7';

export type AIGenerateOptions = {
  model?: string;
  system?: string;
  prompt: string;
  /** Cap tokens for predictable cost. */
  maxOutputTokens?: number;
  /** 0 = deterministic; 0.7 = creative. */
  temperature?: number;
};

export function aiGatewayConfigured(): boolean {
  return !!process.env.AI_GATEWAY_API_KEY;
}

/**
 * Single-shot text generation through Vercel AI Gateway. Reads
 * AI_GATEWAY_API_KEY automatically from env — the AI SDK picks it up.
 *
 * Returns the raw text. Caller does parsing / shape validation.
 *
 * Throws if AI_GATEWAY_API_KEY is missing — every call site must
 * handle that case (typically by falling back to a deterministic
 * heuristic). We deliberately don't silent-fail: an AI feature that
 * silently returns empty strings is worse than a loud 503.
 */
export async function aiGenerate(opts: AIGenerateOptions): Promise<string> {
  if (!aiGatewayConfigured()) {
    throw new Error('AI Gateway not configured (AI_GATEWAY_API_KEY missing).');
  }
  const { text } = await generateText({
    model: opts.model ?? AI_MODEL_CHAT,
    system: opts.system,
    prompt: opts.prompt,
    maxOutputTokens: opts.maxOutputTokens,
    temperature: opts.temperature ?? 0.7,
  });
  return text;
}

/**
 * Convenience: ask for a JSON object. Parses with a best-effort
 * regex-extracted JSON block so a chatty model that wraps the JSON
 * in fences still works. Returns null on parse failure — caller
 * decides whether to retry or fall back.
 */
export async function aiGenerateJSON<T = unknown>(
  opts: AIGenerateOptions
): Promise<T | null> {
  const text = await aiGenerate({
    ...opts,
    // Lower temperature for structured output — we want valid JSON,
    // not creative reinterpretations of "subject" and "body".
    temperature: opts.temperature ?? 0.4,
  });
  return tryParseJSON<T>(text);
}

function tryParseJSON<T>(raw: string): T | null {
  // Strip code fences and leading prose if the model added any.
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
