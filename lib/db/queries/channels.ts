import 'server-only';
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import { formatCents } from '../format';
import type {
  Channel,
  ChannelEntityHit,
  ChannelGroup,
  ChannelHealth,
  ChannelLinkedCustomer,
  ChannelLinkedDeal,
  ChannelMemberDetail,
  ChannelPinnedItem,
  ChannelSnippet,
  Message,
} from '@/lib/types';

const DAY_MS = 86_400_000;
const HOUR_MS = 60 * 60 * 1000;

export async function listChannels(workspaceId: string): Promise<Channel[]> {
  const db = getDb();
  const rows = await db.query.channels.findMany({
    where: and(eq(s.channels.workspaceId, workspaceId), isNull(s.channels.archivedAt)),
    orderBy: [asc(s.channels.name)],
    with: {
      members: { with: { user: true } },
    },
  });
  if (rows.length === 0) return [];

  // Batch fetch latest message + count of unread per channel
  const ids = rows.map((r) => r.id);
  const lastMessages = await db
    .select({
      channelId: s.messages.channelId,
      createdAt: sql<Date>`MAX(${s.messages.createdAt})`,
    })
    .from(s.messages)
    .where(inArray(s.messages.channelId, ids))
    .groupBy(s.messages.channelId);
  const lastByChannel = new Map<string, Date>();
  for (const m of lastMessages) lastByChannel.set(m.channelId, new Date(m.createdAt as any));

  return rows.map((r) => toChannel(r, lastByChannel.get(r.id)));
}

export async function getChannelBySlug(
  workspaceId: string,
  slug: string
): Promise<Channel | null> {
  const db = getDb();
  const row = await db.query.channels.findFirst({
    where: and(eq(s.channels.workspaceId, workspaceId), eq(s.channels.slug, slug)),
    with: {
      members: { with: { user: true } },
    },
  });
  if (!row) return null;
  return toChannel(row);
}

export async function getChannelFullBySlug(
  workspaceId: string,
  slug: string
): Promise<Channel | null> {
  const db = getDb();
  const row = await db.query.channels.findFirst({
    where: and(eq(s.channels.workspaceId, workspaceId), eq(s.channels.slug, slug)),
    with: {
      members: { with: { user: true } },
      pinnedItems: { orderBy: [asc(s.channelPinnedItems.position)] },
    },
  });
  if (!row) return null;
  const base = toChannel(row);

  // Linked customer
  const cc = await db
    .select({ customerId: s.customerChannels.customerId })
    .from(s.customerChannels)
    .where(eq(s.customerChannels.channelId, row.id))
    .limit(1);
  let linkedCustomer: ChannelLinkedCustomer | undefined;
  if (cc.length > 0) {
    const cust = await db.query.customers.findFirst({
      where: eq(s.customers.id, cc[0].customerId),
    });
    if (cust) {
      // Compute simple MRC
      const contracts = await db.query.contracts.findMany({
        where: and(
          eq(s.contracts.workspaceId, workspaceId),
          eq(s.contracts.customerId, cust.id),
          sql`${s.contracts.status} = 'aktiv'`
        ),
        columns: { valueCents: true },
      });
      const mrcCents = contracts.reduce((a, c) => a + (c.valueCents ?? 0), 0);
      linkedCustomer = {
        id: cust.id,
        slug: cust.slug,
        name: cust.name,
        initials: cust.initials,
        from: cust.fromColor,
        to: cust.toColor,
        status: cust.status,
        mrcCents,
      };
    }
  }

  // Pinned items
  const pinned: ChannelPinnedItem[] = (row as any).pinnedItems.map((p: any) => ({
    id: p.id,
    kind: p.kind,
    label: p.label,
    targetId: p.targetId ?? undefined,
    url: p.url ?? undefined,
    position: p.position,
    pinnedAt: p.pinnedAt.toISOString(),
  }));

  // Linked deals — contracts linked to this channel's customer
  let linkedDeals: ChannelLinkedDeal[] = [];
  if (linkedCustomer?.id) {
    const contracts = await db.query.contracts.findMany({
      where: and(
        eq(s.contracts.workspaceId, workspaceId),
        eq(s.contracts.customerId, linkedCustomer.id)
      ),
      orderBy: [desc(s.contracts.createdAt)],
      columns: { id: true, externalId: true, title: true, status: true, valueCents: true },
      limit: 8,
    });
    linkedDeals = contracts.map((c) => ({
      id: c.externalId ?? c.id,
      title: c.title,
      status: c.status,
      value: formatCents(c.valueCents ?? 0),
    }));
  }

  // Channel health
  const health = await getChannelHealth(row.id);

  return {
    ...base,
    linkedCustomer,
    pinned,
    linkedDeals,
    health,
  };
}

export async function listChannelMessages(channelId: string): Promise<Message[]> {
  const db = getDb();
  // Tombstoned messages (deletedAt set) are hidden from listings. The
  // row stays in the DB so threads + reactions keep their anchor — when
  // we add a "Diese Nachricht wurde gelöscht" placeholder UI we'll
  // surface them again with the tombstone marker.
  const tops = await db.query.messages.findMany({
    where: and(
      eq(s.messages.channelId, channelId),
      isNull(s.messages.parentId),
      isNull(s.messages.deletedAt)
    ),
    orderBy: [asc(s.messages.createdAt)],
    with: { author: true, reactions: true },
  });

  const topIds = tops.map((t) => t.id);
  const replies = topIds.length
    ? await db.query.messages.findMany({
        where: and(
          inArray(s.messages.parentId, topIds),
          isNull(s.messages.deletedAt)
        ),
        orderBy: [asc(s.messages.createdAt)],
        with: { author: true },
      })
    : [];

  const byParent = new Map<string, Message[]>();
  for (const r of replies) {
    const arr = byParent.get(r.parentId!) ?? [];
    arr.push(toMessage(r));
    byParent.set(r.parentId!, arr);
  }

  const reactionsByMsg = new Map<string, { emoji: string; count: number }[]>();
  for (const t of tops) {
    if (!t.reactions || t.reactions.length === 0) continue;
    const counted = new Map<string, number>();
    for (const r of t.reactions) counted.set(r.emoji, (counted.get(r.emoji) ?? 0) + 1);
    reactionsByMsg.set(
      t.id,
      [...counted.entries()].map(([emoji, count]) => ({ emoji, count }))
    );
  }

  // Resolve reply-to targets in a single batched lookup. Targets may be
  // tombstoned — we still surface them (deleted=true) so the reply isn't
  // silently orphaned in the UI.
  const replyTargetIds = Array.from(
    new Set(tops.map((t) => t.replyToId).filter((id): id is string => !!id))
  );
  const replyTargets = replyTargetIds.length
    ? await db.query.messages.findMany({
        where: inArray(s.messages.id, replyTargetIds),
        with: { author: true },
      })
    : [];
  const replyById = new Map(replyTargets.map((m: any) => [m.id, m]));

  return tops.map((t: any) => {
    const target = t.replyToId ? replyById.get(t.replyToId) : undefined;
    return {
      ...toMessage(t),
      reactions: reactionsByMsg.get(t.id),
      threadReplies: byParent.get(t.id) ?? [],
      replyTo: target ? toReplyTarget(target) : undefined,
    };
  });
}

function toReplyTarget(row: any) {
  const deleted = !!row.deletedAt;
  const raw = (row.body ?? '').replace(/\s+/g, ' ').trim();
  const preview = deleted ? null : raw.length > 140 ? raw.slice(0, 140) + '…' : raw;
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.author?.name ?? 'Unbekannt',
    authorInitials: row.author?.initials ?? '?',
    authorFrom: row.author?.avatarFrom ?? '#5eb6ff',
    authorTo: row.author?.avatarTo ?? '#0369a1',
    bodyPreview: preview,
    deleted,
  };
}

export async function getChannelIdBySlug(
  workspaceId: string,
  slug: string
): Promise<string | null> {
  const db = getDb();
  const row = await db.query.channels.findFirst({
    where: and(eq(s.channels.workspaceId, workspaceId), eq(s.channels.slug, slug)),
    columns: { id: true },
  });
  return row?.id ?? null;
}

// ─── Channel Health ──────────────────────────────────────────
export async function getChannelHealth(channelId: string): Promise<ChannelHealth> {
  const db = getDb();
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const since7 = new Date(now.getTime() - 6 * DAY_MS);
  since7.setHours(0, 0, 0, 0);

  // 7-day spark
  const sparkRows = await db.execute<{ day: string; n: number | string }>(sql`
    SELECT DATE_TRUNC('day', ${s.messages.createdAt})::text AS day, COUNT(*) AS n
    FROM ${s.messages}
    WHERE ${s.messages.channelId} = ${channelId}
      AND ${s.messages.createdAt} >= ${since7}
    GROUP BY day
  `);
  const sparkList: any[] = Array.isArray((sparkRows as any).rows)
    ? (sparkRows as any).rows
    : (sparkRows as any);
  const spark: number[] = Array.from({ length: 7 }, () => 0);
  for (const r of sparkList) {
    const d = new Date(r.day);
    d.setHours(0, 0, 0, 0);
    const idx = Math.floor((d.getTime() - since7.getTime()) / DAY_MS);
    if (idx >= 0 && idx < 7) spark[idx] = Number(r.n);
  }

  // Thread response — for top-level messages in last 30d that have at least 1 reply,
  // compute time to first reply (median) and count of stale threads (no reply in 3d)
  const tops = await db.query.messages.findMany({
    where: and(
      eq(s.messages.channelId, channelId),
      isNull(s.messages.parentId),
      sql`${s.messages.createdAt} >= ${since30}`
    ),
    columns: { id: true, createdAt: true },
  });
  if (tops.length === 0) {
    return { score: 50, responseRate: 0, staleThreadCount: 0, spark };
  }
  const topIds = tops.map((t) => t.id);
  const firstReplies = await db.execute<{ parent_id: string; first: Date }>(sql`
    SELECT parent_id, MIN(created_at) AS first
    FROM ${s.messages}
    WHERE parent_id = ANY(${sql.raw(`ARRAY[${topIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})
    GROUP BY parent_id
  `);
  const firstList: any[] = Array.isArray((firstReplies as any).rows)
    ? (firstReplies as any).rows
    : (firstReplies as any);
  const firstByParent = new Map<string, Date>();
  for (const r of firstList) firstByParent.set(r.parent_id, new Date(r.first));

  let totalReplyTimes: number[] = [];
  let stale = 0;
  let respondedCount = 0;
  const staleThresholdMs = 3 * DAY_MS;
  for (const t of tops) {
    const first = firstByParent.get(t.id);
    if (first) {
      respondedCount += 1;
      totalReplyTimes.push(first.getTime() - t.createdAt.getTime());
    } else if (now.getTime() - t.createdAt.getTime() > staleThresholdMs) {
      stale += 1;
    }
  }
  totalReplyTimes.sort((a, b) => a - b);
  const medianMs = totalReplyTimes.length > 0 ? totalReplyTimes[Math.floor(totalReplyTimes.length / 2)] : null;
  const medianMin = medianMs != null ? Math.round(medianMs / 60_000) : undefined;
  const responseRate = tops.length > 0 ? respondedCount / tops.length : 0;

  // Score 0-100
  let score = 0;
  score += responseRate * 50; // 0-50
  if (medianMin != null) {
    if (medianMin <= 30) score += 30;
    else if (medianMin <= 120) score += 20;
    else if (medianMin <= 24 * 60) score += 10;
  }
  // Volume contribution (max 20 if avg >=3 msg/day)
  const total7d = spark.reduce((a, b) => a + b, 0);
  if (total7d >= 21) score += 20;
  else if (total7d >= 7) score += 15;
  else if (total7d >= 3) score += 10;
  else if (total7d > 0) score += 5;
  // Stale penalty
  score -= Math.min(20, stale * 4);

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    responseRate,
    medianFirstReplyMinutes: medianMin,
    staleThreadCount: stale,
    spark,
  };
}

// ─── Detect entity mentions in text ─────────────────────────
export async function detectEntityHits(
  workspaceId: string,
  text: string
): Promise<ChannelEntityHit[]> {
  const db = getDb();
  const lower = text.toLowerCase();
  const hits: ChannelEntityHit[] = [];
  const seen = new Set<string>();

  // Plates: pattern like "MV-AB 1234" or "B-CD 12" — uppercase letters + numbers
  const plateMatches = text.match(/[A-ZÄÖÜ]{1,3}[\s-][A-ZÄÖÜ]{1,2}\s?\d{1,4}/g) ?? [];
  if (plateMatches.length) {
    const vehicles = await db.query.vehicles.findMany({
      where: eq(s.vehicles.workspaceId, workspaceId),
      columns: { id: true, externalId: true, plate: true, model: true },
    });
    for (const m of plateMatches) {
      const normalized = m.replace(/\s+/g, ' ').trim().toUpperCase();
      const found = vehicles.find(
        (v) => v.plate.toUpperCase().replace(/\s+/g, ' ') === normalized
      );
      if (found && !seen.has(`v:${found.id}`)) {
        seen.add(`v:${found.id}`);
        hits.push({
          kind: 'vehicle',
          matchText: m,
          targetId: found.id,
          label: `${found.plate} · ${found.model}`,
          href: `/flotte/${found.externalId ?? found.id}`,
        });
      }
    }
  }

  // Customers + contracts: look at all of them and substring-match the message
  const customers = await db.query.customers.findMany({
    where: eq(s.customers.workspaceId, workspaceId),
    columns: { id: true, slug: true, name: true },
  });
  for (const c of customers) {
    if (c.name.length < 3) continue;
    if (lower.includes(c.name.toLowerCase()) && !seen.has(`c:${c.id}`)) {
      seen.add(`c:${c.id}`);
      hits.push({
        kind: 'customer',
        matchText: c.name,
        targetId: c.id,
        label: c.name,
        href: `/kunden/${c.slug}`,
      });
    }
  }

  const contracts = await db.query.contracts.findMany({
    where: eq(s.contracts.workspaceId, workspaceId),
    columns: { id: true, externalId: true, title: true },
  });
  for (const c of contracts) {
    if (c.title.length < 4) continue;
    if (lower.includes(c.title.toLowerCase()) && !seen.has(`k:${c.id}`)) {
      seen.add(`k:${c.id}`);
      hits.push({
        kind: 'contract',
        matchText: c.title,
        targetId: c.id,
        label: c.title,
        href: `/vertraege/${c.externalId ?? c.id}`,
      });
    }
  }

  return hits.slice(0, 8);
}

// ─── Customer-contact emails for highlight ──────────────────
export async function getCustomerContactEmails(
  workspaceId: string
): Promise<Map<string, { customerId: string; customerName: string }>> {
  const db = getDb();
  const rows = await db
    .select({
      email: s.customerContacts.email,
      customerId: s.customers.id,
      customerName: s.customers.name,
    })
    .from(s.customerContacts)
    .innerJoin(s.customers, eq(s.customerContacts.customerId, s.customers.id))
    .where(and(eq(s.customers.workspaceId, workspaceId), isNotNull(s.customerContacts.email)));
  const out = new Map<string, { customerId: string; customerName: string }>();
  for (const r of rows) {
    if (r.email) out.set(r.email.toLowerCase(), { customerId: r.customerId, customerName: r.customerName });
  }
  return out;
}

// ─── Snippets ───────────────────────────────────────────────
export async function listChannelSnippets(workspaceId: string): Promise<ChannelSnippet[]> {
  const db = getDb();
  const rows = await db.query.channelSnippets.findMany({
    where: eq(s.channelSnippets.workspaceId, workspaceId),
    orderBy: [asc(s.channelSnippets.title)],
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── Smart counts ───────────────────────────────────────────
export async function smartChannelCounts(workspaceId: string, userId: string) {
  const db = getDb();
  const allChannels = await db.query.channels.findMany({
    where: and(eq(s.channels.workspaceId, workspaceId), isNull(s.channels.archivedAt)),
    columns: { id: true, kind: true, dealStage: true },
  });
  // Member rows for this user
  const membership = await db.query.channelMembers.findMany({
    where: eq(s.channelMembers.userId, userId),
  });
  const memberMap = new Map(membership.map((m) => [m.channelId, m.lastReadAt]));

  // Count unread per channel: messages.createdAt > lastReadAt (or null)
  const channelIds = allChannels.map((c) => c.id);
  let unreadByChannel = new Map<string, number>();
  if (channelIds.length > 0) {
    const counts = await db.execute<{ channel_id: string; n: number | string }>(sql`
      SELECT m.channel_id, COUNT(*) AS n
      FROM ${s.messages} m
      LEFT JOIN ${s.channelMembers} cm
        ON cm.channel_id = m.channel_id AND cm.user_id = ${userId}
      WHERE m.channel_id = ANY(${sql.raw(`ARRAY[${channelIds.map((id) => `'${id}'`).join(',')}]::uuid[]`)})
        AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
        AND m.author_id != ${userId}
        AND m.deleted_at IS NULL
      GROUP BY m.channel_id
    `);
    const cList: any[] = Array.isArray((counts as any).rows) ? (counts as any).rows : (counts as any);
    for (const r of cList) unreadByChannel.set(r.channel_id, Number(r.n));
  }

  let total = allChannels.length;
  let unread = 0;
  let mine = 0;
  const byKind: Record<string, number> = {};
  for (const c of allChannels) {
    if ((unreadByChannel.get(c.id) ?? 0) > 0) unread += 1;
    if (memberMap.has(c.id)) mine += 1;
    byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
  }
  return { total, unread, mine, byKind, unreadByChannel: Object.fromEntries(unreadByChannel) };
}

// ─── Cross-channel search ───────────────────────────────────
export async function searchMessages(
  workspaceId: string,
  query: string,
  limit = 30
): Promise<
  {
    id: string;
    body: string;
    channelId: string;
    channelSlug: string;
    channelName: string;
    authorName: string;
    authorInitials: string;
    createdAt: string;
  }[]
> {
  if (!query.trim()) return [];
  const db = getDb();
  const pattern = `%${query.trim()}%`;
  const rows = await db
    .select({
      id: s.messages.id,
      body: s.messages.body,
      channelId: s.messages.channelId,
      channelSlug: s.channels.slug,
      channelName: s.channels.name,
      authorName: s.users.name,
      authorInitials: s.users.initials,
      createdAt: s.messages.createdAt,
    })
    .from(s.messages)
    .innerJoin(s.channels, eq(s.messages.channelId, s.channels.id))
    .innerJoin(s.users, eq(s.messages.authorId, s.users.id))
    .where(
      and(
        eq(s.channels.workspaceId, workspaceId),
        sql`${s.messages.body} ILIKE ${pattern}`
      )
    )
    .orderBy(desc(s.messages.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listChannelGroups(workspaceId: string): Promise<ChannelGroup[]> {
  const db = getDb();
  const rows = await db.query.channelGroups.findMany({
    where: eq(s.channelGroups.workspaceId, workspaceId),
    orderBy: [asc(s.channelGroups.position), asc(s.channelGroups.createdAt)],
  });
  return rows.map((r: any) => ({ id: r.id, name: r.name, position: r.position }));
}

export async function listChannelMembersDetailed(
  workspaceId: string,
  channelId: string
): Promise<ChannelMemberDetail[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: s.channelMembers.userId,
      name: s.users.name,
      email: s.users.email,
      role: s.workspaceMembers.role,
      joinedAt: s.channelMembers.joinedAt,
    })
    .from(s.channelMembers)
    .innerJoin(s.users, eq(s.channelMembers.userId, s.users.id))
    .innerJoin(
      s.workspaceMembers,
      and(
        eq(s.workspaceMembers.userId, s.channelMembers.userId),
        eq(s.workspaceMembers.workspaceId, workspaceId)
      )
    )
    .where(eq(s.channelMembers.channelId, channelId))
    .orderBy(asc(s.channelMembers.joinedAt));
  return rows.map((r: any) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    role: r.role,
    joinedAt: r.joinedAt.toISOString(),
  }));
}

// ─── Helpers ────────────────────────────────────────────────
function toChannel(row: any, lastMessageAt?: Date): Channel {
  const memberRows = row.members ?? [];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    topic: row.topic ?? '',
    kind: row.kind ?? 'general',
    dealStage: row.dealStage ?? undefined,
    members: memberRows.length,
    unread: 0,
    pinned: [],
    linkedDeals: [],
    membersPreview: memberRows.slice(0, 6).map((m: any) => ({
      name: m.user.name,
      initials: m.user.initials,
      from: m.user.avatarFrom,
      to: m.user.avatarTo,
      online: false,
    })),
    dealRadar: [],
    connectedChannels: [],
    lastMessageAt: lastMessageAt?.toISOString(),
    archived: !!row.archivedAt,
    groupId: row.groupId ?? null,
  };
}

function toMessage(row: any): Message {
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.author?.name ?? 'Unbekannt',
    authorInitials: row.author?.initials ?? '?',
    authorFrom: row.author?.avatarFrom ?? '#5eb6ff',
    authorTo: row.author?.avatarTo ?? '#0369a1',
    timestamp: row.createdAt.toISOString(),
    body: row.body,
    editedAt: row.editedAt ? row.editedAt.toISOString() : undefined,
  };
}
