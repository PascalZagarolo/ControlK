import 'server-only';
import { and, desc, eq, gt, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { listCalendarEvents } from '@/lib/db/queries/calendar';
import { listChannels } from '@/lib/db/queries/channels';
import { listTodos } from '@/lib/db/queries/todos';
import { listNotifications } from '@/lib/db/queries/notifications';
import type {
  FoyerData,
  FoyerEvent,
  FoyerLatestMessage,
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
}): Promise<FoyerData> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday.getTime() + DAY_MS);
  const startOfWeekFromToday = new Date(startOfToday.getTime() + 7 * DAY_MS);

  // Parallelize the safe queries
  const [eventRows, channels, todos, notifications, latestMessage, recentNote] =
    await Promise.all([
      listCalendarEvents(input.workspaceId, startOfToday, startOfTomorrow).catch(
        () => [] as Awaited<ReturnType<typeof listCalendarEvents>>
      ),
      listChannels(input.workspaceId).catch(() => []),
      listTodos(input.workspaceId, input.userId).catch(() => []),
      listNotifications(input.userId, 50).catch(() => []),
      fetchLatestUnreadMessage(input.workspaceId, input.userId).catch(() => null),
      fetchMostRecentNote(input.workspaceId).catch(() => null),
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
  const unreadEmail = 0; // not yet wired — gated on inbound-email integration
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

  return {
    userName: input.userName,
    events,
    unread: unreadTotal,
    email: unreadEmail,
    channels: unreadChannels,
    mentions: unreadMentions,
    latestMessage,
    dueToday,
    dueWeek,
    dueTomorrow,
    jetztSuggestions,
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
