import 'server-only';

import { createHash } from 'crypto';
import { and, asc, desc, eq, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

// Raw briefing signals. These feed both the deterministic structured
// rows (Termine + Todos in the existing DailyBriefing) and the AI
// narrative. We compute a stable hash from the signals so the AI cache
// invalidates the moment underlying state changes.
export type BriefingSignals = {
  /** Three or four sentences worth of context — what's queued for the AI. */
  awaitingFromOthers: Array<{
    name: string;
    daysOld: number;
    subject: string | null;
  }>;
  awaitingFromYou: Array<{
    name: string;
    daysOld: number;
    subject: string | null;
  }>;
  todayEvents: Array<{ time: string; title: string }>;
  overdueTodos: Array<{ title: string; dueAt: string | null }>;
  dueTodayTodos: number;
  unreadEmailCount: number;
  /** Open commitments the user made that are now overdue (Promise Tracker). */
  overdueCommitments: number;
  /** 'morning' | 'afternoon' | 'evening' — drives tone in the prompt. */
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  /** Localised display date for the prompt header. */
  todayLabel: string;
};

const OVERDUE_GRACE_HOURS = 1;
const AWAITING_LIMIT = 5;
const TODOS_LIMIT = 5;

// Triage hard-rule (Schritt 1): only genuine 1:1 mail (primary, customer)
// counts toward the morning brief. Marketing/order-status/social/list noise
// (promo, updates, social, shipping, forums) must not pad "auf dich wartet"
// or the unread count — otherwise the plan reads as garbage.
const briefingMailCategoryClause = sql`${s.inboxItems.category} in ('primary','customer')`;

export async function collectBriefingSignals(input: {
  workspaceId: string;
  userId: string;
  todayEvents: BriefingSignals['todayEvents'];
}): Promise<BriefingSignals> {
  const { workspaceId, userId, todayEvents } = input;
  const db = getDb();
  const now = Date.now();

  const [awaitingOthers, awaitingMine, overdue, unread, dueToday, overdueCommits] = await Promise.all([
    // Unread inbox items — capped, oldest first so we surface
    // long-pending threads, not the freshest 5.
    db
      .select({
        senderName: s.inboxItems.senderName,
        subject: s.inboxItems.subject,
        receivedAt: s.inboxItems.receivedAt,
      })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'inbox'),
          eq(s.inboxItems.isRead, false),
          eq(s.inboxItems.isArchived, false),
          briefingMailCategoryClause,
          or(
            isNull(s.inboxItems.snoozedUntil),
            sql`${s.inboxItems.snoozedUntil} <= now()`
          )!
        )
      )
      .orderBy(asc(s.inboxItems.receivedAt))
      .limit(AWAITING_LIMIT),
    // Sent items still awaiting a reply, oldest first.
    db
      .select({
        recipientEmail: s.inboxItems.recipientEmail,
        senderName: s.inboxItems.senderName,
        subject: s.inboxItems.subject,
        receivedAt: s.inboxItems.receivedAt,
      })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'sent'),
          eq(s.inboxItems.awaitsTheirReply, true),
          eq(s.inboxItems.isArchived, false),
          briefingMailCategoryClause,
          // Respect snooze — a deferred send must not resurface in the brief
          // while it stays hidden from the main awaiting view.
          or(
            isNull(s.inboxItems.snoozedUntil),
            sql`${s.inboxItems.snoozedUntil} <= now()`
          )!,
          sql`${s.inboxItems.receivedAt} < now() - interval '3 days'`
        )
      )
      .orderBy(asc(s.inboxItems.receivedAt))
      .limit(AWAITING_LIMIT),
    // Overdue todos — past dueAt + still open. Grace of 1h to avoid
    // a todo flipping to overdue the second its time of day passes.
    // Visibility-filtered: only todos this user is allowed to see.
    db
      .select({
        title: s.todos.title,
        dueAt: s.todos.dueAt,
      })
      .from(s.todos)
      .where(
        and(
          eq(s.todos.workspaceId, workspaceId),
          or(eq(s.todos.status, 'offen'), eq(s.todos.status, 'in_arbeit')),
          sql`${s.todos.dueAt} IS NOT NULL`,
          lt(s.todos.dueAt, new Date(now - OVERDUE_GRACE_HOURS * 60 * 60_000)),
          or(
            ne(s.todos.visibility, 'private'),
            eq(s.todos.createdById, userId),
            eq(s.todos.assigneeId, userId)
          )!
        )
      )
      .orderBy(asc(s.todos.dueAt))
      .limit(TODOS_LIMIT),
    // Unread inbox count — one COUNT, cheap. Same triage rule: only count
    // mail that actually wants attention, not newsletters/order updates.
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.userId, userId),
          eq(s.inboxItems.direction, 'inbox'),
          eq(s.inboxItems.isRead, false),
          eq(s.inboxItems.isArchived, false),
          briefingMailCategoryClause,
          // Snoozed-but-unread mail is hidden from the inbox list, so it must
          // not inflate the brief's unread signal either.
          or(
            isNull(s.inboxItems.snoozedUntil),
            sql`${s.inboxItems.snoozedUntil} <= now()`
          )!
        )
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.todos)
      .where(
        and(
          eq(s.todos.workspaceId, workspaceId),
          or(eq(s.todos.status, 'offen'), eq(s.todos.status, 'in_arbeit')),
          sql`${s.todos.dueAt}::date = current_date`,
          or(
            ne(s.todos.visibility, 'private'),
            eq(s.todos.createdById, userId),
            eq(s.todos.assigneeId, userId)
          )!
        )
      ),
    // Promise Tracker — open commitments the user made whose deadline
    // has passed. One COUNT; feeds the "you owe …" line in the briefing.
    // Only HIGH-confidence ones are asserted as real obligations; tentative
    // "bitte bestätigen" promises must not be stated as overdue facts.
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.inboxCommitments)
      .where(
        and(
          eq(s.inboxCommitments.workspaceId, workspaceId),
          eq(s.inboxCommitments.userId, userId),
          eq(s.inboxCommitments.status, 'open'),
          eq(s.inboxCommitments.confidence, 'high'),
          sql`${s.inboxCommitments.dueAt} IS NOT NULL`,
          lt(s.inboxCommitments.dueAt, new Date(now))
        )
      ),
  ]);

  const daysSince = (d: Date | string) =>
    Math.max(
      0,
      Math.floor((now - new Date(d).getTime()) / 86_400_000)
    );

  const hour = new Date().getHours();
  const timeOfDay: BriefingSignals['timeOfDay'] =
    hour < 11 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return {
    awaitingFromOthers: awaitingOthers.map((r) => ({
      name: cleanName(r.senderName),
      daysOld: daysSince(r.receivedAt),
      subject: r.subject,
    })),
    awaitingFromYou: awaitingMine.map((r) => ({
      name: cleanName(r.recipientEmail || r.senderName),
      daysOld: daysSince(r.receivedAt),
      subject: r.subject,
    })),
    todayEvents,
    overdueTodos: overdue.map((r) => ({
      title: r.title,
      dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
    })),
    dueTodayTodos: Number(dueToday[0]?.n ?? 0),
    unreadEmailCount: Number(unread[0]?.n ?? 0),
    overdueCommitments: Number(overdueCommits[0]?.n ?? 0),
    timeOfDay,
    todayLabel: new Date().toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  };
}

// Hash the signals so the AI cache invalidates the moment underlying
// state shifts. We DELIBERATELY exclude timeOfDay + todayLabel — those
// drift continuously and would invalidate the cache hourly.
export function hashSignals(signals: BriefingSignals): string {
  const stable = {
    a: signals.awaitingFromOthers.map((x) => `${x.name}:${x.daysOld}`),
    b: signals.awaitingFromYou.map((x) => `${x.name}:${x.daysOld}`),
    c: signals.todayEvents.map((e) => `${e.time}:${e.title}`),
    d: signals.overdueTodos.map((t) => t.title),
    e: signals.dueTodayTodos,
    f: signals.unreadEmailCount,
    g: signals.overdueCommitments,
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 32);
}

// Same regex/heuristic we use elsewhere — "Anna Hoffmann <anna@…>"
// keeps just the display name.
function cleanName(raw: string | null): string {
  if (!raw) return 'Unbekannt';
  const m = raw.match(/^(.*)<[^>]+>\s*$/);
  if (m) return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') || raw;
  return raw;
}
