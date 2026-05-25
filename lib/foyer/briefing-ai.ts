import 'server-only';

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { getEffectiveAIKey } from '@/lib/ai/get-effective-key';
import { aiGenerate, AI_MODEL_FAST, aiGatewayConfigured } from '@/lib/ai/gateway';
import { hashSignals, type BriefingSignals } from './briefing-signals';

// Soft TTL — the narrative can re-generate even when signals are
// stable, because phrasing can move with the time of day (e.g. an
// 11 AM briefing reads slightly differently from a 2 PM one).
const CACHE_TTL_MS = 60 * 60 * 1000;

export type BriefingResult = {
  narrative: string;
  generatedAt: string;
  fromCache: boolean;
  isFallback: boolean;
};

/**
 * Returns the current daily briefing for the user. Uses the cached
 * row when the signal hash + TTL allow; otherwise re-generates via
 * the AI gateway. Falls back to a deterministic one-liner when AI
 * is not configured at all.
 *
 * Costs ~$0.0001 per cache miss (gpt-4o-mini), so a user that hits
 * the foyer 5x/day with stable signals costs effectively zero.
 */
export async function getOrGenerateBriefing(input: {
  userId: string;
  workspaceId: string;
  signals: BriefingSignals;
}): Promise<BriefingResult> {
  const { userId, workspaceId, signals } = input;
  const db = getDb();
  const signalHash = hashSignals(signals);
  const now = new Date();

  // Cache lookup. We trust the hash for material invalidation; TTL
  // is the secondary check so morning/evening rewrites happen even
  // for users whose signals barely moved overnight.
  const cached = await db.query.userBriefings.findFirst({
    where: eq(s.userBriefings.userId, userId),
  });
  if (
    cached &&
    cached.signalHash === signalHash &&
    new Date(cached.expiresAt).getTime() > now.getTime()
  ) {
    return {
      narrative: cached.narrative,
      generatedAt: new Date(cached.generatedAt).toISOString(),
      fromCache: true,
      isFallback: false,
    };
  }

  // AI path. Prefer Vercel AI Gateway when configured (via env var);
  // fall back to user-BYOK / direct OpenAI through the legacy fetch.
  // No path → deterministic fallback so the slot still feels intentional.
  let narrative = '';
  let isFallback = false;

  if (aiGatewayConfigured()) {
    narrative = await callAIViaGateway(signals).catch(() => '');
  } else {
    const ai = await getEffectiveAIKey(userId).catch(() => null);
    if (ai) narrative = await callAI(ai, signals).catch(() => '');
  }
  if (!narrative) {
    narrative = deterministicFallback(signals);
    isFallback = true;
  }

  // Persist — even fallback narratives go through the cache so we
  // don't re-compute the same fallback every render.
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  await db
    .insert(s.userBriefings)
    .values({
      userId,
      workspaceId,
      narrative,
      signalHash,
      generatedAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: s.userBriefings.userId,
      set: {
        workspaceId,
        narrative,
        signalHash,
        generatedAt: now,
        expiresAt,
      },
    });

  return {
    narrative,
    generatedAt: now.toISOString(),
    fromCache: false,
    isFallback,
  };
}

const SYSTEM_PROMPT = `Du bist Pascals Briefing-Assistent. Du fasst aktuelle Workspace-Signale in 2-3 prägnante deutsche Sätze (max. 350 Zeichen) zusammen.

Stil:
- Ruhig, sachlich, direkt — kein Marketing-Sprech.
- KEINE Aufzählungen, KEIN Bulleted-List. Fließtext.
- Priorisiere nach Dringlichkeit: überfällige Antworten zuerst, dann Termine, dann Todos.
- Wenn nichts dringend ist: sag das.
- Niemals erfinden — wenn ein Signal fehlt, ignoriere es.
- Schreibe an Pascal in der Du-Form.`;

async function callAIViaGateway(signals: BriefingSignals): Promise<string> {
  const userPrompt = buildUserPrompt(signals);
  const raw = await aiGenerate({
    model: process.env.BRIEFING_MODEL ?? AI_MODEL_FAST,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens: 180,
    temperature: 0.5,
  });
  return cleanNarrative(raw.trim());
}

async function callAI(
  ai: NonNullable<Awaited<ReturnType<typeof getEffectiveAIKey>>>,
  signals: BriefingSignals
): Promise<string> {
  const userPrompt = buildUserPrompt(signals);
  const res = await fetch(`${ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ai.apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.BRIEFING_MODEL ?? ai.defaultModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      // ~350 chars = ~100 tokens; cap at 180 for headroom on
      // models that get verbose.
      max_tokens: 180,
      temperature: 0.5,
    }),
    cache: 'no-store',
  });
  if (!res.ok) return '';
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? '';
  return cleanNarrative(raw);
}

function buildUserPrompt(s: BriefingSignals): string {
  const lines: string[] = [];
  lines.push(`Heute: ${s.todayLabel}, ${germanTimeOfDay(s.timeOfDay)}.`);

  if (s.awaitingFromOthers.length > 0) {
    lines.push('');
    lines.push('Auf dich warten:');
    for (const a of s.awaitingFromOthers) {
      lines.push(
        `- ${a.name}${a.subject ? ` ("${a.subject.slice(0, 60)}")` : ''} seit ${a.daysOld} Tag${a.daysOld === 1 ? '' : 'en'}`
      );
    }
  }

  if (s.awaitingFromYou.length > 0) {
    lines.push('');
    lines.push('Du wartest auf Antwort von:');
    for (const a of s.awaitingFromYou) {
      lines.push(
        `- ${a.name}${a.subject ? ` ("${a.subject.slice(0, 60)}")` : ''} seit ${a.daysOld} Tag${a.daysOld === 1 ? '' : 'en'}`
      );
    }
  }

  if (s.todayEvents.length > 0) {
    lines.push('');
    lines.push('Heute Termine:');
    for (const e of s.todayEvents) lines.push(`- ${e.time} ${e.title}`);
  }

  if (s.overdueTodos.length > 0) {
    lines.push('');
    lines.push('Überfällige Todos:');
    for (const t of s.overdueTodos) lines.push(`- ${t.title}`);
  } else if (s.dueTodayTodos > 0) {
    lines.push('');
    lines.push(`${s.dueTodayTodos} Todo${s.dueTodayTodos === 1 ? '' : 's'} heute fällig.`);
  }

  lines.push('');
  lines.push('Schreibe jetzt das Briefing.');
  return lines.join('\n');
}

function germanTimeOfDay(t: BriefingSignals['timeOfDay']): string {
  return t === 'morning' ? 'Morgen' : t === 'afternoon' ? 'Nachmittag' : 'Abend';
}

function cleanNarrative(raw: string): string {
  // Strip wrapping quotes and any bulleted output the model sometimes
  // produces despite the prompt. Cap to ~400 chars hard.
  let out = raw.replace(/^[\s"'`*]+|[\s"'`*]+$/g, '').trim();
  out = out.replace(/^[-*•]\s+/gm, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ');
  if (out.length > 400) out = out.slice(0, 397) + '…';
  return out;
}

function deterministicFallback(s: BriefingSignals): string {
  // Pure derived sentence when AI isn't available. Keeps the slot
  // useful even on misconfigured deployments.
  const parts: string[] = [];
  if (s.awaitingFromOthers.length > 0) {
    parts.push(
      `${s.awaitingFromOthers.length} ungelesen` +
        (s.awaitingFromOthers[0]
          ? ` — am ältesten ${s.awaitingFromOthers[0].name} seit ${s.awaitingFromOthers[0].daysOld}d`
          : '')
    );
  }
  if (s.todayEvents.length > 0) {
    parts.push(
      `Heute ${s.todayEvents.length} Termin${s.todayEvents.length === 1 ? '' : 'e'} ab ${s.todayEvents[0].time}`
    );
  }
  if (s.overdueTodos.length > 0) {
    parts.push(`${s.overdueTodos.length} überfällige Todo${s.overdueTodos.length === 1 ? '' : 's'}`);
  } else if (s.dueTodayTodos > 0) {
    parts.push(`${s.dueTodayTodos} Todo${s.dueTodayTodos === 1 ? '' : 's'} heute fällig`);
  }
  if (parts.length === 0) {
    return 'Nichts Drängendes. Heute ist offen.';
  }
  return parts.join(' · ') + '.';
}
