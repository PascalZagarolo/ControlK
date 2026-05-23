import 'server-only';
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { getDb } from '../client';
import * as s from '../schema';
import type {
  Todo,
  TodoActivityEntry,
  TodoBlocker,
  TodoComment,
  TodoContextStrip,
  TodoForecastImpact,
  TodoLink,
  TodoStatus,
  TodoSubtask,
  TodoUser,
} from '@/lib/types';

function toUser(row: any): TodoUser {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    from: row.avatarFrom,
    to: row.avatarTo,
  };
}

function toLink(row: any): TodoLink {
  return {
    customer: row.customer
      ? { id: row.customer.id, slug: row.customer.slug, name: row.customer.name }
      : undefined,
    contract: row.contract
      ? {
          id: row.contract.id,
          externalId: row.contract.externalId ?? row.contract.id,
          title: row.contract.title,
        }
      : undefined,
    vehicle: row.vehicle
      ? {
          id: row.vehicle.id,
          externalId: row.vehicle.externalId ?? row.vehicle.id,
          plate: row.vehicle.plate,
          model: row.vehicle.model,
        }
      : undefined,
    channel: row.channel
      ? { id: row.channel.id, slug: row.channel.slug, name: row.channel.name }
      : undefined,
  };
}

function toSubtasks(rows: any[]): TodoSubtask[] {
  return rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ id: r.id, title: r.title, done: r.done === 1, position: r.position }));
}

function toComments(rows: any[]): TodoComment[] {
  return rows.map((r) => ({
    id: r.id,
    authorId: r.authorId,
    authorName: r.author?.name ?? '—',
    authorInitials: r.author?.initials ?? '?',
    authorFrom: r.author?.avatarFrom ?? '#5eb6ff',
    authorTo: r.author?.avatarTo ?? '#0369a1',
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  }));
}

function toActivity(rows: any[]): TodoActivityEntry[] {
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    actorName: r.actor?.name,
    actorInitials: r.actor?.initials,
    actorFrom: r.actor?.avatarFrom,
    actorTo: r.actor?.avatarTo,
    payload: r.payload ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

function toTodo(row: any): Todo {
  const subtasks = toSubtasks(row.subtasks ?? []);
  const comments = toComments(row.comments ?? []);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority,
    visibility: row.visibility,
    dueAt: row.dueAt ? row.dueAt.toISOString() : undefined,
    completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
    snoozeUntil: row.snoozeUntil ? row.snoozeUntil.toISOString() : undefined,
    snoozeTrigger: row.snoozeTrigger ?? undefined,
    createdBy: toUser(row.createdBy),
    assignee: row.assignee ? toUser(row.assignee) : undefined,
    watchers: (row.watchers ?? []).map((w: any) => toUser(w.user)),
    subtasks,
    comments,
    activity: toActivity(row.activity ?? []),
    links: toLink(row),
    group: row.group
      ? {
          id: row.group.id,
          slug: row.group.slug,
          name: row.group.name,
          emoji: row.group.emoji ?? undefined,
          color: row.group.color ?? undefined,
        }
      : undefined,
    autoRuleSlug: row.autoRuleSlug ?? undefined,
    onDoneTemplate: row.onDoneTemplate ?? undefined,
    commentCount: comments.length,
    subtaskTotal: subtasks.length,
    subtaskDone: subtasks.filter((t) => t.done).length,
    energy: row.energy ?? undefined,
    estimateMinutes: row.estimateMinutes ?? undefined,
    context: row._context,
    blockers: row._blockers,
    forecastImpact: row._forecastImpact,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Context/Blocker/Forecast enrichment ─────────────────────────
const DAY_MS = 86_400_000;

function computeBlockers(row: any): TodoBlocker[] {
  const out: TodoBlocker[] = [];
  if (row.vehicle) {
    if (row.vehicle.status === 'wartung') {
      out.push({
        kind: 'vehicle_in_wartung',
        vehicleId: row.vehicle.id,
        plate: row.vehicle.plate,
      });
    } else if (row.vehicle.status === 'vermietet') {
      out.push({
        kind: 'vehicle_vermietet',
        vehicleId: row.vehicle.id,
        plate: row.vehicle.plate,
      });
    }
  }
  if (row.contract?.status === 'storniert') {
    out.push({
      kind: 'contract_storniert',
      contractId: row.contract.id,
      title: row.contract.title,
    });
  }
  if (row.customer?.status === 'inaktiv') {
    out.push({
      kind: 'customer_inaktiv',
      customerId: row.customer.id,
      name: row.customer.name,
    });
  }
  return out;
}

function computeForecastImpact(row: any): TodoForecastImpact | undefined {
  // If todo links a contract with value, and dueDate is near contract end → flag risk
  if (!row.contract || !row.contract.endsAt || !row.contract.valueCents) return undefined;
  const endsAt = new Date(row.contract.endsAt);
  const due = row.dueAt ? new Date(row.dueAt) : null;
  const now = new Date();
  // Risk if contract is auslaufend AND due-date is past or within 7d of contract end
  if (row.contract.status !== 'auslaufend') return undefined;
  const daysToEnd = Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS);
  if (daysToEnd < 0 || daysToEnd > 30) return undefined;
  if (due && due > endsAt) {
    return {
      valueCents: row.contract.valueCents,
      reason: `Fällig nach Vertragsende — €${(row.contract.valueCents / 100).toLocaleString('de-DE')} verloren wenn nicht erledigt.`,
    };
  }
  return {
    valueCents: row.contract.valueCents,
    reason: `Vertrag läuft in ${daysToEnd}d aus — €${(row.contract.valueCents / 100).toLocaleString('de-DE')} an Verlängerung hängt dran.`,
  };
}

async function enrichRows(rows: any[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();

  // Batch fetch last customer-activity per customerId
  const customerIds = Array.from(
    new Set(rows.map((r) => r.customerId).filter((x): x is string => !!x))
  );
  const channelIds = Array.from(
    new Set(rows.map((r) => r.channelId).filter((x): x is string => !!x))
  );
  const contractIdsFull = Array.from(
    new Set(rows.map((r) => r.contractId).filter((x): x is string => !!x))
  );

  let lastActivityByCustomer = new Map<string, Date>();
  if (customerIds.length) {
    const activityRows = await db
      .select({
        customerId: s.customerActivity.customerId,
        latest: sql<Date>`MAX(${s.customerActivity.occurredAt})`,
      })
      .from(s.customerActivity)
      .where(inArray(s.customerActivity.customerId, customerIds))
      .groupBy(s.customerActivity.customerId);
    for (const r of activityRows) {
      if (r.customerId && r.latest) lastActivityByCustomer.set(r.customerId, new Date(r.latest));
    }
  }

  let unreadByChannel = new Map<string, number>();
  if (channelIds.length) {
    const msgs = await db
      .select({
        channelId: s.messages.channelId,
        n: count(),
      })
      .from(s.messages)
      .where(inArray(s.messages.channelId, channelIds))
      .groupBy(s.messages.channelId);
    for (const m of msgs) unreadByChannel.set(m.channelId, Number(m.n));
  }

  // contractValueCents + status + endsAt come with the relation already (we have it in the with)
  // But we need contract.valueCents which isn't included in default columns selection. Re-query if needed.
  let contractDataById = new Map<string, { valueCents: number | null; endsAt: Date | null; status: string }>();
  if (contractIdsFull.length) {
    const cRows = await db
      .select({
        id: s.contracts.id,
        valueCents: s.contracts.valueCents,
        endsAt: s.contracts.endsAt,
        status: s.contracts.status,
      })
      .from(s.contracts)
      .where(inArray(s.contracts.id, contractIdsFull));
    for (const c of cRows)
      contractDataById.set(c.id, {
        valueCents: c.valueCents,
        endsAt: c.endsAt,
        status: c.status,
      });
  }

  const now = new Date();
  for (const row of rows) {
    // Merge richer contract info into row.contract
    if (row.contractId && row.contract) {
      const c = contractDataById.get(row.contractId);
      if (c) {
        row.contract.valueCents = c.valueCents;
        row.contract.endsAt = c.endsAt;
        row.contract.status = c.status;
      }
    }

    const ctx: TodoContextStrip = {};
    if (row.customer) {
      ctx.customerStatus = row.customer.status;
      const last = row.customerId && lastActivityByCustomer.get(row.customerId);
      if (last) ctx.customerSilentDays = Math.floor((now.getTime() - last.getTime()) / DAY_MS);
    }
    if (row.contract?.valueCents) ctx.contractValueCents = row.contract.valueCents;
    if (row.contract?.endsAt) {
      ctx.contractDaysToEnd = Math.ceil(
        (new Date(row.contract.endsAt).getTime() - now.getTime()) / DAY_MS
      );
    }
    if (row.vehicle?.status) ctx.vehicleStatus = row.vehicle.status;
    if (row.channelId) ctx.channelUnread = unreadByChannel.get(row.channelId) ?? 0;

    row._context = Object.keys(ctx).length ? ctx : undefined;
    const blockers = computeBlockers(row);
    row._blockers = blockers.length ? blockers : undefined;
    row._forecastImpact = computeForecastImpact(row);
  }
}

export type TodoFilter = {
  status?: TodoStatus[];
  assigneeId?: string | 'me' | 'unassigned';
  dueBefore?: Date;
  dueAfter?: Date;
  customerId?: string;
  contractId?: string;
  vehicleId?: string;
  channelId?: string;
  groupId?: string | 'none';
};

export async function listTodos(
  workspaceId: string,
  userId: string,
  filter: TodoFilter = {}
): Promise<Todo[]> {
  const db = getDb();
  const conditions = [eq(s.todos.workspaceId, workspaceId)];
  // Visibility: team/account always visible; private only if creator or assignee or watcher
  conditions.push(
    or(
      eq(s.todos.visibility, 'team'),
      eq(s.todos.visibility, 'account'),
      and(eq(s.todos.visibility, 'private'), or(eq(s.todos.createdById, userId), eq(s.todos.assigneeId, userId)))!
    )!
  );

  if (filter.status?.length) {
    conditions.push(
      or(...filter.status.map((st) => eq(s.todos.status, st)))!
    );
  }
  if (filter.assigneeId === 'me') {
    conditions.push(eq(s.todos.assigneeId, userId));
  } else if (filter.assigneeId === 'unassigned') {
    conditions.push(isNull(s.todos.assigneeId));
  } else if (filter.assigneeId) {
    conditions.push(eq(s.todos.assigneeId, filter.assigneeId));
  }
  if (filter.customerId) conditions.push(eq(s.todos.customerId, filter.customerId));
  if (filter.contractId) conditions.push(eq(s.todos.contractId, filter.contractId));
  if (filter.vehicleId) conditions.push(eq(s.todos.vehicleId, filter.vehicleId));
  if (filter.channelId) conditions.push(eq(s.todos.channelId, filter.channelId));
  if (filter.groupId === 'none') conditions.push(isNull(s.todos.groupId));
  else if (filter.groupId) conditions.push(eq(s.todos.groupId, filter.groupId));
  if (filter.dueBefore) conditions.push(lte(s.todos.dueAt, filter.dueBefore));
  if (filter.dueAfter) conditions.push(gte(s.todos.dueAt, filter.dueAfter));

  const rows = await db.query.todos.findMany({
    where: and(...conditions),
    orderBy: [
      sql`CASE WHEN ${s.todos.dueAt} IS NULL THEN 1 ELSE 0 END`,
      asc(s.todos.dueAt),
      desc(s.todos.createdAt),
    ],
    with: {
      createdBy: true,
      assignee: true,
      customer: { columns: { id: true, slug: true, name: true, status: true } },
      contract: { columns: { id: true, externalId: true, title: true } },
      vehicle: { columns: { id: true, externalId: true, plate: true, model: true, status: true } },
      channel: { columns: { id: true, slug: true, name: true } },
      group: { columns: { id: true, slug: true, name: true, emoji: true, color: true } },
      subtasks: true,
      comments: false,
      activity: false,
      watchers: { with: { user: true } },
    },
    limit: 500,
  });

  await enrichRows(rows);
  return rows.map(toTodo);
}

export async function getTodo(workspaceId: string, todoId: string): Promise<Todo | null> {
  const db = getDb();
  const row = await db.query.todos.findFirst({
    where: and(eq(s.todos.workspaceId, workspaceId), eq(s.todos.id, todoId)),
    with: {
      createdBy: true,
      assignee: true,
      customer: { columns: { id: true, slug: true, name: true, status: true } },
      contract: { columns: { id: true, externalId: true, title: true } },
      vehicle: { columns: { id: true, externalId: true, plate: true, model: true, status: true } },
      channel: { columns: { id: true, slug: true, name: true } },
      group: { columns: { id: true, slug: true, name: true, emoji: true, color: true } },
      subtasks: true,
      comments: { with: { author: true }, orderBy: [asc(s.todoComments.createdAt)] },
      activity: { with: { actor: true }, orderBy: [desc(s.todoActivity.createdAt)] },
      watchers: { with: { user: true } },
    },
  });
  if (!row) return null;
  await enrichRows([row]);
  return toTodo(row);
}

export async function todoStats(workspaceId: string, userId: string) {
  const db = getDb();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 86_400_000);

  const [openRow] = await db
    .select({ n: count() })
    .from(s.todos)
    .where(
      and(
        eq(s.todos.workspaceId, workspaceId),
        eq(s.todos.status, 'offen')
      )
    );
  const [todayRow] = await db
    .select({ n: count() })
    .from(s.todos)
    .where(
      and(
        eq(s.todos.workspaceId, workspaceId),
        eq(s.todos.assigneeId, userId),
        gte(s.todos.dueAt, startToday),
        lte(s.todos.dueAt, endToday)
      )
    );
  const [overdueRow] = await db
    .select({ n: count() })
    .from(s.todos)
    .where(
      and(
        eq(s.todos.workspaceId, workspaceId),
        eq(s.todos.assigneeId, userId),
        lte(s.todos.dueAt, now),
        or(eq(s.todos.status, 'offen'), eq(s.todos.status, 'in_arbeit'))!
      )
    );
  return {
    open: openRow?.n ?? 0,
    todayMine: todayRow?.n ?? 0,
    overdueMine: overdueRow?.n ?? 0,
  };
}

export async function todoTodayCount(workspaceId: string) {
  const db = getDb();
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 86_400_000);
  const [row] = await db
    .select({ n: count() })
    .from(s.todos)
    .where(
      and(
        eq(s.todos.workspaceId, workspaceId),
        gte(s.todos.dueAt, startToday),
        lte(s.todos.dueAt, endToday)
      )
    );
  return row?.n ?? 0;
}
