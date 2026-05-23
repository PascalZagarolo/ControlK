'use server';

import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getTodo as fetchTodo } from '@/lib/db/queries/todos';

export async function getTodo(id: string) {
  await requireUser();
  const ws = await requireCurrentWorkspace();
  return fetchTodo(ws.id, id);
}
