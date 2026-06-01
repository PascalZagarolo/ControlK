'use server';

import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { aiGenerate, aiGenerateJSON, aiAvailable, AI_MODEL_CHAT, AI_MODEL_FAST } from '@/lib/ai/gateway';
import { getAwaitingSplit, getInboxRangeItems, type InboxRange } from '@/lib/db/queries/inbox-overview';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

type EmailInput = { subject?: string | null; from?: string | null; bodyText?: string | null };

/**
 * Natural-language synthesis of a time bucket ("Heute" / "Diese Woche"):
 * what arrived, who, what stands out — e.g. "Vier Kunden haben sich gemeldet.
 * Dein DHL-Paket kommt heute." Grounded in subjects/previews + categories.
 */
export async function inboxRangeDigest(
  range: InboxRange
): Promise<Result<{ digest: string; count: number }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  const items = await getInboxRangeItems(ws.id, user.id, range);
  if (items.length === 0) {
    return {
      ok: true,
      count: 0,
      digest: range === 'today' ? 'Heute ist noch nichts angekommen.' : 'Diese Woche bisher nichts.',
    };
  }

  const byCat: Record<string, number> = {};
  for (const it of items) byCat[it.category] = (byCat[it.category] ?? 0) + 1;
  const catLine = Object.entries(byCat)
    .map(([c, n]) => `${n}× ${c}`)
    .join(', ');
  const lines = items
    .slice(0, 40)
    .map((it) => `- [${it.category}] ${it.senderName}: ${it.subject ?? '(kein Betreff)'}${it.preview ? ` — ${it.preview.slice(0, 120)}` : ''}`);

  try {
    const digest = await aiGenerate({
      userId: user.id,
      model: AI_MODEL_FAST,
      maxOutputTokens: 220,
      temperature: 0.4,
      system:
        `Du fasst den Posteingang ${range === 'today' ? 'von heute' : 'dieser Woche'} in 2-3 ` +
        'kurzen deutschen Sätzen zusammen. Sag konkret, wie viele Kunden sich gemeldet haben, ' +
        'und hebe einzelne wichtige Mails hervor (z.B. Versand/Pakete mit Lieferdatum wie „Dein ' +
        'DHL-Paket kommt heute", Rechnungen, Termine). Promos/Social nur erwähnen wenn relevant. ' +
        'Fließtext, kein Vorwort, keine Aufzählung.',
      prompt: `Kategorien: ${catLine}\n\nNachrichten:\n${lines.join('\n')}`,
    });
    return { ok: true, count: items.length, digest: digest.trim() || 'Nichts Auffälliges.' };
  } catch (e) {
    console.error('[inbox-ai] range digest failed', e);
    return { ok: false, error: 'Zusammenfassung fehlgeschlagen.' };
  }
}

/**
 * A 2-3 sentence "morning briefing" for the inbox: what needs a reply and
 * which of your own threads have gone unanswered too long. Grounded in the
 * awaiting-split (no email bodies fetched), so it's cheap.
 */
export async function inboxDigest(): Promise<Result<{ digest: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  const split = await getAwaitingSplit(ws.id, user.id);
  const needsReply = split.onYou
    .slice(0, 10)
    .map((r) => `- ${r.senderName}: ${r.subject ?? '(kein Betreff)'} (vor ${r.ageDays}d)`);
  const overdue = split.onThem
    .filter((r) => r.ageDays >= 3)
    .slice(0, 10)
    .map(
      (r) =>
        `- an ${r.awaitingRecipient ?? r.senderName}: ${r.subject ?? '(kein Betreff)'} (seit ${r.ageDays}d keine Antwort)`
    );

  if (needsReply.length === 0 && overdue.length === 0) {
    return { ok: true, digest: 'Dein Posteingang ist ruhig — nichts wartet auf eine Antwort.' };
  }

  try {
    const digest = await aiGenerate({
      userId: user.id,
      model: AI_MODEL_FAST,
      maxOutputTokens: 220,
      temperature: 0.4,
      system:
        'Du bist ein knapper Posteingang-Assistent. Schreibe ein Morgen-Briefing in 2-3 Sätzen ' +
        'auf Deutsch: was heute am dringendsten eine Antwort braucht und welche eigenen Threads ' +
        'überfällig sind. Konkret mit Namen, keine Aufzählung, kein Vorwort.',
      prompt:
        `Braucht deine Antwort:\n${needsReply.join('\n') || '(nichts)'}\n\n` +
        `Du wartest überfällig auf:\n${overdue.join('\n') || '(nichts)'}`,
    });
    return { ok: true, digest: digest.trim() || 'Heute nichts Dringendes im Posteingang.' };
  } catch (e) {
    console.error('[inbox-ai] digest failed', e);
    return { ok: false, error: 'Briefing fehlgeschlagen.' };
  }
}

function context(input: EmailInput): string {
  const body = (input.bodyText ?? '').slice(0, 4000);
  return (
    `Betreff: ${input.subject || '(kein Betreff)'}\n` +
    `Von: ${input.from || '(unbekannt)'}\n\n` +
    `Inhalt:\n${body || '(kein Textinhalt verfügbar)'}`
  );
}

/**
 * Drafts a German reply to an inbox email. The body text is passed in from
 * the client (it's fetched from Gmail at render time, not stored), so this
 * action never re-hits Gmail. Returns a draft for the user to edit/copy —
 * it does not send.
 */
export async function draftInboxReply(
  input: EmailInput & { instruction?: string }
): Promise<Result<{ draft: string }>> {
  const user = await requireUser();
  await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  try {
    const draft = await aiGenerate({
      userId: user.id,
      model: AI_MODEL_CHAT,
      maxOutputTokens: 500,
      temperature: 0.6,
      system:
        'Du schreibst eine professionelle, freundliche, knappe E-Mail-Antwort auf Deutsch. ' +
        'Gib NUR den E-Mail-Text zurück (Anrede bis Grußformel), keine Betreffzeile, keine Erklärung. ' +
        'Behalte den Ton der Eingangsmail bei (Sie/Du wie im Original).',
      prompt:
        context(input) +
        (input.instruction ? `\n\nZusätzliche Anweisung: ${input.instruction}` : '') +
        '\n\nSchreibe eine passende Antwort.',
    });
    return { ok: true, draft: draft.trim() };
  } catch (e) {
    console.error('[inbox-ai] draft failed', e);
    return { ok: false, error: 'Entwurf fehlgeschlagen.' };
  }
}

/**
 * A suggested action extracted from a mail (Mail→Todo C2). Each carries a
 * confidence + the verbatim mail sentence it was derived from — the same
 * trust contract as commitments (Prompt 3): high = assertion, medium/low =
 * question, and never a suggestion without a source reference.
 */
export type SuggestedAction = {
  title: string;
  confidence: 'high' | 'medium' | 'low';
  /** Verbatim sentence from the mail this action is grounded in (R1). */
  quote: string;
};

const ACTION_CONF = new Set(['high', 'medium', 'low']);

/**
 * Summarizes an inbox email into a one-paragraph gist plus concrete action
 * items (so the user can decide fast / turn items into todos). Each action
 * is confidence-graded and source-grounded so the UI can frame uncertain
 * ones as questions and show their evidence (trust unification, Prompt 6).
 */
export async function summarizeInboxEmail(
  input: EmailInput
): Promise<Result<{ summary: string; actions: SuggestedAction[] }>> {
  const user = await requireUser();
  await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  try {
    const parsed = await aiGenerateJSON<{
      summary?: string;
      actions?: Array<{ title?: string; confidence?: string; quote?: string } | string>;
    }>({
      userId: user.id,
      model: AI_MODEL_FAST,
      maxOutputTokens: 500,
      system:
        'Du fasst E-Mails auf Deutsch zusammen und schlägst konkrete Aufgaben für den ' +
        'EMPFÄNGER vor. Sei streng: lieber keine Aufgabe als eine erfundene. Antworte NUR ' +
        'mit JSON: { "summary": string (1-2 Sätze, worum es geht), "actions": [{ ' +
        '"title": string (kurze Aufgabe), "quote": string (der WÖRTLICHE Satz aus der Mail, ' +
        'der die Aufgabe belegt — PFLICHT, ohne Beleg keine Aufgabe), "confidence": ' +
        '"high"|"medium"|"low" (high = explizit erbeten/zugesagt; medium = wahrscheinlich; ' +
        'low = vage) }] (leer wenn keine echte Aufgabe) }.',
      prompt: context(input),
    });
    if (!parsed) return { ok: false, error: 'Zusammenfassung fehlgeschlagen.' };

    const haystack = (input.bodyText ?? '').toLowerCase().replace(/\s+/g, ' ');
    const actions: SuggestedAction[] = (Array.isArray(parsed.actions) ? parsed.actions : [])
      .map((a) => {
        // Tolerate the old string[] shape too, but those have no evidence →
        // they get dropped by the quote guard below (no hallucinated todos).
        if (typeof a === 'string') return { title: a.trim(), confidence: 'medium' as const, quote: '' };
        const conf = (a?.confidence ?? '').toLowerCase();
        return {
          title: (a?.title ?? '').trim(),
          confidence: (ACTION_CONF.has(conf) ? conf : 'medium') as SuggestedAction['confidence'],
          quote: (a?.quote ?? '').trim(),
        };
      })
      // Hallucination guard (R1): an action must have a title AND a verbatim
      // quote that actually occurs in the mail body. No source → not shown.
      .filter((a) => a.title.length > 0 && a.quote.length > 0)
      .filter((a) => !haystack || haystack.includes(a.quote.toLowerCase().replace(/\s+/g, ' ').slice(0, 50)))
      .slice(0, 6);

    return {
      ok: true,
      summary: (parsed.summary ?? '').trim() || 'Keine Zusammenfassung möglich.',
      actions,
    };
  } catch (e) {
    console.error('[inbox-ai] summarize failed', e);
    return { ok: false, error: 'Zusammenfassung fehlgeschlagen.' };
  }
}
