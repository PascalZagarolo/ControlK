'use server';

import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { aiAvailable, isTransientAIError } from '@/lib/ai/gateway';
import { extractCommitmentsFromMail, isNewsletterLike, type CommitmentCandidate } from '@/lib/ai/commitment-extract';
import { getValidGoogleAccessToken } from '@/lib/auth/google-tokens';
import { getFullMessage } from '@/lib/google/gmail';
import { listRecentSentItems } from '@/lib/db/queries/commitments';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * SCHRITT 0 — Wedge-Validierung. NOT a feature: a measurement harness.
 *
 * Runs the EXACT production extractor over the user's own recent sent mail,
 * persists NOTHING, and returns every candidate with its source quote +
 * confidence so the user can eyeball precision and false-positive rate. If
 * the commitment extraction doesn't work on your own mail, nothing after it
 * matters — so this is the test that decides whether the product has a reason
 * to exist.
 */
export type DryRunMail = {
  subject: string | null;
  to: string | null;
  receivedAt: string;
  candidates: CommitmentCandidate[];
};

export type DryRunReport = {
  mailsFetched: number;
  mailsWithBody: number;
  skippedNewsletter: number;
  mailsWithCandidates: number;
  totalCandidates: number;
  byConfidence: { high: number; medium: number; low: number };
  rateLimited: boolean;
  mails: DryRunMail[];
};

const THROTTLE_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function dryRunCommitmentScan(opts?: {
  limit?: number;
  days?: number;
}): Promise<Result<DryRunReport>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };
  const token = await getValidGoogleAccessToken(user.id);
  if (!token) return { ok: false, error: 'Gmail nicht verbunden.' };

  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 40);
  const days = Math.min(Math.max(opts?.days ?? 28, 1), 60);

  const items = await listRecentSentItems(ws.id, user.id, limit, days);
  if (items.length === 0) {
    return {
      ok: false,
      error: 'Keine gesendeten Gmail-Nachrichten im Zeitraum gefunden — erst Inbox synchronisieren.',
    };
  }

  const mails: DryRunMail[] = [];
  const byConfidence = { high: 0, medium: 0, low: 0 };
  let mailsWithBody = 0;
  let skippedNewsletter = 0;
  let totalCandidates = 0;
  let rateLimited = false;

  for (const it of items) {
    let bodyText = '';
    let to = it.recipientEmail;
    let date = it.receivedAt;
    try {
      const body = await getFullMessage(token, it.sourceId);
      if (body) {
        bodyText = body.plain || '';
        to = it.recipientEmail || body.to || null;
        date = body.date ?? it.receivedAt;
      }
    } catch {
      // Body unavailable — record the mail with no candidates and move on.
    }

    if (!bodyText.trim()) {
      mails.push({ subject: it.subject, to, receivedAt: new Date(it.receivedAt).toISOString(), candidates: [] });
      continue;
    }
    mailsWithBody += 1;

    // Newsletter / automated send → skip extraction entirely (same rule the
    // production scanner uses), but count it so the measurement stays honest.
    if (isNewsletterLike({ to, subject: it.subject, body: bodyText })) {
      skippedNewsletter += 1;
      continue;
    }

    let candidates: CommitmentCandidate[] = [];
    try {
      candidates = await extractCommitmentsFromMail(user.id, {
        dateIso: new Date(date).toISOString(),
        to,
        subject: it.subject,
        body: bodyText,
      });
    } catch (e) {
      if (isTransientAIError(e)) {
        rateLimited = true;
        break;
      }
      console.error('[commitments/dry-run] extraction failed', e);
    }

    for (const c of candidates) byConfidence[c.confidence] += 1;
    totalCandidates += candidates.length;
    mails.push({
      subject: it.subject,
      to,
      receivedAt: new Date(it.receivedAt).toISOString(),
      candidates,
    });

    await sleep(THROTTLE_MS);
  }

  return {
    ok: true,
    mailsFetched: mails.length,
    mailsWithBody,
    skippedNewsletter,
    mailsWithCandidates: mails.filter((m) => m.candidates.length > 0).length,
    totalCandidates,
    byConfidence,
    rateLimited,
    mails,
  };
}
