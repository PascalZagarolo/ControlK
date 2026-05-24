'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, gt, ilike, isNull, max, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { triggerEvent } from '@/lib/realtime/pusher-server';
import type {
  TodoActivityKind,
  TodoEnergy,
  TodoPriority,
  TodoStatus,
  TodoVisibility,
} from '@/lib/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

async function logActivity(
  todoId: string,
  actorId: string | null,
  kind: TodoActivityKind,
  payload: Record<string, unknown> = {}
) {
  const db = getDb();
  await db.insert(s.todoActivity).values({
    todoId,
    actorId,
    kind,
    payload,
  });
}

async function notifyTodoChange(workspaceId: string, todoId: string, kind: string) {
  await triggerEvent(`workspace-${workspaceId}-todos`, kind, { todoId });
}

function paths() {
  revalidatePath('/todos');
  revalidatePath('/');
}

// ─── Create ────────────────────────────────────────────────────
export async function createTodo(input: {
  title: string;
  description?: string;
  priority?: TodoPriority;
  visibility?: TodoVisibility;
  dueAt?: string | null;
  assigneeId?: string | null;
  customerId?: string | null;
  contractId?: string | null;
  vehicleId?: string | null;
  channelId?: string | null;
  sourceMessageId?: string | null;
  groupId?: string | null;
  subtasks?: string[];
  onDoneTemplate?: string | null;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Titel erforderlich.' };
  if (title.length > 280) return { ok: false, error: 'Titel zu lang.' };

  const dueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) return { ok: false, error: 'Ungültiges Datum.' };

  // Apply group defaults for fields the caller left unset.
  // Also denormalize the group's projectId onto the todo so the
  // project-filter query can be a single indexed where-clause.
  let priority: TodoPriority = input.priority ?? 'mittel';
  let visibility: TodoVisibility = input.visibility ?? 'team';
  let assigneeId: string | null = input.assigneeId || null;
  let projectId: string | null = null;
  if (input.groupId) {
    const group = await db.query.todoGroups.findFirst({
      where: eq(s.todoGroups.id, input.groupId),
    });
    if (group) {
      if (!input.assigneeId && group.defaultAssigneeId) assigneeId = group.defaultAssigneeId;
      if (!input.priority && group.defaultPriority) priority = group.defaultPriority;
      if (!input.visibility && group.defaultVisibility) visibility = group.defaultVisibility;
      projectId = (group as any).projectId ?? null;
    }
  }

  const [row] = await db
    .insert(s.todos)
    .values({
      workspaceId: ws.id,
      createdById: user.id,
      title,
      description: input.description?.trim() || null,
      priority,
      visibility,
      dueAt,
      assigneeId,
      customerId: input.customerId || null,
      contractId: input.contractId || null,
      vehicleId: input.vehicleId || null,
      channelId: input.channelId || null,
      sourceMessageId: input.sourceMessageId || null,
      groupId: input.groupId || null,
      projectId: projectId as any,
      onDoneTemplate: input.onDoneTemplate || null,
    })
    .returning();

  if (input.subtasks?.length) {
    await db.insert(s.todoSubtasks).values(
      input.subtasks
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t, i) => ({ todoId: row.id, title: t, position: i }))
    );
  }

  if (input.assigneeId && input.assigneeId !== user.id) {
    await db
      .insert(s.todoWatchers)
      .values({ todoId: row.id, userId: user.id })
      .onConflictDoNothing();
  }

  await logActivity(row.id, user.id, 'created', {
    title,
    assigneeId: input.assigneeId || null,
  });
  if (input.assigneeId) {
    await logActivity(row.id, user.id, 'assigned', { assigneeId: input.assigneeId });
  }

  await notifyTodoChange(ws.id, row.id, 'todo.created');
  paths();
  return { ok: true, id: row.id };
}

export async function createTodoFromForm(formData: FormData): Promise<Result<{ id: string }>> {
  const subtasksRaw = String(formData.get('subtasks') ?? '');
  const subtasks = subtasksRaw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•–—\s]*/, '').trim())
    .filter(Boolean);

  return createTodo({
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? '') || undefined,
    priority: (String(formData.get('priority') ?? 'mittel') as TodoPriority) || 'mittel',
    visibility: (String(formData.get('visibility') ?? 'team') as TodoVisibility) || 'team',
    dueAt: String(formData.get('dueAt') ?? '') || null,
    assigneeId: String(formData.get('assigneeId') ?? '') || null,
    customerId: String(formData.get('customerId') ?? '') || null,
    contractId: String(formData.get('contractId') ?? '') || null,
    vehicleId: String(formData.get('vehicleId') ?? '') || null,
    channelId: String(formData.get('channelId') ?? '') || null,
    groupId: String(formData.get('groupId') ?? '') || null,
    subtasks,
  });
}

// ─── Update fields ─────────────────────────────────────────────
async function findGuarded(todoId: string, workspaceId: string) {
  const db = getDb();
  const row = await db.query.todos.findFirst({
    where: and(eq(s.todos.id, todoId), eq(s.todos.workspaceId, workspaceId)),
  });
  return row;
}

export async function setTodoStatus(todoId: string, status: TodoStatus): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  if (row.status === status) return { ok: true };

  const now = new Date();
  await db
    .update(s.todos)
    .set({
      status,
      completedAt: status === 'erledigt' ? now : null,
      updatedAt: now,
    })
    .where(eq(s.todos.id, todoId));

  await logActivity(todoId, user.id, 'status_changed', {
    from: row.status,
    to: status,
  });
  if (status === 'erledigt') {
    await logActivity(todoId, user.id, 'completed', {});
    if (row.onDoneTemplate) {
      // Apply Done-Loop template: spawn follow-up todo (simple stub: extend with more templates)
      await db.insert(s.todos).values({
        workspaceId: ws.id,
        createdById: user.id,
        title: row.onDoneTemplate,
        priority: row.priority,
        visibility: row.visibility,
        customerId: row.customerId,
        contractId: row.contractId,
        vehicleId: row.vehicleId,
        channelId: row.channelId,
        dueAt: new Date(now.getTime() + 7 * 86_400_000),
      });
    }
  } else if (status === 'abgebrochen') {
    await logActivity(todoId, user.id, 'cancelled', {});
  }
  await notifyTodoChange(ws.id, todoId, 'todo.status');
  paths();
  return { ok: true };
}

export async function setTodoPriority(todoId: string, priority: TodoPriority): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  if (row.priority === priority) return { ok: true };
  await db
    .update(s.todos)
    .set({ priority, updatedAt: new Date() })
    .where(eq(s.todos.id, todoId));
  await logActivity(todoId, user.id, 'priority_changed', {
    from: row.priority,
    to: priority,
  });
  await notifyTodoChange(ws.id, todoId, 'todo.priority');
  paths();
  return { ok: true };
}

export async function setTodoDue(todoId: string, dueAtIso: string | null): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  const next = dueAtIso ? new Date(dueAtIso) : null;
  if (next && Number.isNaN(next.getTime())) return { ok: false, error: 'Ungültiges Datum.' };
  await db
    .update(s.todos)
    .set({ dueAt: next, updatedAt: new Date() })
    .where(eq(s.todos.id, todoId));
  await logActivity(todoId, user.id, 'due_changed', {
    from: row.dueAt?.toISOString() ?? null,
    to: next?.toISOString() ?? null,
  });
  await notifyTodoChange(ws.id, todoId, 'todo.due');
  paths();
  return { ok: true };
}

export async function setTodoAssignee(
  todoId: string,
  assigneeId: string | null
): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  if (row.assigneeId === assigneeId) return { ok: true };
  await db
    .update(s.todos)
    .set({ assigneeId, updatedAt: new Date() })
    .where(eq(s.todos.id, todoId));
  await logActivity(todoId, user.id, assigneeId ? 'assigned' : 'unassigned', {
    from: row.assigneeId,
    to: assigneeId,
  });
  if (assigneeId && assigneeId !== user.id) {
    await db
      .insert(s.todoWatchers)
      .values({ todoId, userId: user.id })
      .onConflictDoNothing();
  }
  await notifyTodoChange(ws.id, todoId, 'todo.assigned');
  paths();
  return { ok: true };
}

export async function claimTodo(todoId: string): Promise<Result> {
  return setTodoAssignee(todoId, (await requireUser()).id);
}

export async function snoozeTodo(
  todoId: string,
  until: string | null,
  trigger?: { kind: string; ref?: string }
): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  await db
    .update(s.todos)
    .set({
      snoozeUntil: until ? new Date(until) : null,
      snoozeTrigger: (trigger ?? null) as any,
      updatedAt: new Date(),
    })
    .where(eq(s.todos.id, todoId));
  await logActivity(todoId, user.id, 'snoozed', {
    until,
    trigger: trigger ?? null,
  });
  await notifyTodoChange(ws.id, todoId, 'todo.snoozed');
  paths();
  return { ok: true };
}

export async function updateTodoTitle(todoId: string, title: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  const next = title.trim();
  if (!next) return { ok: false, error: 'Titel erforderlich.' };
  if (next.length > 280) return { ok: false, error: 'Titel zu lang.' };
  if (next === row.title) return { ok: true };
  await db.update(s.todos).set({ title: next, updatedAt: new Date() }).where(eq(s.todos.id, todoId));
  await notifyTodoChange(ws.id, todoId, 'todo.updated');
  paths();
  return { ok: true };
}

export async function setTodoEnergy(
  todoId: string,
  energy: TodoEnergy | null
): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  await db
    .update(s.todos)
    .set({ energy: energy ?? null, updatedAt: new Date() })
    .where(eq(s.todos.id, todoId));
  await notifyTodoChange(ws.id, todoId, 'todo.energy');
  paths();
  return { ok: true };
}

export async function setTodoEstimate(
  todoId: string,
  minutes: number | null
): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  await db
    .update(s.todos)
    .set({ estimateMinutes: minutes ?? null, updatedAt: new Date() })
    .where(eq(s.todos.id, todoId));
  await notifyTodoChange(ws.id, todoId, 'todo.estimate');
  paths();
  return { ok: true };
}

export async function deleteTodo(todoId: string): Promise<Result> {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  await db.delete(s.todos).where(eq(s.todos.id, todoId));
  await notifyTodoChange(ws.id, todoId, 'todo.deleted');
  paths();
  return { ok: true };
}

// ─── Subtasks ─────────────────────────────────────────────────
export async function addSubtask(todoId: string, title: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: 'Titel erforderlich.' };

  const [posRow] = await db
    .select({ m: max(s.todoSubtasks.position) })
    .from(s.todoSubtasks)
    .where(eq(s.todoSubtasks.todoId, todoId));
  const nextPos = (posRow?.m ?? -1) + 1;

  await db.insert(s.todoSubtasks).values({ todoId, title: trimmed, position: nextPos });
  await logActivity(todoId, user.id, 'subtask_added', { title: trimmed });
  paths();
  return { ok: true };
}

export async function toggleSubtask(subtaskId: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.todoSubtasks.findFirst({
    where: eq(s.todoSubtasks.id, subtaskId),
  });
  if (!row) return { ok: false, error: 'Subtask nicht gefunden.' };
  const parent = await findGuarded(row.todoId, ws.id);
  if (!parent) return { ok: false, error: 'Todo nicht gefunden.' };
  const nextDone = row.done === 1 ? 0 : 1;
  await db
    .update(s.todoSubtasks)
    .set({ done: nextDone })
    .where(eq(s.todoSubtasks.id, subtaskId));
  if (nextDone === 1) {
    await logActivity(row.todoId, user.id, 'subtask_completed', { title: row.title });
  }
  paths();
  return { ok: true };
}

export async function deleteSubtask(subtaskId: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await db.query.todoSubtasks.findFirst({
    where: eq(s.todoSubtasks.id, subtaskId),
  });
  if (!row) return { ok: false, error: 'Subtask nicht gefunden.' };
  const parent = await findGuarded(row.todoId, ws.id);
  if (!parent) return { ok: false, error: 'Todo nicht gefunden.' };
  await db.delete(s.todoSubtasks).where(eq(s.todoSubtasks.id, subtaskId));
  await logActivity(row.todoId, user.id, 'subtask_removed', { title: row.title });
  paths();
  return { ok: true };
}

// ─── Comments ─────────────────────────────────────────────────
export async function addComment(todoId: string, body: string): Promise<Result> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();
  const row = await findGuarded(todoId, ws.id);
  if (!row) return { ok: false, error: 'Todo nicht gefunden.' };
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Kommentar leer.' };
  await db.insert(s.todoComments).values({ todoId, authorId: user.id, body: trimmed });
  await logActivity(todoId, user.id, 'commented', { excerpt: trimmed.slice(0, 80) });
  await notifyTodoChange(ws.id, todoId, 'todo.commented');
  paths();
  return { ok: true };
}

// ─── Slash command from channel composer ──────────────────────
export async function createTodoFromSlash(
  channelId: string,
  rawText: string,
  sourceMessageId?: string
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  const parsed = parseSlashTodo(rawText);
  if (!parsed.title) return { ok: false, error: '/todo braucht einen Titel.' };

  // Resolve assignee by name fragment if @mention
  let assigneeId: string | null = null;
  if (parsed.assigneeMention) {
    const candidates = await db.query.users.findMany({
      where: (u, { sql: q }) => q`lower(${u.name}) LIKE ${'%' + parsed.assigneeMention!.toLowerCase() + '%'}`,
      limit: 5,
    });
    const wsMembers = await db.query.workspaceMembers.findMany({
      where: eq(s.workspaceMembers.workspaceId, ws.id),
      columns: { userId: true },
    });
    const memberIds = new Set(wsMembers.map((m) => m.userId));
    const match = candidates.find((c) => memberIds.has(c.id));
    if (match) assigneeId = match.id;
  }

  return createTodo({
    title: parsed.title,
    dueAt: parsed.dueAt ? parsed.dueAt.toISOString() : null,
    priority: parsed.priority ?? 'mittel',
    assigneeId,
    channelId,
    sourceMessageId: sourceMessageId ?? null,
    visibility: 'team',
  });
}

/**
 * Convert all unread mentions of the current user in a channel into todos.
 * "Mention" = the channel message body contains `@me-name` (first/full name, case-insensitive)
 * AND the message is newer than the current user's lastReadAt on that channel.
 */
export async function convertMentionsToTodos(
  channelId: string
): Promise<Result<{ created: number }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  // Confirm channel belongs to this workspace
  const channel = await db.query.channels.findFirst({
    where: and(eq(s.channels.id, channelId), eq(s.channels.workspaceId, ws.id)),
  });
  if (!channel) return { ok: false, error: 'Channel nicht gefunden.' };

  const member = await db.query.channelMembers.findFirst({
    where: and(eq(s.channelMembers.channelId, channelId), eq(s.channelMembers.userId, user.id)),
  });
  const since = member?.lastReadAt ?? new Date(Date.now() - 30 * 86_400_000);
  const firstName = (user.name.split(' ')[0] || user.name).toLowerCase();

  const matches = await db.query.messages.findMany({
    where: and(
      eq(s.messages.channelId, channelId),
      gt(s.messages.createdAt, since),
      or(
        ilike(s.messages.body, `%@${firstName}%`),
        ilike(s.messages.body, `%@${user.name.toLowerCase()}%`)
      )!
    ),
    orderBy: s.messages.createdAt,
    limit: 50,
  });
  if (matches.length === 0) return { ok: true, created: 0 };

  let created = 0;
  for (const m of matches) {
    const body = m.body.trim();
    const title = body.length > 200 ? body.slice(0, 197) + '…' : body;
    const res = await createTodo({
      title,
      channelId,
      sourceMessageId: m.id,
      assigneeId: user.id,
      visibility: 'team',
    });
    if (res.ok) created += 1;
  }

  // Mark channel as read up to now
  await db
    .insert(s.channelMembers)
    .values({ channelId, userId: user.id, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [s.channelMembers.channelId, s.channelMembers.userId],
      set: { lastReadAt: new Date() },
    });

  paths();
  revalidatePath(`/channels/${channel.slug}`);
  return { ok: true, created };
}

function parseSlashTodo(text: string): {
  title: string;
  assigneeMention?: string;
  dueAt?: Date;
  priority?: TodoPriority;
} {
  let working = text.trim();
  let assigneeMention: string | undefined;
  let priority: TodoPriority | undefined;
  let dueAt: Date | undefined;

  // @mention
  const at = working.match(/(^|\s)@([\wäöüÄÖÜß-]+)/);
  if (at) {
    assigneeMention = at[2];
    working = (working.slice(0, at.index!) + working.slice(at.index! + at[0].length)).trim();
  }

  // priority !!! / !!
  const prio = working.match(/(^|\s)!!!?/);
  if (prio) {
    priority = prio[0].trim() === '!!!' ? 'urgent' : 'hoch';
    working = (working.slice(0, prio.index!) + working.slice(prio.index! + prio[0].length)).trim();
  }

  // due: "morgen [HH:MM]", "heute [HH:MM]", "freitag [HH:MM]", "in N tagen", "YYYY-MM-DD [HH:MM]"
  dueAt = extractDueFromText(working);
  if (dueAt) {
    // remove first date-like token chunk roughly
    working = working
      .replace(/\b(heute|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b(\s+\d{1,2}[:.]\d{2})?/i, '')
      .replace(/\bin\s+\d+\s+tagen?\b/i, '')
      .replace(/\b\d{4}-\d{2}-\d{2}(\s+\d{1,2}[:.]\d{2})?\b/, '')
      .trim();
  }

  return { title: working.trim(), assigneeMention, dueAt, priority };
}

function extractDueFromText(text: string): Date | undefined {
  const lower = text.toLowerCase();
  const time = lower.match(/\b(\d{1,2})[:.](\d{2})\b/);
  const hh = time ? parseInt(time[1], 10) : 9;
  const mm = time ? parseInt(time[2], 10) : 0;

  const setTime = (d: Date) => {
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  const today = new Date();
  if (/\bheute\b/.test(lower)) return setTime(new Date(today));
  if (/\bmorgen\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return setTime(d);
  }
  if (/\bübermorgen\b/.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return setTime(d);
  }
  const weekdays = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  for (let i = 0; i < weekdays.length; i++) {
    if (new RegExp(`\\b${weekdays[i]}\\b`).test(lower)) {
      const d = new Date(today);
      const delta = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + delta);
      return setTime(d);
    }
  }
  const inDays = lower.match(/\bin\s+(\d+)\s+tagen?\b/);
  if (inDays) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(inDays[1], 10));
    return setTime(d);
  }
  const iso = lower.match(/\b(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2})[:.](\d{2}))?\b/);
  if (iso) {
    const d = new Date(iso[1] + 'T00:00:00');
    if (iso[2]) d.setHours(parseInt(iso[2], 10), parseInt(iso[3], 10), 0, 0);
    else d.setHours(hh, mm, 0, 0);
    return d;
  }
  return undefined;
}
