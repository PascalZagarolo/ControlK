'use server';

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { syncGmailForUser } from '@/lib/google/gmail-sync';
import { scanCommitments } from '@/lib/actions/commitments';
import { buildMorningPlan } from '@/lib/morning-plan/build';
import { getAwaitingSplit } from '@/lib/db/queries/inbox-overview';
import { PLAN_KICKER, planAccent } from '@/lib/foyer/build-foyer-data';
import type { OnboardingPlanItem, OnboardingScanResult } from './onboarding-types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// Onboarding actions. Persist the step-1 task focus + the solo/team choice,
// and mark the flow complete. The focus PERSONALISES messaging only — it does
// NOT create persona-separated feature sets. Solo/team maps to the existing
// workspace.scope (private/business), which already gates team elements.

export type OnboardingFocus = 'commitments' | 'response_time' | 'morning_chaos' | 'all';
const FOCI = new Set<OnboardingFocus>(['commitments', 'response_time', 'morning_chaos', 'all']);

/** Step 1 — store the chosen task focus (skippable → just don't call this). */
export async function setOnboardingFocus(focus: OnboardingFocus): Promise<Result> {
  const user = await requireUser();
  if (!FOCI.has(focus)) return { ok: false, error: 'Ungültige Auswahl.' };
  const db = getDb();
  await db.update(s.users).set({ onboardingFocus: focus }).where(eq(s.users.id, user.id));
  return { ok: true };
}

/**
 * Step 2 — solo vs. team. The ONLY real segmentation: maps to the current
 * workspace's scope ('private' = solo, 'business' = team), which gates the
 * shared/team elements (Prompt 5) + pricing tier. No other feature split.
 */
export async function setWorkspaceType(type: 'solo' | 'team'): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  await db
    .update(s.workspaces)
    .set({ scope: type === 'team' ? 'business' : 'private' })
    .where(eq(s.workspaces.id, ws.id));
  return { ok: true };
}

/** Mark onboarding complete (or ended) — stops the /onboarding redirect. */
export async function completeOnboarding(): Promise<Result> {
  const user = await requireUser();
  const db = getDb();
  await db
    .update(s.users)
    .set({ onboardingCompletedAt: new Date() })
    .where(eq(s.users.id, user.id));
  return { ok: true };
}

const MAX_PREVIEW_ITEMS = 5;
const MAX_TAGGABLE_SENDERS = 3;

/**
 * Step 3 — the Aha-moment. Runs the SAME first scan the autopilot cron does
 * (sync sent + inbox, then extract commitments), then builds the REAL morning
 * plan and returns a serialisable preview. No invented content: every item is
 * gated by the plan engine (commitments need a source quote, replies are real
 * unread inbound). Honest about the empty case — if nothing pressing surfaced,
 * `plan.isCalm` is true and the UI says so plainly.
 *
 * Consumes (never reimplements): syncGmailForUser, scanCommitments,
 * buildMorningPlan, getAwaitingSplit, and the foyer's kicker/accent tokens.
 */
export async function runFirstScan(): Promise<OnboardingScanResult> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();

  // 1. Pull recent inbox + sent mail.
  const sync = await syncGmailForUser(user.id, ws.id);
  if (!sync.ok) {
    return { ok: false, reason: sync.reason };
  }

  // Everything past the sync is wrapped: buildMorningPlan's sub-fetches each
  // degrade to empty, but its synchronous compute step (or getAwaitingSplit /
  // requireCurrentWorkspace) could still throw. An uncaught throw here would
  // reject the action and strand the client on the scanning spinner forever,
  // so we degrade to a clean { ok: false, reason: 'error' } instead.
  try {
    // 2. Autopilot's commitment pass over freshly-synced sent mail. Best-effort:
    //    no AI budget / rate-limit just means 0 found, not a failure.
    const commit = await scanCommitments(user.id, ws.id).catch(() => ({
      scanned: 0,
      found: 0,
      rateLimited: false,
    }));

    // 3. Build the real plan from what we just read.
    const plan = await buildMorningPlan(ws.id, user.id, { withSummary: true });

    const mapped: OnboardingPlanItem[] = plan.items.slice(0, MAX_PREVIEW_ITEMS).map((item) => ({
      key: item.key,
      kicker: PLAN_KICKER[item.kind] ?? 'Heute',
      title: item.title,
      reason: item.reason,
      timing: item.timing,
      isQuestion: item.isQuestion,
      accent: planAccent(item.kind),
    }));

    // 4. A few real, distinct inbound senders for the optional "als Kunde
    //    markieren" step — deduped by email, only those we can tag.
    const seen = new Set<string>();
    const awaiting = await getAwaitingSplit(ws.id, user.id).catch(() => ({ onYou: [], onThem: [] }));
    const taggable: { name: string; email: string; ageDays: number }[] = [];
    for (const row of awaiting.onYou) {
      const email = row.senderEmail?.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      taggable.push({ name: cleanSenderName(row.senderName) || email, email, ageDays: row.ageDays });
      if (taggable.length >= MAX_TAGGABLE_SENDERS) break;
    }

    return {
      ok: true,
      connectionState: plan.connectionState,
      // `inserted` = rows newly recorded by the first sync (initial mode pulls
      // the whole recent batch), so the UI labels this "erfasst", not "gelesen".
      scan: { mailsRead: sync.inserted, commitmentsFound: commit.found },
      plan: {
        summaryLine: plan.summary,
        items: mapped,
        collision: plan.collisions[0]?.message ?? null,
        isCalm: plan.isCalm,
        stats: plan.stats,
      },
      senders: taggable,
    };
  } catch (e) {
    console.error('[runFirstScan] plan build failed:', e instanceof Error ? e.message : e);
    return { ok: false, reason: 'error' };
  }
}

/** Strip a "Name <email>" wrapper down to the display name. */
function cleanSenderName(raw: string | null): string {
  if (!raw) return '';
  const m = raw.match(/^(.*)<[^>]+>\s*$/);
  if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  return raw.trim();
}
