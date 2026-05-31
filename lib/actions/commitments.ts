'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { aiAvailable, aiGenerateJSON, AI_MODEL_FAST } from '@/lib/ai/gateway';
import { getValidGoogleAccessToken } from '@/lib/auth/google-tokens';
import { getFullMessage } from '@/lib/google/gmail';
import { listUnscannedSentItems } from '@/lib/db/queries/commitments';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const SCAN_BATCH = 12;

/**
 * Scans recently-sent mails (not yet processed) for commitments the user made
 * — "schick ich dir bis Freitag das Angebot" — and persists them. Marks each
 * item scanned so a Gmail body is never re-fetched. Returns counts.
 */
export async function extractCommitments(): Promise<Result<{ scanned: number; found: number }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  const token = await getValidGoogleAccessToken(user.id);
  if (!token) return { ok: false, error: 'Gmail nicht verbunden.' };

  const db = getDb();
  const items = await listUnscannedSentItems(ws.id, user.id, SCAN_BATCH);
  if (items.length === 0) return { ok: true, scanned: 0, found: 0 };

  let found = 0;
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
      try {
        const parsed = await aiGenerateJSON<{
          commitments?: { promise?: string; dueIso?: string | null }[];
        }>({
          userId: user.id,
          model: AI_MODEL_FAST,
          maxOutputTokens: 400,
          system:
            'Du extrahierst aus einer vom Nutzer GESENDETEN E-Mail verbindliche Zusagen, die DER ' +
            'NUTZER selbst gemacht hat — Dinge, die er liefern/erledigen wird, idealerweise mit Frist. ' +
            'Antworte NUR mit JSON: { "commitments": [{ "promise": string (kurz, z.B. "Angebot schicken"), ' +
            '"dueIso": string|null (ISO-Datum wenn eine Frist genannt ist; relative wie "bis Freitag/morgen" ' +
            'relativ zum Mail-Datum auflösen, sonst null) }] }. Nur echte eigene Zusagen, keine Fragen oder ' +
            'Höflichkeitsfloskeln. Leeres Array wenn keine.',
          prompt:
            `Mail-Datum: ${new Date(date).toISOString()}\n` +
            `An: ${to ?? '(unbekannt)'}\n` +
            `Betreff: ${it.subject ?? ''}\n\n` +
            `Text:\n${bodyText.slice(0, 4000)}`,
        });
        const commitments = (parsed?.commitments ?? [])
          .filter((c) => c?.promise?.trim())
          .slice(0, 5);

        if (commitments.length > 0) {
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
            commitments.map((c) => {
              const due = c.dueIso ? new Date(c.dueIso) : null;
              return {
                workspaceId: ws.id,
                userId: user.id,
                sourceItemId: it.id,
                sourceThreadId: it.sourceThreadId,
                recipientEmail: to,
                recipientName: to ? to.split('@')[0] : null,
                customerId,
                promiseText: c.promise!.trim().slice(0, 400),
                dueAt: due && !Number.isNaN(due.getTime()) ? due : null,
                status: 'open' as const,
              };
            })
          );
          found += commitments.length;
        }
      } catch (e) {
        console.error('[commitments] parse failed', e);
      }
    }

    await db
      .update(s.inboxItems)
      .set({ commitmentsScannedAt: new Date() })
      .where(eq(s.inboxItems.id, it.id));
  }

  revalidatePath('/inbox');
  return { ok: true, scanned: items.length, found };
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
