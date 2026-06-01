// ─── Morning Plan — server-side assembly ────────────────────────────
//
// Fetches the REAL upstream data and feeds it to the deterministic engine.
// It strictly CONSUMES:
//   - Prompt 1 triage  → getAwaitingSplit().onYou  ("braucht Antwort")
//   - Prompt 3          → listOpenCommitments       (status/confidence/quote)
//   - Calendar          → listCalendarEvents        (optional input)
//   - Todos             → listTodos                  (today/overdue only)
// It does NOT re-derive any of them.

import 'server-only';

import { getAwaitingSplit } from '@/lib/db/queries/inbox-overview';
import { listOpenCommitments } from '@/lib/db/queries/commitments';
import { listCalendarEvents } from '@/lib/db/queries/calendar';
import { listTodos } from '@/lib/db/queries/todos';
import { fetchGmailConnectionState } from '@/lib/foyer/gmail-state';
import { computeMorningPlan } from './compute';
import { summarizeMorningPlan } from './summarize';
import type {
  CommitmentInput,
  EventInput,
  MorningPlan,
  ReplyWaitingInput,
  TodoInput,
} from './types';

const DAY_MS = 86_400_000;

/**
 * Honest first-run / connection state so the UI never shows a calm "all
 * done" when it simply hasn't read anything yet (L1/L3):
 *  - 'ready'         → mail is synced; the plan reflects real data.
 *  - 'first_scan'    → connected but the first sync/scan hasn't landed yet.
 *  - 'not_connected' → no mailbox connected.
 */
export type PlanConnectionState = 'ready' | 'first_scan' | 'not_connected';

export type BuiltMorningPlan = MorningPlan & {
  summary: string;
  connectionState: PlanConnectionState;
};

function cleanName(raw: string | null): string {
  if (!raw) return 'Unbekannt';
  const m = raw.match(/^(.*)<[^>]+>\s*$/);
  if (m) return m[1].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '') || raw;
  return raw;
}

/**
 * Assembles today's morning plan for a user in a workspace.
 *
 * `withSummary=false` skips the LLM step (used by tests / cheap renders);
 * the deterministic plan is identical either way.
 */
export async function buildMorningPlan(
  workspaceId: string,
  userId: string,
  opts: { withSummary?: boolean; now?: Date } = {}
): Promise<BuiltMorningPlan> {
  const now = opts.now ?? new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + DAY_MS);

  // All sub-fetches degrade to empty so the plan always renders.
  const [awaiting, commitments, events, todos, gmail] = await Promise.all([
    getAwaitingSplit(workspaceId, userId).catch(() => ({ onYou: [], onThem: [] })),
    listOpenCommitments(workspaceId, userId).catch(() => []),
    listCalendarEvents(workspaceId, startOfToday, endOfToday).catch(() => []),
    listTodos(workspaceId, userId).catch(() => []),
    fetchGmailConnectionState(userId).catch(() => ({ connected: false, syncedAt: null })),
  ]);

  // Honest first-run signal: connected but never synced → don't present an
  // empty plan as "all calm"; the UI shows a truthful "reading your mail…".
  const connectionState: PlanConnectionState = !gmail.connected
    ? 'not_connected'
    : gmail.syncedAt
      ? 'ready'
      : 'first_scan';

  // ── Map upstream rows → neutral engine inputs ──

  // Prompt 1: "braucht Antwort" = unread inbound mail waiting on the user.
  const repliesWaiting: ReplyWaitingInput[] = awaiting.onYou.map((r) => ({
    id: r.id,
    senderName: cleanName(r.senderName),
    senderEmail: r.senderEmail,
    subject: r.subject,
    ageDays: r.ageDays,
  }));

  // Prompt 3: open commitments. listOpenCommitments already enforces the
  // hallucination guard (sourceQuote NOT NULL) at the query layer; we keep a
  // belt-and-braces filter here too so the engine contract holds locally.
  const commitmentInputs: CommitmentInput[] = commitments
    .filter((c) => !!c.sourceQuote && c.sourceQuote.trim().length > 0)
    .map((c) => ({
      id: c.id,
      promiseText: c.promiseText,
      sourceQuote: c.sourceQuote,
      dueAt: c.dueAt,
      dueBasis: c.dueBasis,
      confidence: c.confidence,
      recipientName: c.recipientName,
      recipientEmail: c.recipientEmail,
      customerId: c.customerId,
      customerName: c.customerName,
    }));

  const eventInputs: EventInput[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    allDay: e.allDay ?? false,
    customerName: e.linkedCustomerName ?? null,
  }));

  const todoInputs: TodoInput[] = todos
    .filter((t) => (t.status === 'offen' || t.status === 'in_arbeit') && t.assignee?.id === userId)
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueAt: t.dueAt ?? null,
      priority: t.priority as TodoInput['priority'],
      overdue: !!t.dueAt && new Date(t.dueAt).getTime() < now.getTime(),
    }));

  const plan = computeMorningPlan({
    now,
    commitments: commitmentInputs,
    repliesWaiting,
    events: eventInputs,
    todos: todoInputs,
  });

  const summary =
    opts.withSummary === false
      ? ''
      : await summarizeMorningPlan(userId, plan).catch(() => '');

  return { ...plan, summary, connectionState };
}
