// ─── Stufe 1 — deterministic pre-filter (pure, no AI, cost-saving) ───
//
// Not every sent mail contains a promise. These cheap checks drop the
// obvious non-candidates BEFORE the paid AI step. Pure + unit-tested.
//
// `isNewsletterLike` lives here (moved out of the server-only
// commitment-extract.ts so it's testable); commitment-extract.ts
// re-exports it, so existing importers keep working unchanged.

// Newsletter / transactional / no-reply markers. A real personal mail
// almost never carries these — so on SENT mail this filter is high-
// precision. We skip such mails entirely (no AI call, no commitments):
// a bulk send isn't a promise.
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
 * True when a mail looks like a newsletter / automated / no-reply send
 * rather than genuine 1:1 correspondence. Caller skips extraction.
 */
export function isNewsletterLike(mail: {
  to: string | null;
  subject: string | null;
  body: string;
}): boolean {
  const to = (mail.to ?? '').toLowerCase();
  if (/no[-_.]?reply|do[-_.]?not[-_.]?reply|newsletter|mailer|notifications?@/.test(to)) return true;
  const hay = `${mail.subject ?? ''}\n${mail.body}`;
  let hits = 0;
  for (const re of NEWSLETTER_MARKERS) if (re.test(hay)) hits += 1;
  // Two independent markers → confidently a bulk/automated mail. One alone
  // (e.g. a lone "Impressum" in a signature) isn't enough to discard.
  return hits >= 2;
}

// Minimum meaningful characters / words for a send to be worth an AI call.
const MIN_MEANINGFUL_CHARS = 15;
const MIN_MEANINGFUL_WORDS = 3;

/**
 * Strips quoted reply text, common reply/forward headers and a trailing
 * signature, leaving (roughly) only what the user actually wrote in THIS
 * message. Used by `isLowSignalSend`.
 */
export function ownWrittenText(body: string): string {
  if (!body) return '';
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    // Quoted previous message.
    if (line.startsWith('>')) continue;
    // Reply/forward attribution headers (DE + EN + Outlook field labels).
    if (/^am .+ schrieb .+:/i.test(line)) break;
    if (/^on .+ wrote:/i.test(line)) break;
    if (/^-{2,}\s*(original message|ursprüngliche nachricht|forwarded message|weitergeleitete nachricht)/i.test(line)) break;
    if (/^(von|gesendet|an|betreff|from|sent|to|subject):/i.test(line)) break;
    // Signature delimiter "-- " ends the meaningful body.
    if (line === '--' || line === '-- ') break;
    kept.push(line);
  }
  return kept.join('\n').trim();
}

/**
 * True for sends that carry too little of the user's own text to plausibly
 * contain a promise: pure forwards/quotes with no new text, one-word
 * acknowledgements ("Danke!", "Ok", "👍"), empty bodies. Deterministic,
 * pure — saves an AI call. Newsletters are handled by `isNewsletterLike`.
 */
export function isLowSignalSend(body: string): boolean {
  const own = ownWrittenText(body);
  if (own.length < MIN_MEANINGFUL_CHARS) return true;
  const words = own.split(/\s+/).filter((w) => /[a-zäöüß0-9]/i.test(w));
  if (words.length < MIN_MEANINGFUL_WORDS) return true;
  return false;
}

/**
 * Combined Stufe-1 gate: true when a sent mail should NOT go to the AI
 * extractor (newsletter/automated OR too little own text). Single call
 * site for scanner + dry-run + eval so they stay in lock-step.
 */
export function shouldSkipExtraction(mail: {
  to: string | null;
  subject: string | null;
  body: string;
}): boolean {
  if (!mail.body || !mail.body.trim()) return true;
  if (isNewsletterLike(mail)) return true;
  if (isLowSignalSend(mail.body)) return true;
  return false;
}
