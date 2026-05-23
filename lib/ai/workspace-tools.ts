import 'server-only';
import { and, desc, eq, like, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

/**
 * Server-side tool implementations the AI assistant can call. Each returns
 * a compact JSON-serializable payload suitable for injection back into the
 * model's tool-result message.
 *
 * Important: every tool is workspace-scoped — the caller passes the active
 * workspaceId and tools never reach across workspaces. This keeps the model
 * honest and prevents data leaks across multi-tenant boundaries.
 */

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'searchCustomers',
    description:
      'Search the workspace customers by name or industry. Returns up to 5 matches with status and basic info.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term, can be partial name.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getCustomerDetail',
    description:
      'Fetch a single customer by ID. Returns name, status, last 5 recent messages from linked channels, active contracts and recent calendar events.',
    parameters: {
      type: 'object',
      properties: { customerId: { type: 'string' } },
      required: ['customerId'],
    },
  },
  {
    name: 'listRecentMessages',
    description:
      'List recent channel messages in the workspace. Optional channel filter. Returns up to 10 most recent.',
    parameters: {
      type: 'object',
      properties: {
        channelSlug: { type: 'string', description: 'Optional channel slug to scope the query.' },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'listContracts',
    description: 'List workspace contracts, optionally filtered by status (aktiv, auslaufend, vorlage, storniert).',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string' },
      },
    },
  },
  {
    name: 'getDailyBrief',
    description: 'Get the structured daily brief for today: overdue items, today-due items, silent customers, expiring contracts.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'searchNotes',
    description: 'Search the workspace notes by title. Returns up to 5 matches.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
];

export async function runTool(
  toolName: string,
  args: Record<string, any>,
  ctx: { workspaceId: string; userId: string }
): Promise<unknown> {
  const db = getDb();

  if (toolName === 'searchCustomers') {
    const q = String(args.query ?? '').toLowerCase();
    const rows = await db.query.customers.findMany({
      where: eq(s.customers.workspaceId, ctx.workspaceId),
      columns: { id: true, name: true, status: true, industry: true, notes: true },
    });
    return rows
      .filter((r) => r.name.toLowerCase().includes(q) || (r.industry ?? '').toLowerCase().includes(q))
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        industry: r.industry ?? null,
      }));
  }

  if (toolName === 'getCustomerDetail') {
    const customerId = String(args.customerId ?? '');
    const customer = await db.query.customers.findFirst({
      where: and(eq(s.customers.workspaceId, ctx.workspaceId), eq(s.customers.id, customerId)),
    });
    if (!customer) return { error: 'not-found' };

    const [contracts, activity, contacts] = await Promise.all([
      db.query.contracts.findMany({
        where: and(
          eq(s.contracts.workspaceId, ctx.workspaceId),
          eq(s.contracts.customerId, customer.id)
        ),
        columns: { id: true, title: true, status: true, valueCents: true, endsAt: true },
        orderBy: [desc(s.contracts.createdAt)],
        limit: 5,
      }),
      db.query.customerActivity.findMany({
        where: eq(s.customerActivity.customerId, customer.id),
        orderBy: [desc(s.customerActivity.occurredAt)],
        limit: 5,
      }),
      db.query.customerContacts.findMany({
        where: eq(s.customerContacts.customerId, customer.id),
        columns: { name: true, email: true, role: true },
      }),
    ]);

    return {
      id: customer.id,
      name: customer.name,
      status: customer.status,
      industry: customer.industry,
      contacts: contacts.map((c) => ({ name: c.name, email: c.email, role: c.role })),
      contracts: contracts.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        valueEur: c.valueCents ? Math.round(c.valueCents / 100) : null,
        endsAt: c.endsAt ? new Date(c.endsAt).toISOString() : null,
      })),
      recentActivity: activity.map((a) => ({
        kind: a.kind,
        at: new Date(a.occurredAt).toISOString(),
      })),
    };
  }

  if (toolName === 'listRecentMessages') {
    const slug = args.channelSlug ? String(args.channelSlug) : null;
    const limit = Math.min(20, Number(args.limit ?? 10));

    let channelIds: string[] = [];
    if (slug) {
      const ch = await db.query.channels.findFirst({
        where: and(eq(s.channels.workspaceId, ctx.workspaceId), eq(s.channels.slug, slug)),
        columns: { id: true },
      });
      if (ch) channelIds = [ch.id];
    } else {
      const cs = await db.query.channels.findMany({
        where: eq(s.channels.workspaceId, ctx.workspaceId),
        columns: { id: true },
      });
      channelIds = cs.map((c) => c.id);
    }
    if (channelIds.length === 0) return [];

    const messages = await db.query.messages.findMany({
      where: or(...channelIds.map((id) => eq(s.messages.channelId, id))),
      orderBy: [desc(s.messages.createdAt)],
      limit,
      with: { channel: { columns: { name: true, slug: true } } },
    });
    return messages.map((m: any) => ({
      channel: m.channel?.slug ?? null,
      body: m.body.slice(0, 280),
      at: new Date(m.createdAt).toISOString(),
    }));
  }

  if (toolName === 'listContracts') {
    const status = args.status ? String(args.status) : null;
    const all = await db.query.contracts.findMany({
      where: eq(s.contracts.workspaceId, ctx.workspaceId),
      orderBy: [desc(s.contracts.createdAt)],
      columns: { id: true, title: true, status: true, valueCents: true, startsAt: true, endsAt: true },
      limit: 20,
    });
    const filtered = status ? all.filter((c) => c.status === status) : all;
    return filtered.slice(0, 10).map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      valueEur: c.valueCents ? Math.round(c.valueCents / 100) : null,
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString() : null,
      endsAt: c.endsAt ? new Date(c.endsAt).toISOString() : null,
    }));
  }

  if (toolName === 'getDailyBrief') {
    const { listTodos } = await import('@/lib/db/queries/todos');
    const { listTodoGroups } = await import('@/lib/db/queries/todo-groups');
    const { buildBrief } = await import('@/lib/brief/build-script');
    const [todos, groups] = await Promise.all([
      listTodos(ctx.workspaceId, ctx.userId),
      listTodoGroups(ctx.workspaceId),
    ]);
    const brief = buildBrief({
      firstName: '',
      todos,
      groups,
      currentUserId: ctx.userId,
    });
    return brief;
  }

  if (toolName === 'searchNotes') {
    const q = String(args.query ?? '').toLowerCase();
    const all = await db.query.notes.findMany({
      where: eq(s.notes.workspaceId, ctx.workspaceId),
      columns: { id: true, title: true, icon: true, updatedAt: true },
      orderBy: [desc(s.notes.updatedAt)],
      limit: 50,
    });
    return all
      .filter((n) => n.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        title: n.title,
        icon: n.icon,
        updatedAt: new Date(n.updatedAt).toISOString(),
      }));
  }

  return { error: 'unknown-tool' };
}
