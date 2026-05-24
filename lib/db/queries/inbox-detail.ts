import 'server-only';
import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';

export type LinkedCustomer = {
  id: string;
  slug: string;
  name: string;
  status: string;
  initials: string;
  fromColor: string;
  toColor: string;
  openTodos: number;
  activeContracts: number;
  /** Which of the customer's contacts matched the email. Null when matched on customer-level. */
  matchedContact: { name: string; role: string | null; email: string } | null;
};

export type SenderHistoryItem = {
  id: string;
  subject: string | null;
  preview: string | null;
  receivedAt: string;
  isRead: boolean;
};

export type InboxDetailContext = {
  customer: LinkedCustomer | null;
  senderHistory: SenderHistoryItem[];
  customerTodos: { id: string; title: string; dueAt: string | null }[];
  customerNotes: { id: string; noteId: string; title: string }[];
};

/**
 * Auto-link the sender email to a customer (via customer_contacts.email)
 * and pull adjacent context — sender history within this workspace,
 * the customer's open todos and notes that mention them.
 *
 * All sub-queries swallow errors and return empty — the detail page
 * still renders if any one rail blows up.
 */
export async function loadInboxDetailContext(
  workspaceId: string,
  itemId: string,
  senderEmail: string | null
): Promise<InboxDetailContext> {
  const db = getDb();

  // Empty result is the no-match path. Many senders have no email
  // header at all (e.g. some calendar invites) — bail early so we
  // don't query for nothing.
  if (!senderEmail) {
    const history = await fetchSenderHistory(workspaceId, itemId, null);
    return { customer: null, senderHistory: history, customerTodos: [], customerNotes: [] };
  }

  // 1. Customer match via contacts.email (case-insensitive).
  const customer = await findCustomerByContactEmail(workspaceId, senderEmail);

  // 2. Other emails in inbox_items from the same address — useful even
  //    when there's no customer match.
  const history = await fetchSenderHistory(workspaceId, itemId, senderEmail);

  // 3. If we matched a customer, load their open todos + recent
  //    notes that mention them. Both queries are best-effort.
  let customerTodos: InboxDetailContext['customerTodos'] = [];
  let customerNotes: InboxDetailContext['customerNotes'] = [];
  if (customer) {
    customerTodos = await fetchCustomerOpenTodos(workspaceId, customer.id);
    customerNotes = await fetchCustomerMentioningNotes(workspaceId, customer.id);
  }

  return { customer, senderHistory: history, customerTodos, customerNotes };
}

async function findCustomerByContactEmail(
  workspaceId: string,
  email: string
): Promise<LinkedCustomer | null> {
  const db = getDb();
  // Join customers via customer_contacts. Lowercase compare on both
  // sides — Gmail headers preserve casing but contact records
  // typically don't.
  const rows = await db
    .select({
      id: s.customers.id,
      slug: s.customers.slug,
      name: s.customers.name,
      status: s.customers.status,
      initials: s.customers.initials,
      fromColor: s.customers.fromColor,
      toColor: s.customers.toColor,
      openTodos: s.customers.cachedOpenTodoCount,
      activeContracts: s.customers.cachedActiveContractCount,
      contactName: s.customerContacts.name,
      contactRole: s.customerContacts.role,
      contactEmail: s.customerContacts.email,
    })
    .from(s.customerContacts)
    .innerJoin(s.customers, eq(s.customers.id, s.customerContacts.customerId))
    .where(
      and(
        eq(s.customers.workspaceId, workspaceId),
        sql`LOWER(${s.customerContacts.email}) = LOWER(${email})`
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    initials: row.initials,
    fromColor: row.fromColor,
    toColor: row.toColor,
    openTodos: row.openTodos ?? 0,
    activeContracts: row.activeContracts ?? 0,
    matchedContact: {
      name: row.contactName,
      role: row.contactRole,
      email: row.contactEmail ?? email,
    },
  };
}

async function fetchSenderHistory(
  workspaceId: string,
  excludeItemId: string,
  senderEmail: string | null
): Promise<SenderHistoryItem[]> {
  if (!senderEmail) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: s.inboxItems.id,
      subject: s.inboxItems.subject,
      preview: s.inboxItems.preview,
      receivedAt: s.inboxItems.receivedAt,
      isRead: s.inboxItems.isRead,
    })
    .from(s.inboxItems)
    .where(
      and(
        eq(s.inboxItems.workspaceId, workspaceId),
        ne(s.inboxItems.id, excludeItemId),
        sql`LOWER(${s.inboxItems.senderEmail}) = LOWER(${senderEmail})`
      )
    )
    .orderBy(desc(s.inboxItems.receivedAt))
    .limit(5);
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    preview: r.preview,
    receivedAt: new Date(r.receivedAt).toISOString(),
    isRead: r.isRead,
  }));
}

async function fetchCustomerOpenTodos(
  workspaceId: string,
  customerId: string
): Promise<{ id: string; title: string; dueAt: string | null }[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: s.todos.id,
        title: s.todos.title,
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
      .limit(4);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Look up which gmail message ids we already have synced into
 * inbox_items, returning a sparse map id → local inbox_item id. Used
 * by the thread strip to render links into our own /inbox/[id] routes
 * where possible, and "open in Gmail" links for messages we haven't
 * synced (sent mail, older history, etc.).
 */
export async function resolveSyncedGmailIds(
  workspaceId: string,
  gmailIds: string[]
): Promise<Map<string, string>> {
  if (gmailIds.length === 0) return new Map();
  try {
    const db = getDb();
    const rows = await db
      .select({
        sourceId: s.inboxItems.sourceId,
        localId: s.inboxItems.id,
      })
      .from(s.inboxItems)
      .where(
        and(
          eq(s.inboxItems.workspaceId, workspaceId),
          eq(s.inboxItems.sourceType, 'email_gmail'),
          inArray(s.inboxItems.sourceId, gmailIds)
        )
      );
    const out = new Map<string, string>();
    for (const r of rows) out.set(r.sourceId, r.localId);
    return out;
  } catch {
    return new Map();
  }
}

async function fetchCustomerMentioningNotes(
  workspaceId: string,
  customerId: string
): Promise<{ id: string; noteId: string; title: string }[]> {
  try {
    const db = getDb();
    // Join through note_mentions where mention_type='customer'
    // and mention_id matches. Filter to workspace's notes only.
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
      .limit(3);
    return rows;
  } catch {
    return [];
  }
}
