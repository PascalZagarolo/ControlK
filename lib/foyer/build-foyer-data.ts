import 'server-only';
import { and, desc, eq, gt, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { listCalendarEvents } from '@/lib/db/queries/calendar';
import { listChannels } from '@/lib/db/queries/channels';
import { listTodos } from '@/lib/db/queries/todos';
import { listNotifications } from '@/lib/db/queries/notifications';
import { listFoyerInboxCards, type FoyerInboxCard } from '@/lib/db/queries/inbox';
import { getAwaitingSplit } from '@/lib/db/queries/inbox-overview';
import { getCommitmentCounts } from '@/lib/db/queries/commitments';
import { fetchGmailConnectionState } from '@/lib/foyer/gmail-state';
import { collectBriefingSignals } from '@/lib/foyer/briefing-signals';
import { getOrGenerateBriefing } from '@/lib/foyer/briefing-ai';
import { buildMorningPlan } from '@/lib/morning-plan/build';
import type { PlanItem } from '@/lib/morning-plan/types';
import type {
  FoyerData,
  FoyerEvent,
  FoyerLatestMessage,
  FoyerMorningPlan,
  FoyerPlanItem,
  FoyerSuggestion,
} from '@/components/foyer/foyer-client';

const DAY_MS = 86_400_000;

/**
 * Aggregates everything the foyer needs into a single payload. Called from
 * the server page; on auth failure or any sub-query exception, falls back
 * to a cheap "calm morning" payload so the page still renders.
 *
 * All queries are workspace-scoped — the foyer never crosses workspaces.
 */
export async function buildFoyerData(input: {
  workspaceId: string;
  userId: string;
  userName: string;
  /** When 'private' (personal workspace), the foyer skips the channels
   *  briefing row since channels don't exist there. Defaults to
   *  'business' for the anonymous foyer / legacy callers. */
  workspaceScope?: 'business' | 'private';
  /** Workspace display name — used by the workspace-aware greeting
   *  to swap "Guten Morgen, Pascal." for "Guten Morgen — uRent."
   *  in shared workspaces. */
  workspaceName?: string;
}): Promise<FoyerData> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + DAY_MS);
  const startOfWeekFromToday = new Date(startOfToday.getTime() + 7 * DAY_MS);

  // Parallelize the safe queries
  const [
    eventRows,
    channels,
    todos,
    notifications,
    latestMessage,
    recentNote,
    inboxCards,
    gmail,
    awaitingSplit,
    commitmentCounts,
    morningPlanRaw,
  ] = await Promise.all([
      listCalendarEvents(input.workspaceId, startOfToday, startOfTomorrow).catch(
        () => [] as Awaited<ReturnType<typeof listCalendarEvents>>
      ),
      listChannels(input.workspaceId).catch(() => []),
      listTodos(input.workspaceId, input.userId).catch(() => []),
      // Workspace-scoped notifications. Without the workspaceId filter
      // the foyer would pull mentions from every shared workspace the
      // user is in, breaking the "lobby of THIS workspace" semantics.
      listNotifications(input.userId, 50, input.workspaceId).catch(() => []),
      fetchLatestUnreadMessage(input.workspaceId, input.userId).catch(() => null),
      fetchMostRecentNote(input.workspaceId).catch(() => null),
      listFoyerInboxCards(input.workspaceId, input.userId).catch(() => []),
      fetchGmailConnectionState(input.userId).catch(() => ({
        connected: false,
        syncedAt: null,
      })),
      // Morgen-Plan signals: triaged mail awaiting + firm commitments owed.
      // Fallbacks keep the foyer rendering, but we log so a silently-failing
      // query on the most-hit page still surfaces in the error budget.
      getAwaitingSplit(input.workspaceId, input.userId).catch((e) => {
        console.warn('[build-foyer-data] getAwaitingSplit failed:', e);
        return { onYou: [] as never[], onThem: [] as never[] };
      }),
      getCommitmentCounts(input.workspaceId, input.userId).catch((e) => {
        console.warn('[build-foyer-data] getCommitmentCounts failed:', e);
        return { open: 0, overdue: 0 };
      }),
      // Morgen-Plan-Synthese (Prompt 4) — deterministisch, ohne LLM-Summary
      // (der Foyer rendert die berechneten Items selbst). Liefert die Spitze,
      // die "Heute"-Agenda und Kollisionen aus echten, Prompt-1-gegateten Daten.
      buildMorningPlan(input.workspaceId, input.userId, { withSummary: false }).catch((e) => {
        console.warn('[build-foyer-data] buildMorningPlan failed:', e);
        return null;
      }),
    ]);

  // ─── Events ─────────────────────────────────────────────────
  const events: FoyerEvent[] = eventRows
    .slice()
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((e) => ({
      time: formatTime(new Date(e.startsAt)),
      title: e.title,
    }));

  // ─── Unread breakdown ───────────────────────────────────────
  const unreadChannels = channels.reduce((sum, c) => sum + (c.unread ?? 0), 0);
  const unreadMentions = notifications.filter(
    (n) => n.kind === 'mention' && !n.read
  ).length;
  // Email count is approximate: listFoyerInboxCards is capped at 6 for
  // the stack render. Good enough for the foyer's "Unread total" badge;
  // a precise count would need a separate COUNT query.
  const unreadEmail = inboxCards.filter(
    (c) => c.source === 'email'
  ).length;
  const unreadTotal = unreadChannels + unreadMentions + unreadEmail;

  // ─── Todos ──────────────────────────────────────────────────
  const open = todos.filter(
    (t) => t.status === 'offen' || t.status === 'in_arbeit'
  );
  const dueToday = open.filter(
    (t) => t.dueAt && inRange(t.dueAt, startOfToday, startOfTomorrow)
  ).length;
  const dueTomorrow = open.filter(
    (t) =>
      t.dueAt &&
      inRange(t.dueAt, startOfTomorrow, new Date(startOfTomorrow.getTime() + DAY_MS))
  ).length;
  const dueWeek = open.filter(
    (t) => t.dueAt && inRange(t.dueAt, startOfToday, startOfWeekFromToday)
  ).length;

  // ─── Jetzt suggestions ──────────────────────────────────────
  const jetztSuggestions = buildJetztSuggestions({
    events,
    dueToday,
    eventRows,
    recentNote,
  });

  // Smart briefing — gathers structured signals + asks AI for a 2-3
  // sentence narrative. Falls back to a deterministic one-liner when
  // AI is not configured. Cached per user with signal-hash + 1h TTL,
  // so steady-state foyer loads are O(1) DB lookup.
  const briefing = await (async () => {
    try {
      const signals = await collectBriefingSignals({
        workspaceId: input.workspaceId,
        userId: input.userId,
        todayEvents: events,
      });
      return await getOrGenerateBriefing({
        userId: input.userId,
        workspaceId: input.workspaceId,
        signals,
      });
    } catch (e) {
      console.warn('[build-foyer-data] briefing failed:', e);
      return null;
    }
  })();

  // ─── Channels activity (briefing row, shared workspaces only) ──
  //
  // Personal workspaces don't have channels — skip the row entirely
  // there, otherwise the briefing renders a "0 ungelesen" line that
  // never changes. Shared workspaces always render the row so the
  // user knows whether they need to look at /channels.
  const channelsActivity: FoyerData['channelsActivity'] =
    input.workspaceScope === 'private' || channels.length === 0
      ? null
      : (() => {
          const totalUnread = channels.reduce(
            (sum, c) => sum + (c.unread ?? 0),
            0
          );
          const top = [...channels]
            .filter((c) => (c.unread ?? 0) > 0)
            .sort((a, b) => (b.unread ?? 0) - (a.unread ?? 0))[0];
          return {
            channelCount: channels.length,
            totalUnread,
            topChannelName: top?.name ?? null,
            topChannelUnread: top?.unread ?? 0,
            hasMentions: unreadMentions > 0,
          };
        })();

  // Merge channel-mention notifications into the inbox-cards stack.
  // Mentions are time-sensitive ("@you in #akquise") so they belong in
  // the same calm-but-present strip as unread Gmail. Read-mentions
  // (notifications.readAt set) drop out; sort by recency so the
  // freshest item lands at the top of the foyer column.
  const mentionCards = notifications
    .filter((n) => n.kind === 'mention' && !n.read)
    .map((n): FoyerInboxCard => {
      const slugMatch = n.sourceUrl.match(/\/channels\/([^/#?]+)/);
      const slug = slugMatch?.[1] ?? '';
      const minAgo = Math.max(
        0,
        Math.round((Date.now() - new Date(n.timestamp).getTime()) / 60_000)
      );
      return {
        id: `mention-${n.id}`,
        source: 'mention',
        sourceLabel: slug ? `#${slug}` : 'Channel',
        sender: n.title,
        preview: (n.excerpt ?? '').trim() || 'Du wurdest erwähnt.',
        minAgo,
        href: n.sourceUrl,
      };
    });
  const mergedInboxCards = [...mentionCards, ...inboxCards]
    .sort((a, b) => a.minAgo - b.minAgo)
    .slice(0, 8); // matches NotificationStack render cap + headroom

  const morningPlan = morningPlanRaw ? toFoyerMorningPlan(morningPlanRaw) : undefined;

  return {
    userName: input.userName,
    workspaceName: input.workspaceName,
    workspaceScope: input.workspaceScope ?? 'business',
    events,
    unread: unreadTotal,
    email: unreadEmail,
    channels: unreadChannels,
    mentions: unreadMentions,
    latestMessage,
    dueToday,
    dueWeek,
    dueTomorrow,
    awaitingOnYou: awaitingSplit.onYou.length,
    awaitingOnThem: awaitingSplit.onThem.length,
    commitmentsOpen: commitmentCounts.open,
    commitmentsOverdue: commitmentCounts.overdue,
    jetztSuggestions,
    inboxCards: mergedInboxCards,
    gmail,
    briefing,
    channelsActivity,
    morningPlan,
  };
}

// ───────────────────────────────────────────────────────────────
// Sub-queries
// ───────────────────────────────────────────────────────────────

/**
 * Most-recent unread message across all channels the user is a member of.
 * Excludes messages authored by the user themselves. "Unread" here means
 * the message is newer than the user's lastReadAt on that channel.
 */
async function fetchLatestUnreadMessage(
  workspaceId: string,
  userId: string
): Promise<FoyerLatestMessage | null> {
  const db = getDb();
  const row = await db
    .select({
      messageId: s.messages.id,
      body: s.messages.body,
      createdAt: s.messages.createdAt,
      channelSlug: s.channels.slug,
      authorName: s.users.name,
    })
    .from(s.messages)
    .innerJoin(s.channels, eq(s.channels.id, s.messages.channelId))
    .innerJoin(
      s.channelMembers,
      and(
        eq(s.channelMembers.channelId, s.messages.channelId),
        eq(s.channelMembers.userId, userId)
      )
    )
    .innerJoin(s.users, eq(s.users.id, s.messages.authorId))
    .where(
      and(
        eq(s.channels.workspaceId, workspaceId),
        sql`${s.messages.authorId} <> ${userId}`,
        or(
          isNull(s.channelMembers.lastReadAt),
          gt(s.messages.createdAt, s.channelMembers.lastReadAt)
        )
      )
    )
    .orderBy(desc(s.messages.createdAt))
    .limit(1);

  if (row.length === 0) return null;
  const r = row[0];
  const minAgo = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 60_000);
  return {
    sender: r.authorName,
    preview: collapsePreview(r.body),
    minAgo: Math.max(0, minAgo),
    href: `/channels/${r.channelSlug}#m-${r.messageId}`,
  };
}

/** Most recently updated, non-archived note in the workspace */
async function fetchMostRecentNote(
  workspaceId: string
): Promise<{ id: string; title: string; updatedAt: Date } | null> {
  const db = getDb();
  const row = await db.query.notes.findFirst({
    where: and(eq(s.notes.workspaceId, workspaceId), isNull(s.notes.archivedAt)),
    orderBy: [desc(s.notes.updatedAt)],
    columns: { id: true, title: true, updatedAt: true },
  });
  return row ? { id: row.id, title: row.title, updatedAt: row.updatedAt } : null;
}

// ───────────────────────────────────────────────────────────────
// Jetzt heuristics
// ───────────────────────────────────────────────────────────────

/**
 * Pick 1-3 candidate suggestions. The order is priority — the FIRST is
 * what the user sees by default. "Anderes vorschlagen" cycles through.
 *
 * Heuristics, top-down:
 *   1. Imminent: a calendar event starts within the next 2 hours → suggest
 *      preparing for it.
 *   2. Continuation: a note was edited in the last 24h → suggest opening it.
 *   3. Time-of-day fallback: morning → brief; afternoon → todos; evening →
 *      tomorrow prep; night → quiet shutdown.
 */
function buildJetztSuggestions(input: {
  events: FoyerEvent[];
  dueToday: number;
  eventRows: Awaited<ReturnType<typeof listCalendarEvents>>;
  recentNote: { id: string; title: string; updatedAt: Date } | null;
}): FoyerSuggestion[] {
  const out: FoyerSuggestion[] = [];
  const now = new Date();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  // 1. Imminent: next event within 2 hours
  const nextEvent = input.eventRows
    .slice()
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .find((e) => {
      const start = new Date(e.startsAt).getTime();
      return start > now.getTime() && start - now.getTime() <= twoHoursMs;
    });
  if (nextEvent) {
    const minsAway = Math.round(
      (new Date(nextEvent.startsAt).getTime() - now.getTime()) / 60_000
    );
    out.push({
      kind: nextEvent.linkedCustomerName ? 'Kunde' : 'Termin',
      icon: nextEvent.linkedCustomerName ? '◉' : '○',
      title: `Briefing für ${formatTime(new Date(nextEvent.startsAt))} ${nextEvent.title}`,
      context:
        minsAway <= 30
          ? `In ${minsAway} Minuten. Kurz vorbereiten?`
          : `In ${Math.round(minsAway / 60)}h. Notizen jetzt sammeln?`,
      href: nextEvent.linkedCustomerId
        ? `/kunden/${nextEvent.linkedCustomerId}`
        : `/kalender?event=${nextEvent.id}`,
    });
  }

  // 2. Continuation: recent note
  if (input.recentNote) {
    const hoursAgo =
      (Date.now() - new Date(input.recentNote.updatedAt).getTime()) / 3_600_000;
    if (hoursAgo < 48) {
      out.push({
        kind: 'Notiz',
        icon: '✎',
        title: input.recentNote.title,
        context:
          hoursAgo < 1
            ? 'Zuletzt vor wenigen Minuten dran. Weitermachen?'
            : hoursAgo < 24
              ? 'Heute schon dran gewesen. Weitermachen?'
              : 'Gestern dran gewesen. Schließen oder weiterführen?',
        href: `/notes/${input.recentNote.id}`,
      });
    }
  }

  // 3. Todos due today
  if (input.dueToday > 0) {
    out.push({
      kind: 'Todos',
      icon: '☐',
      title:
        input.dueToday === 1
          ? 'Ein Todo wartet heute auf dich'
          : `${input.dueToday} Todos fällig heute`,
      context: 'Schau dir die heutigen Items kurz an?',
      href: '/todos?view=today',
    });
  }

  // 4. Time-of-day fallback
  const mood = getMood(now);
  if (out.length === 0) {
    if (mood === 'morning' || mood === 'midday') {
      out.push({
        kind: 'Brief',
        icon: '☀',
        title: 'Tagesbrief vorlesen',
        context: 'Drei Minuten Überblick zum Start in den Tag.',
        href: '/todos/brief',
      });
    } else if (mood === 'evening') {
      out.push({
        kind: 'Plan',
        icon: '✎',
        title: 'Morgen vorbereiten',
        context: 'Wenige Notizen, was morgen früh wichtig wird.',
        href: '/notes',
      });
    } else if (mood === 'night') {
      out.push({
        kind: 'Inbox',
        icon: '✉',
        title: 'Inbox abschließen',
        context: 'Letzte Sachen wegklicken, dann ist Ruhe.',
        href: '/inbox',
      });
    } else {
      out.push({
        kind: 'Notiz',
        icon: '✎',
        title: 'Wochenrückblick',
        context: 'Was gut lief, was nicht — zehn Minuten Zeit.',
        href: '/notes',
      });
    }
  }

  // Always provide a "calm fallback" so "Anderes vorschlagen" has somewhere
  // to go even when only one suggestion was generated.
  if (out.length < 2) {
    out.push({
      kind: 'Brief',
      icon: '☀',
      title: 'Tagesbrief vorlesen',
      context: 'Drei Minuten Überblick — gesprochen.',
      href: '/todos/brief',
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function formatTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t < to.getTime();
}

/**
 * Single-line preview from a possibly-multi-line message body. Strips
 * markdown-ish prefixes and collapses whitespace, then truncates to ~120
 * chars (the row truncates further with CSS).
 */
function collapsePreview(body: string): string {
  const flat = body
    .replace(/\n+/g, ' ')
    .replace(/^[#>\-*\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > 140 ? flat.slice(0, 140) + '…' : flat;
}

function getMood(d: Date): 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' {
  const h = d.getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 13) return 'midday';
  if (h >= 13 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

// ───────────────────────────────────────────────────────────────
// Morgen-Plan → Foyer mapping
// ───────────────────────────────────────────────────────────────

// Locked-caps kicker per item kind (matches the inbox/plan vocabulary).
// Exported so the onboarding first-scan preview renders the EXACT same
// vocabulary + accent tokens as the foyer — one source of truth, no drift.
export const PLAN_KICKER: Record<PlanItem['kind'], string> = {
  commitment_overdue: 'Zusage · überfällig',
  commitment_due_today: 'Zusage · heute fällig',
  commitment_open: 'Zusage',
  reply_waiting: 'Braucht Antwort',
  event_today: 'Termin',
  todo_overdue: 'Todo · überfällig',
  todo_due_today: 'Todo · heute',
};

// Real theme tokens — sand/gold ONLY for the due/active signal, red for
// overdue, calm greys/blue/green otherwise. No new colours.
export function planAccent(kind: PlanItem['kind']): string {
  switch (kind) {
    case 'commitment_overdue':
    case 'todo_overdue':
      return '#ff8a8a';
    case 'commitment_due_today':
      return '#E8B86D'; // sand/gold — the one "fällig" highlight
    case 'reply_waiting':
      return '#5E9EFF';
    case 'event_today':
      return '#5ee08a';
    default:
      return '#9c9c9d';
  }
}

function toFoyerPlanItem(item: PlanItem): FoyerPlanItem {
  return {
    key: item.key,
    kicker: PLAN_KICKER[item.kind] ?? 'Heute',
    title: item.title,
    reason: item.reason,
    isQuestion: item.isQuestion,
    accent: planAccent(item.kind),
    href: item.href,
  };
}

// Maps the deterministic plan (Prompt 4) into the slim foyer slice: the most
// urgent item is the gold spike, the rest is the "Heute"-agenda, plus at most
// one collision insight. The plan's items are already prioritised + gated.
function toFoyerMorningPlan(plan: Awaited<ReturnType<typeof buildMorningPlan>>): FoyerMorningPlan {
  const mapped = plan.items.map(toFoyerPlanItem);
  // The spike is the single most urgent NON-question item (a tentative
  // "maybe a promise?" must never be asserted as the day's headline). Fall
  // back to the first item only if everything is a question.
  const spikeIdx = mapped.findIndex((m) => !m.isQuestion);
  const topIndex = spikeIdx >= 0 ? spikeIdx : mapped.length > 0 ? 0 : -1;
  const top = topIndex >= 0 ? mapped[topIndex] : null;
  const items = mapped.filter((_, i) => i !== topIndex);
  return {
    top,
    items,
    collision: plan.collisions[0]?.message ?? null,
    isCalm: plan.isCalm,
  };
}
