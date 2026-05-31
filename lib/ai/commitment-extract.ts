import 'server-only';

import { aiGenerateJSON, AI_MODEL_FAST } from '@/lib/ai/gateway';

/**
 * Single source of truth for commitment extraction. BOTH the production
 * scanner and the Schritt-0 validation harness call this — otherwise the
 * validation would measure a different prompt than the one that ships, and
 * the test would be worthless.
 *
 * Beyond the promise + deadline, we now also pull:
 *  - `quote`: the verbatim source sentence → powers "warum ist das hier" /
 *    explainability (Trust-UX). Never paraphrased.
 *  - `confidence`: high/medium/low → drives the threshold. Only `high` may be
 *    shown as a hard "fällig"; lower must be framed as "mögliche Zusage?".
 */
export type CommitmentConfidence = 'high' | 'medium' | 'low';

export type CommitmentCandidate = {
  promise: string;
  dueIso: string | null;
  quote: string;
  confidence: CommitmentConfidence;
};

export type MailForExtraction = {
  /** ISO date of the sent mail — anchors relative deadlines ("bis Freitag"). */
  dateIso: string;
  to: string | null;
  subject: string | null;
  body: string;
};

// Newsletter / transactional / no-reply markers. A real personal mail almost
// never carries these — so on SENT mail this filter is high-precision. We skip
// such mails entirely (no AI call, no commitments): a bulk send isn't a promise.
const NEWSLETTER_MARKERS: RegExp[] = [
  /unsubscribe/i,
  /abmelden|vom newsletter|newsletter abbestellen/i,
  /view (this )?(e-?mail )?in (your )?browser|im browser (an)?(zeigen|sehen)/i,
  /you('?re| are) receiving this (e-?mail|message)/i,
  /diese (e-?mail|nachricht) wurde automatisch/i,
  /\bno[-_.\s]?reply\b|\bdo[-_.\s]?not[-_.\s]?reply\b/i,
  /privacy policy|datenschutzerklärung|impressum/i,
];

/**
 * Cheap pre-filter: true when a mail looks like a newsletter / automated /
 * no-reply send rather than genuine 1:1 correspondence. Caller should skip
 * extraction for these.
 */
export function isNewsletterLike(mail: { to: string | null; subject: string | null; body: string }): boolean {
  const to = (mail.to ?? '').toLowerCase();
  if (/no[-_.]?reply|do[-_.]?not[-_.]?reply|newsletter|mailer|notifications?@/.test(to)) return true;
  const hay = `${mail.subject ?? ''}\n${mail.body}`;
  let hits = 0;
  for (const re of NEWSLETTER_MARKERS) if (re.test(hay)) hits += 1;
  // Two independent markers → confidently a bulk/automated mail. One alone
  // (e.g. a lone "Impressum" in a signature) isn't enough to discard.
  return hits >= 2;
}

const SYSTEM_PROMPT =
  'Du extrahierst aus einer vom Nutzer GESENDETEN E-Mail verbindliche Zusagen, die DER ' +
  'NUTZER selbst gemacht hat — Dinge, die er liefern/erledigen wird. Sei STRENG: lieber ' +
  'eine Zusage weglassen als eine erfinden. Höflichkeitsfloskeln ("melde mich bald", "schönes ' +
  'Wochenende"), Fragen, Konjunktive ("könnte", "vielleicht") und Aussagen über das, was ANDERE ' +
  'tun sollen, sind KEINE Zusagen.\n\n' +
  'Antworte NUR mit JSON: { "commitments": [{ ' +
  '"promise": string (kurz, z.B. "Angebot schicken"), ' +
  '"quote": string (der WÖRTLICHE Satz aus der Mail, der die Zusage belegt — nicht umschreiben), ' +
  '"dueIso": string|null (ISO-Datum wenn eine Frist genannt ist; relative wie "bis Freitag/morgen" ' +
  'relativ zum Mail-Datum auflösen, sonst null), ' +
  '"confidence": "high"|"medium"|"low" (high = explizite, eindeutige Zusage mit klarem Liefergegenstand; ' +
  'medium = wahrscheinlich, aber unscharf; low = vage Andeutung) }] }. ' +
  'Leeres Array wenn keine echte eigene Zusage vorkommt.';

const CONF = new Set<CommitmentConfidence>(['high', 'medium', 'low']);

/**
 * Runs extraction against the user's effective AI endpoint. Throws on
 * transient AI errors (429/timeout) so callers can stop/retry — never
 * swallows them into a false "nothing found".
 */
export async function extractCommitmentsFromMail(
  userId: string,
  mail: MailForExtraction
): Promise<CommitmentCandidate[]> {
  const parsed = await aiGenerateJSON<{
    commitments?: Array<{
      promise?: string;
      quote?: string;
      dueIso?: string | null;
      confidence?: string;
    }>;
  }>({
    userId,
    model: AI_MODEL_FAST,
    maxOutputTokens: 600,
    system: SYSTEM_PROMPT,
    prompt:
      `Mail-Datum: ${mail.dateIso}\n` +
      `An: ${mail.to ?? '(unbekannt)'}\n` +
      `Betreff: ${mail.subject ?? ''}\n\n` +
      `Text:\n${mail.body.slice(0, 4000)}`,
  });

  return (parsed?.commitments ?? [])
    .filter((c) => c?.promise?.trim())
    .slice(0, 5)
    .map((c) => {
      const conf = (c.confidence ?? '').toLowerCase();
      const due = c.dueIso ? new Date(c.dueIso) : null;
      return {
        promise: c.promise!.trim().slice(0, 400),
        quote: (c.quote ?? '').trim().slice(0, 600),
        dueIso: due && !Number.isNaN(due.getTime()) ? due.toISOString() : null,
        confidence: (CONF.has(conf as CommitmentConfidence)
          ? conf
          : 'medium') as CommitmentConfidence,
      };
    });
}
