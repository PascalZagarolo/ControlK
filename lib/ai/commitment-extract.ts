import 'server-only';

import { aiGenerate, AI_MODEL_FAST } from '@/lib/ai/gateway';
import { parseCommitmentResponse } from '@/lib/commitments/parse';
import type {
  CommitmentCandidate,
  CommitmentConfidence,
  MailForExtraction,
} from '@/lib/commitments/types';

/**
 * Single source of truth for commitment extraction (Stufe 2). BOTH the
 * production scanner and the Schritt-0 validation harness call this —
 * otherwise validation would measure a different prompt than the one that
 * ships, and the test would be worthless.
 *
 * The heavy lifting (JSON parse, hallucination guard, confidence clamp,
 * relative-deadline resolution against the send date) lives in the pure,
 * unit-tested `lib/commitments/parse.ts`. This file is just the network
 * call + prompt. The pure types/prefilter are re-exported below so existing
 * importers of `@/lib/ai/commitment-extract` keep working unchanged.
 */
export type { CommitmentConfidence, CommitmentCandidate, MailForExtraction } from '@/lib/commitments/types';
export { isNewsletterLike, isLowSignalSend, shouldSkipExtraction } from '@/lib/commitments/prefilter';

// Re-exported so the prompt + JSON contract live next to each other; the
// eval suite asserts the contract against this exact string.
export const COMMITMENT_SYSTEM_PROMPT =
  'Du extrahierst aus einer vom Nutzer GESENDETEN E-Mail verbindliche Zusagen, die DER ' +
  'NUTZER (Absender) dem EMPFÄNGER gegeben hat — Dinge, die ER liefern/erledigen wird. ' +
  'NUR Zusagen des Absenders, NIEMALS was andere ihm versprochen haben. Sei STRENG: lieber ' +
  'eine Zusage weglassen als eine erfinden. Höflichkeitsfloskeln ("melde mich bald", "schönes ' +
  'Wochenende", "melde dich gern jederzeit"), Fragen, Konjunktive ("könnte", "vielleicht") und ' +
  'Aussagen über das, was ANDERE tun sollen, sind KEINE Zusagen.\n\n' +
  'Antworte AUSSCHLIESSLICH mit reinem JSON (kein Markdown, keine ```-Fences, kein Fließtext): ' +
  '{ "commitments": [{ ' +
  '"promise": string (kurz, eigene Worte, z.B. "Angebot schicken"), ' +
  '"quote": string (der WÖRTLICHE Satz aus der Mail, der die Zusage belegt — exakt kopieren, ' +
  'nicht umschreiben; PFLICHT, ohne Beleg keine Zusage), ' +
  '"dueBasis": string|null (die WÖRTLICHE Fristangabe aus der Mail, z.B. "bis Freitag", ' +
  '"nächste Woche", "morgen", "bis 15.03." — oder null wenn keine Frist genannt), ' +
  '"dueIso": string|null (ISO-Datum der Frist, relativ zum MAIL-SENDEDATUM aufgelöst; sonst null), ' +
  '"confidence": "high"|"medium"|"low" (high = explizite, eindeutige Zusage mit klarem ' +
  'Liefergegenstand; medium = wahrscheinlich, aber unscharf; low = vage Andeutung) }] }. ' +
  'Leeres Array { "commitments": [] } wenn keine echte eigene Zusage vorkommt.';

function buildUserPrompt(mail: MailForExtraction): string {
  return (
    `Mail-Sendedatum: ${mail.dateIso}\n` +
    `An: ${mail.to ?? '(unbekannt)'}\n` +
    `Betreff: ${mail.subject ?? ''}\n\n` +
    `Text:\n${mail.body.slice(0, 4000)}`
  );
}

/**
 * Runs extraction against the user's effective AI endpoint. Throws on
 * transient AI errors (429/timeout) so callers can stop/retry — never
 * swallows them into a false "nothing found". On a malformed (non-JSON)
 * response it returns [] ("keine Zusage erkannt"), never crashes.
 */
export async function extractCommitmentsFromMail(
  userId: string,
  mail: MailForExtraction
): Promise<CommitmentCandidate[]> {
  const raw = await aiGenerate({
    userId,
    model: AI_MODEL_FAST,
    maxOutputTokens: 700,
    temperature: 0.2,
    system: COMMITMENT_SYSTEM_PROMPT,
    prompt: buildUserPrompt(mail),
  });

  // All validation + the hallucination guard + deterministic deadline
  // resolution happen here (pure, tested). Parse failure → [].
  return parseCommitmentResponse(raw, { sendDateIso: mail.dateIso, body: mail.body });
}
