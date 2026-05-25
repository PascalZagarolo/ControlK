'use server';

import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { AI_MODEL_CHAT, aiGenerateJSON, aiGatewayConfigured } from '@/lib/ai/gateway';

export type FollowUpDraft = { subject: string; body: string };
type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// In-memory rate-limit guard. Per serverless instance, so it's not
// airtight across regions but cuts the burst case (user clicks
// regenerate 10× in 30s) which is what matters for cost. A proper
// distributed limit (Upstash, DB row) is V2.
const RATE_BUCKETS = new Map<string, { tokens: number; resetAt: number }>();
const RATE_TOKENS_PER_DAY = 30;
const COOLDOWN_MS = 4_000; // min gap between two drafts for same threshold
const RECENT_CALLS = new Map<string, number>(); // thresholdId → last call ms

function takeBudgetToken(userId: string): boolean {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(userId);
  if (!bucket || bucket.resetAt < now) {
    RATE_BUCKETS.set(userId, {
      tokens: RATE_TOKENS_PER_DAY - 1,
      resetAt: now + 24 * 60 * 60_000,
    });
    return true;
  }
  if (bucket.tokens <= 0) return false;
  bucket.tokens -= 1;
  return true;
}

function checkCooldown(thresholdId: string): boolean {
  const now = Date.now();
  const last = RECENT_CALLS.get(thresholdId) ?? 0;
  if (now - last < COOLDOWN_MS) return false;
  RECENT_CALLS.set(thresholdId, now);
  return true;
}

/**
 * Generates a follow-up email draft for an entity in standstill.
 * Gathers recent activity context (last subjects, last meeting titles),
 * builds a prompt, calls the AI Gateway (Sonnet by default), parses
 * JSON. Caller renders the draft in a modal; user owns sending.
 *
 * Hard guarded: requires the entity to be a person and the user to be
 * authorized on the threshold row.
 */
export async function generateFollowUpDraft(
  thresholdId: string
): Promise<Result<{ draft: FollowUpDraft }>> {
  const user = await requireUser();

  if (!aiGatewayConfigured()) {
    return {
      ok: false,
      error: 'AI Gateway nicht konfiguriert (AI_GATEWAY_API_KEY fehlt).',
    };
  }

  const db = getDb();
  const t = await db.query.entityThresholds.findFirst({
    where: and(
      eq(s.entityThresholds.id, thresholdId),
      eq(s.entityThresholds.userId, user.id)
    ),
  });
  if (!t) return { ok: false, error: 'Entität nicht gefunden.' };
  if (t.entityType !== 'person') {
    return {
      ok: false,
      error: 'AI-Drafts nur für Personen — Channels öffnest du direkt.',
    };
  }

  if (!takeBudgetToken(user.id)) {
    return {
      ok: false,
      error: 'Tageslimit für AI-Drafts erreicht (30). Komm morgen wieder.',
    };
  }
  if (!checkCooldown(thresholdId)) {
    return {
      ok: false,
      error: 'Zu schnell hintereinander. Warte 4 Sekunden.',
    };
  }

  // Context: recent activity touches with this person, plus the user's
  // first name so the draft sounds like them. We don't currently load
  // raw email bodies / meeting recaps — that's a Phase 4c upgrade once
  // we trust the prompt quality.
  const recentTouches = await db
    .select({
      activityKind: s.activityLog.activityKind,
      occurredAt: s.activityLog.occurredAt,
      sourceType: s.activityLog.sourceType,
      sourceId: s.activityLog.sourceId,
    })
    .from(s.activityLog)
    .where(
      and(
        eq(s.activityLog.userId, user.id),
        eq(s.activityLog.entityType, 'person'),
        eq(s.activityLog.entityId, t.entityId)
      )
    )
    .orderBy(desc(s.activityLog.occurredAt))
    .limit(5);

  // Pull subject lines from the latest inbox touches (if any) so the
  // model has a hint about WHAT the conversation was last about.
  const inboxSourceIds = recentTouches
    .filter((r) => r.sourceType === 'inbox_item' && r.sourceId)
    .map((r) => r.sourceId!) as string[];
  const lastSubjects: string[] = [];
  if (inboxSourceIds.length > 0) {
    const rows = await db.query.inboxItems.findMany({
      where: (cols, { inArray }) => inArray(cols.id, inboxSourceIds),
      columns: { subject: true, receivedAt: true },
      orderBy: (cols, { desc }) => [desc(cols.receivedAt)],
      limit: 3,
    });
    for (const r of rows) {
      if (r.subject && r.subject.trim()) lastSubjects.push(r.subject.trim());
    }
  }

  // Meeting titles from calendar touches.
  const eventSourceIds = recentTouches
    .filter((r) => r.sourceType === 'calendar_event' && r.sourceId)
    .map((r) => r.sourceId!) as string[];
  const lastMeetings: string[] = [];
  if (eventSourceIds.length > 0) {
    const rows = await db.query.externalCalendarEvents.findMany({
      where: (cols, { inArray }) => inArray(cols.id, eventSourceIds),
      columns: { title: true, startAt: true },
      orderBy: (cols, { desc }) => [desc(cols.startAt)],
      limit: 3,
    });
    for (const r of rows) {
      if (r.title && r.title.trim()) lastMeetings.push(r.title.trim());
    }
  }

  const daysSilent = t.lastInteractionAt
    ? Math.round(
        (Date.now() - t.lastInteractionAt.getTime()) / 86_400_000
      )
    : 0;
  const myFirstName = user.name.split(/\s+/)[0] || user.name;

  const system = `Du hilfst ${myFirstName}, eine kurze, ehrliche Nachfass-Email zu schreiben. Auf Deutsch.

Regeln:
- 2-4 Sätze im Body. Knapp.
- KEIN "sorry, ist lange her" oder ähnliche Entschuldigungsfloskeln.
- KEIN Verkaufston, keine Floskeln wie "ich hoffe, es geht dir gut".
- Wenn ein konkreter Kontext (Vertragsthema, Projekt, letzter Termin) erkennbar ist: kurz darauf Bezug nehmen. Sonst neutral.
- Du-Form, locker aber professionell.
- Antworte AUSSCHLIESSLICH als valides JSON: {"subject": "…", "body": "…"}. Kein Markdown, keine Code-Fences, kein Vorgeplänkel.`;

  const contextBlock = [
    `Person: ${t.entityDisplayName} (${t.entityId})`,
    `Tage ohne Kontakt: ${daysSilent}`,
    t.medianDaysBetween
      ? `Üblicher Rhythmus: alle ~${Math.round(t.medianDaysBetween)} Tage`
      : null,
    lastSubjects.length > 0
      ? `Letzte Email-Betreffe:\n${lastSubjects.map((s) => `- ${s}`).join('\n')}`
      : null,
    lastMeetings.length > 0
      ? `Letzte Termine:\n${lastMeetings.map((s) => `- ${s}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const prompt = `${contextBlock}\n\nSchreibe jetzt die Nachfass-Email als JSON.`;

  const draft = await aiGenerateJSON<FollowUpDraft>({
    model: AI_MODEL_CHAT,
    system,
    prompt,
    maxOutputTokens: 600,
    temperature: 0.6,
  });

  if (!draft || typeof draft.subject !== 'string' || typeof draft.body !== 'string') {
    return {
      ok: false,
      error: 'AI hat kein gültiges JSON zurückgegeben. Versuch nochmal.',
    };
  }
  // Last sanity trim — don't let the AI sneak in newlines in subject.
  return {
    ok: true,
    draft: {
      subject: draft.subject.trim().replace(/\s+/g, ' ').slice(0, 200),
      body: draft.body.trim(),
    },
  };
}
