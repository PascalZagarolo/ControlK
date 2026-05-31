'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { aiAvailable, isTransientAIError } from '@/lib/ai/gateway';
import { extractCommitmentsFromMail, type CommitmentCandidate } from '@/lib/ai/commitment-extract';
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

    if (bodyText.trim()) {
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

  return { scanned: processed, found, rateLimited };
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

export async function resolveCommitment(id: string): Promise<Result> {
  return setStatus(id, 'done');
}
export async function dismissCommitment(id: string): Promise<Result> {
  return setStatus(id, 'dismissed');
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
