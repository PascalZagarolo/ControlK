'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  resolveCommitment,
  dismissCommitment,
  confirmCommitment,
  commitmentToTodo,
} from '@/lib/actions/commitments';
import {
  snoozeInboxItem,
  createTodoFromInboxItem,
  archiveInboxItem,
} from '@/lib/actions/inbox-actions';
import { setTodoStatus, snoozeTodo } from '@/lib/actions/todos';
import type { PlanAction, PlanItemSource } from '@/lib/morning-plan/types';

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

/** Tomorrow at 09:00 local — the "nicht heute" target for a todo snooze. */
function tomorrowMorningIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/**
 * One-tap action dispatcher for a Morning-Plan item.
 *
 * The plan does NOT own any state — it routes each tap to the SAME server
 * action the item's source module already exposes (Prompt 3 commitments,
 * inbox-actions, todos). This keeps a single source of truth per domain;
 * the plan never re-implements status logic.
 *
 *   action          commitment            inbox (reply)            todo
 *   ──────────────  ────────────────────  ───────────────────────  ──────────────
 *   done            resolveCommitment      archive (handled)        setTodoStatus(erledigt)
 *   dismiss         dismissCommitment      archive                  setTodoStatus(erledigt)
 *   confirm         confirmCommitment      —                        —
 *   to_todo         commitmentToTodo       createTodoFromInboxItem  —
 *   not_today       snooze (tomorrow)*     snoozeInboxItem(tomorrow) snoozeTodo(tomorrow)
 *
 * *commitments have no snooze column; "not today" on a commitment is a
 *  no-op acknowledgement (it simply stays open) — surfaced to the UI as ok
 *  so the row can collapse for the session without mutating trust state.
 */
export async function applyPlanAction(input: {
  source: PlanItemSource;
  sourceId: string;
  action: PlanAction;
}): Promise<Result<{ todoId?: string }>> {
  // Auth/workspace are enforced inside each delegated action; we still
  // require a user here so an unauthenticated call fails fast + uniformly.
  await requireUser();
  await requireCurrentWorkspace();

  const { source, sourceId, action } = input;
  let res: Result<{ todoId?: string }> = { ok: true };

  if (source === 'commitment') {
    if (action === 'done') res = await resolveCommitment(sourceId);
    else if (action === 'dismiss') res = await dismissCommitment(sourceId);
    else if (action === 'confirm') res = await confirmCommitment(sourceId);
    else if (action === 'to_todo') res = await commitmentToTodo(sourceId);
    else if (action === 'not_today') res = { ok: true }; // stays open, collapses client-side
    else res = { ok: false, error: 'Aktion nicht unterstützt.' };
  } else if (source === 'inbox') {
    if (action === 'to_todo') res = await createTodoFromInboxItem(sourceId);
    else if (action === 'done' || action === 'dismiss') res = await archiveInboxItem(sourceId);
    else if (action === 'not_today') res = await snoozeInboxItem(sourceId, 'tomorrow');
    else res = { ok: false, error: 'Aktion nicht unterstützt.' };
  } else if (source === 'todo') {
    if (action === 'done' || action === 'dismiss') res = await setTodoStatus(sourceId, 'erledigt');
    else if (action === 'not_today') res = await snoozeTodo(sourceId, tomorrowMorningIso());
    else res = { ok: false, error: 'Aktion nicht unterstützt.' };
  } else {
    res = { ok: false, error: 'Diese Quelle hat keine Aktionen.' };
  }

  if (res.ok) revalidatePath('/plan');
  return res;
}
