'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ne, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { aiAvailable, isTransientAIError } from '@/lib/ai/gateway';
import { extractCommitmentsFromMail, shouldSkipExtraction, type CommitmentCandidate } from '@/lib/ai/commitment-extract';
import { getValidGoogleAccessToken } from '@/lib/auth/google-tokens';
import { getFullMessage } from '@/lib/google/gmail';
import { listUnscannedSentItems } from '@/lib/db/queries/commitments';
import { createTodo } from '@/lib/actions/todos';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const SCAN_BATCH = 12;
// Spacing between per-item AI calls — smooths the burst so we glide under
// the provider's rate limit instead of slamming into it.
const SCAN_THROTTLE_MS = 250;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Session-free core: scans recently-sent mails (not yet processed) for
 * commitments the user made, persists them, marks each item scanned. Used by
 * the on-demand action AND the inbox-sync cron (autopilot). No-op (returns
 * zeros) when AI or Gmail isn't available.
 */
export async function scanCommitments(
  userId: string,
  workspaceId: string
): Promise<{ scanned: number; found: number; rateLimited: boolean }> {
  if (!(await aiAvailable(userId))) return { scanned: 0, found: 0, rateLimited: false };
  const token = await getValidGoogleAccessToken(userId);
  if (!token) return { scanned: 0, found: 0, rateLimited: false };

  const db = getDb();
  const items = await listUnscannedSentItems(workspaceId, userId, SCAN_BATCH);
  if (items.length === 0) return { scanned: 0, found: 0, rateLimited: false };

  const ws = { id: workspaceId };
  const user = { id: userId };
  let found = 0;
  let processed = 0;
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
      // Body fetch failed — still mark scanned so we don't loop on it.
    }

    // Stufe 1 — deterministic pre-filter: skip newsletters/automated sends
    // AND low-signal sends (pure forwards, one-word acks, empty bodies).
    // Never a personal commitment, and skipping spares an AI call. Item is
    // still marked scanned below.
    if (!shouldSkipExtraction({ to, subject: it.subject, body: bodyText })) {
      let candidates: CommitmentCandidate[] = [];
      try {
        candidates = await extractCommitmentsFromMail(user.id, {
          dateIso: new Date(date).toISOString(),
          to,
          subject: it.subject,
          body: bodyText,
        });
      } catch (e) {
        // Transient (rate-limit / timeout): leave this item UNSCANNED so a
        // later run retries it — a 429 must never silently drop a commitment
        // — and stop the batch to avoid hammering the limit further.
        if (isTransientAIError(e)) {
          rateLimited = true;
          break;
        }
        console.error('[commitments] extraction failed', e);
      }

      if (candidates.length > 0) {
        let customerId: string | null = null;
        if (to) {
          const [match] = await db
            .select({ customerId: s.customers.id })
            .from(s.customerContacts)
            .innerJoin(s.customers, eq(s.customers.id, s.customerContacts.customerId))
            .where(
              and(
                eq(s.customers.workspaceId, ws.id),
                sql`lower(${s.customerContacts.email}) = ${to.toLowerCase()}`
              )
            )
            .limit(1);
          customerId = match?.customerId ?? null;
        }
        await db.insert(s.inboxCommitments).values(
          candidates.map((c) => ({
            workspaceId: ws.id,
            userId: user.id,
            sourceItemId: it.id,
            sourceThreadId: it.sourceThreadId,
            recipientEmail: to,
            recipientName: to ? to.split('@')[0] : null,
            customerId,
            promiseText: c.promise,
            // Persist explainability + threshold signal (Schritt 4a). The
            // parser guarantees a non-empty quote, but `|| null` is kept as a
            // defensive belt — a quote-less row would be hidden by the
            // display-layer guard anyway.
            sourceQuote: c.quote || null,
            dueBasis: c.dueBasis || null,
            confidence: c.confidence,
            dueAt: c.dueIso ? new Date(c.dueIso) : null,
            status: 'open' as const,
          }))
        );
        found += candidates.length;
      }

      // Gentle throttle between AI calls to stay under burst limits.
      await sleep(SCAN_THROTTLE_MS);
    }

    await db
      .update(s.inboxItems)
      .set({ commitmentsScannedAt: new Date() })
      .where(eq(s.inboxItems.id, it.id));
    processed += 1;
  }

  // After scanning, sweep for commitments the user has likely already kept.
  await autoResolveFollowedUpCommitments(userId, workspaceId);

  return { scanned: processed, found, rateLimited };
}

/**
 * Auto-mark a commitment done when the user demonstrably followed up: a LATER
 * sent mail exists in the same thread, distinct from the promise mail itself.
 *
 * Deliberately conservative — the review flagged that a vague "melde mich"
 * follow-up doesn't fulfil a promise. We accept that false-positive risk only
 * for commitments WITHOUT a deadline OR already past their deadline (where a
 * later send is strong evidence the thread moved on); commitments still within
 * their due window are left alone so we never silently clear something the user
 * is actively working toward. Stamped with autoDoneAt so it's auditable.
 */
export async function autoResolveFollowedUpCommitments(
  userId: string,
  workspaceId: string
): Promise<number> {
  const db = getDb();
  const open = await db
    .select({
      id: s.inboxCommitments.id,
      sourceItemId: s.inboxCommitments.sourceItemId,
      sourceThreadId: s.inboxCommitments.sourceThreadId,
      dueAt: s.inboxCommitments.dueAt,
      createdAt: s.inboxCommitments.createdAt,
    })
    .from(s.inboxCommitments)
    .where(
      and(
        eq(s.inboxCommitments.workspaceId, workspaceId),
        eq(s.inboxCommitments.userId, userId),
        eq(s.inboxCommitments.status, 'open')
      )
    );

  const now = Date.now();
  let resolved = 0;
  for (const c of open) {
    if (!c.sourceThreadId || !c.sourceItemId) continue;
    // Only consider commitments that are undated or already overdue.
    if (c.dueAt && new Date(c.dueAt).getTime() > now) continue;

    // The anchor: when the promise was made (the source mail's receivedAt).
    const [anchor] = await db
      .select({ receivedAt: s.inboxItems.receivedAt })
      .from(s.inboxItems)
      .where(eq(s.inboxItems.id, c.sourceItemId))
      .limit(1);
    if (!anchor) continue;

    const [laterSend] = await db
      .select({ id: s.inboxItems.id })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'sent'),
          eq(s.inboxItems.sourceThreadId, c.sourceThreadId),
          ne(s.inboxItems.id, c.sourceItemId),
          sql`${s.inboxItems.receivedAt} > ${anchor.receivedAt}`
        )
      )
      .limit(1);

    if (laterSend) {
      await db
        .update(s.inboxCommitments)
        .set({ status: 'done', autoDoneAt: new Date() })
        .where(eq(s.inboxCommitments.id, c.id));
      resolved += 1;
    }
  }
  return resolved;
}

/** On-demand wrapper for the "Gesendete Mails scannen" button. */
export async function extractCommitments(): Promise<
  Result<{ scanned: number; found: number; rateLimited: boolean }>
> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };
  if (!(await getValidGoogleAccessToken(user.id))) return { ok: false, error: 'Gmail nicht verbunden.' };
  const res = await scanCommitments(user.id, ws.id);
  revalidatePath('/inbox');
  return { ok: true, ...res };
}

async function setStatus(id: string, status: 'done' | 'dismissed'): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.inboxCommitments)
    .set({ status })
    .where(
      and(
        eq(s.inboxCommitments.id, id),
        eq(s.inboxCommitments.workspaceId, ws.id),
        eq(s.inboxCommitments.userId, user.id)
      )
    );
  revalidatePath('/inbox');
  return { ok: true };
}

/**
 * "Nicht heute" — defer a commitment until `untilIso` (default: tomorrow
 * morning). It leaves the open list + morning plan until then, instead of
 * being resolved or dismissed. Ownership-checked.
 */
export async function snoozeCommitment(id: string, untilIso?: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  let until: Date;
  if (untilIso) {
    const d = new Date(untilIso);
    until = isNaN(d.getTime()) ? defaultSnoozeUntil() : d;
  } else {
    until = defaultSnoozeUntil();
  }
  // Only an OPEN commitment can be deferred — snoozing a resolved/dismissed
  // one would silently no-op, so we report that rather than fake success.
  const [row] = await db
    .update(s.inboxCommitments)
    .set({ snoozedUntil: until })
    .where(
      and(
        eq(s.inboxCommitments.id, id),
        eq(s.inboxCommitments.workspaceId, ws.id),
        eq(s.inboxCommitments.userId, user.id),
        eq(s.inboxCommitments.status, 'open')
      )
    )
    .returning({ id: s.inboxCommitments.id });
  if (!row) return { ok: false, error: 'Zusage nicht gefunden oder schon erledigt.' };
  revalidatePath('/inbox');
  revalidatePath('/plan');
  revalidatePath('/kunden');
  return { ok: true };
}

/** Tomorrow at 09:00 — the product-wide "nicht heute" wake time (matches the
 *  inbox/todo snooze + the morning-plan action), so it's consistent everywhere. */
function defaultSnoozeUntil(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export async function resolveCommitment(id: string): Promise<Result> {
  return setStatus(id, 'done');
}
export async function dismissCommitment(id: string): Promise<Result> {
  return setStatus(id, 'dismissed');
}

/**
 * User confirms a tentative (medium/low) commitment is a real promise →
 * promote it to 'high' so it moves from "bitte bestätigen" into the firm
 * "fällig" list. The manual override the confidence threshold is built around.
 */
export async function confirmCommitment(id: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.inboxCommitments)
    .set({ confidence: 'high' })
    .where(
      and(
        eq(s.inboxCommitments.id, id),
        eq(s.inboxCommitments.workspaceId, ws.id),
        eq(s.inboxCommitments.userId, user.id)
      )
    );
  revalidatePath('/inbox');
  return { ok: true };
}

/**
 * One-click cross-module conversion: turn a commitment into a real Todo.
 * Carries over the deadline and customer link, then marks the commitment
 * resolved so it leaves the Promise Tracker (it now lives in Todos).
 */
export async function commitmentToTodo(id: string): Promise<Result<{ todoId: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const [c] = await db
    .select({
      promiseText: s.inboxCommitments.promiseText,
      dueAt: s.inboxCommitments.dueAt,
      customerId: s.inboxCommitments.customerId,
      recipientName: s.inboxCommitments.recipientName,
    })
    .from(s.inboxCommitments)
    .where(
      and(
        eq(s.inboxCommitments.id, id),
        eq(s.inboxCommitments.workspaceId, ws.id),
        eq(s.inboxCommitments.userId, user.id),
        eq(s.inboxCommitments.status, 'open')
      )
    )
    .limit(1);

  if (!c) return { ok: false, error: 'Zusage nicht gefunden.' };

  const res = await createTodo({
    title: c.promiseText,
    dueAt: c.dueAt ? new Date(c.dueAt).toISOString() : null,
    customerId: c.customerId ?? undefined,
    assigneeId: user.id,
  });
  if (!res.ok) return res;

  await db
    .update(s.inboxCommitments)
    .set({ status: 'done' })
    .where(eq(s.inboxCommitments.id, id));

  revalidatePath('/inbox');
  return { ok: true, todoId: res.id };
}
