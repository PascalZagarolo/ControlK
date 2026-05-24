import 'server-only';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type PersonProfile = {
  email: string;
  /** Best-effort display name — picks the most-recent non-empty name we've seen. */
  displayName: string;
  customer: ProfileCustomer | null;
  emails: PersonEmail[];
  todos: ProfileTodo[];
  notes: ProfileNote[];
  stats: ProfileStats;
};

export type ProfileCustomer = {
  id: string;
  name: string;
  slug: string;
  status: string;
  initials: string;
  fromColor: string;
  toColor: string;
  openTodos: number;
  activeContracts: number;
  contactRole: string | null;
};

export type PersonEmail = {
  id: string;
  direction: 'inbox' | 'sent';
  subject: string | null;
  preview: string | null;
  receivedAt: string;
  isRead: boolean;
  isArchived: boolean;
  awaitsTheirReply: boolean;
};

export type ProfileTodo = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
};

export type ProfileNote = {
  id: string;
  title: string;
};

export type ProfileStats = {
  totalMessages: number;
  unreadFromThem: number;
  awaitingFromYou: number;
  /** Time since the most recent message either direction, or null if none. */
  lastTouchpointAt: string | null;
};

/**
 * Aggregates everything tied to an email address into one profile:
 * email history (both directions), linked customer + their open
 * artifacts, plus a few counts. The email is the identity key —
 * matches a customer when contact.email aligns, otherwise the page
 * still renders as a "person we have a history with".
 *
 * All sub-queries swallow errors and degrade gracefully so the page
 * never throws on a single missing piece.
 */
export async function getPersonProfile(
  workspaceId: string,
  email: string
): Promise<PersonProfile> {
  const normalized = email.trim().toLowerCase();

  const [emails, customer, displayName] = await Promise.all([
    fetchEmails(workspaceId, normalized).catch(() => []),
    fetchCustomerByEmail(workspaceId, normalized).catch(() => null),
    fetchBestDisplayName(workspaceId, normalized).catch(() => ''),
  ]);

  // Customer-derived rails: only fetched when we have a customer match.
  const [todos, notes] = customer
    ? await Promise.all([
        fetchCustomerOpenTodos(workspaceId, customer.id).catch(() => []),
        fetchCustomerMentioningNotes(workspaceId, customer.id).catch(() => []),
      ])
    : [[], []];

  return {
    email: normalized,
    displayName: displayName || customer?.name || normalized,
    customer,
    emails,
    todos,
    notes,
    stats: computeStats(emails),
  };
}

function computeStats(emails: PersonEmail[]): ProfileStats {
  let unread = 0;
  let awaiting = 0;
  let latest = 0;
  for (const e of emails) {
    const ts = new Date(e.receivedAt).getTime();
    if (ts > latest) latest = ts;
    if (e.direction === 'inbox' && !e.isRead) unread += 1;
    if (e.direction === 'sent' && e.awaitsTheirReply) awaiting += 1;
  }
  return {
    totalMessages: emails.length,
    unreadFromThem: unread,
    awaitingFromYou: awaiting,
    lastTouchpointAt: latest ? new Date(latest).toISOString() : null,
  };
}

async function fetchEmails(
  workspaceId: string,
  email: string
): Promise<PersonEmail[]> {
  const db = getDb();
  // Either side: emails FROM this person OR TO this person. We cap at
  // 100 for the timeline; deeper history would need its own pagination
  // affordance.
  const rows = await db
    .select({
      id: s.inboxItems.id,
      direction: s.inboxItems.direction,
      subject: s.inboxItems.subject,
      preview: s.inboxItems.preview,
      receivedAt: s.inboxItems.receivedAt,
      isRead: s.inboxItems.isRead,
      isArchived: s.inboxItems.isArchived,
      awaitsTheirReply: s.inboxItems.awaitsTheirReply,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        or(
          sql`lower(${s.inboxItems.senderEmail}) = ${email}`,
          sql`lower(${s.inboxItems.recipientEmail}) = ${email}`
        )
      )
    )
    .orderBy(asc(s.inboxItems.receivedAt))
    .limit(100);
  return rows.map<PersonEmail>((r) => ({
    id: r.id,
    direction: r.direction,
    subject: r.subject,
    preview: r.preview,
    receivedAt: new Date(r.receivedAt).toISOString(),
    isRead: r.isRead,
    isArchived: r.isArchived,
    awaitsTheirReply: r.awaitsTheirReply,
  }));
}

async function fetchCustomerByEmail(
  workspaceId: string,
  email: string
): Promise<ProfileCustomer | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: s.customers.id,
      name: s.customers.name,
      slug: s.customers.slug,
      status: s.customers.status,
      initials: s.customers.initials,
      fromColor: s.customers.fromColor,
      toColor: s.customers.toColor,
      openTodos: s.customers.cachedOpenTodoCount,
      activeContracts: s.customers.cachedActiveContractCount,
      contactRole: s.customerContacts.role,
    })
    .from(s.customerContacts)
    .innerJoin(s.customers, eq(s.customers.id, s.customerContacts.customerId))
    .where(
      and(
        eq(s.customers.workspaceId, workspaceId),
        sql`lower(${s.customerContacts.email}) = ${email}`
      )
    )
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    status: r.status,
    initials: r.initials,
    fromColor: r.fromColor,
    toColor: r.toColor,
    openTodos: r.openTodos ?? 0,
    activeContracts: r.activeContracts ?? 0,
    contactRole: r.contactRole,
  };
}

// Best-effort display name resolution: pick the most recent non-empty
// senderName from inbox rows. Sent rows use the recipient's name from
// their To-header, which we don't capture separately — that's why we
// fall back to the customer name when sender history is sent-only.
async function fetchBestDisplayName(
  workspaceId: string,
  email: string
): Promise<string> {
  const db = getDb();
  const rows = await db
    .select({ senderName: s.inboxItems.senderName })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        sql`lower(${s.inboxItems.senderEmail}) = ${email}`
      )
    )
    .orderBy(desc(s.inboxItems.receivedAt))
    .limit(1);
  return rows[0]?.senderName ?? '';
}

async function fetchCustomerOpenTodos(
  workspaceId: string,
  customerId: string
): Promise<ProfileTodo[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: s.todos.id,
      title: s.todos.title,
      status: s.todos.status,
      dueAt: s.todos.dueAt,
    })
    .from(s.todos)
    .where(
      and(
        eq(s.todos.workspaceId, workspaceId),
        eq(s.todos.customerId, customerId),
        or(eq(s.todos.status, 'offen'), eq(s.todos.status, 'in_arbeit'))
      )
    )
    .orderBy(desc(s.todos.createdAt))
    .limit(8);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
  }));
}

async function fetchCustomerMentioningNotes(
  workspaceId: string,
  customerId: string
): Promise<ProfileNote[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: s.noteMentions.id,
      noteId: s.notes.id,
      title: s.notes.title,
    })
    .from(s.noteMentions)
    .innerJoin(s.notes, eq(s.notes.id, s.noteMentions.noteId))
    .where(
      and(
        eq(s.notes.workspaceId, workspaceId),
        isNull(s.notes.archivedAt),
        eq(s.noteMentions.mentionType, 'customer'),
        eq(s.noteMentions.mentionId, customerId)
      )
    )
    .orderBy(desc(s.noteMentions.createdAt))
    .limit(5);
  return rows.map((r) => ({
    id: r.noteId,
    title: r.title,
  }));
}
