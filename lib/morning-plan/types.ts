// ─── Morning Plan — pure types ──────────────────────────────────────
//
// No `server-only`, no DB/AI imports — so the prioritisation + collision
// engine (compute.ts) is unit-testable in plain Node (see compute.test.ts).
// The server glue (lib/morning-plan/build.ts) fetches the real data from
// the Prompt-1 triage, Prompt-3 commitments, calendar and todos, maps it
// into these neutral input shapes, and calls computeMorningPlan().
//
// IMPORTANT: this layer CONSUMES the upstream data. It never re-derives
// triage ("braucht Antwort") or commitment extraction — those are inputs.

export type PlanItemKind =
  | 'commitment_overdue'
  | 'commitment_due_today'
  | 'commitment_open' // dated in the future / undated — shown lower
  | 'reply_waiting' // inbound mail that "braucht Antwort" (Prompt 1 triage)
  | 'event_today'
  | 'todo_due_today'
  | 'todo_overdue';

/** Which upstream produced an item — drives the explainability line. */
export type PlanItemSource = 'commitment' | 'inbox' | 'calendar' | 'todo';

export type PlanConfidence = 'high' | 'medium' | 'low';

/** One action the user can take with a single tap, mapped to a server action. */
export type PlanAction = 'done' | 'dismiss' | 'not_today' | 'confirm' | 'to_todo';

// ── Neutral inputs (mapped from the real queries in build.ts) ──

export type CommitmentInput = {
  id: string;
  promiseText: string;
  /** REQUIRED — Prompt-3 hallucination guard: no quote ⇒ not shown. */
  sourceQuote: string;
  dueAt: string | null;
  /** Verbatim deadline phrase ("bis Freitag"), Prompt 3. */
  dueBasis: string | null;
  confidence: PlanConfidence;
  recipientName: string | null;
  recipientEmail: string | null;
  customerId: string | null;
  customerName: string | null;
};

export type ReplyWaitingInput = {
  /** inbox_items.id */
  id: string;
  senderName: string;
  senderEmail: string | null;
  subject: string | null;
  /** Whole days the inbound mail has been waiting on a reply. */
  ageDays: number;
};

export type EventInput = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  customerName: string | null;
};

export type TodoInput = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: 'urgent' | 'hoch' | 'mittel' | 'niedrig';
  /** true when dueAt is in the past and the todo is still open. */
  overdue: boolean;
};

export type MorningPlanInput = {
  /** Reference "now" — injected so the engine is deterministic + testable. */
  now: Date;
  commitments: CommitmentInput[];
  repliesWaiting: ReplyWaitingInput[];
  events: EventInput[];
  todos: TodoInput[];
};

// ── Outputs ──

export type PlanItem = {
  /** Stable key for React + the action layer: `${source}:${sourceId}`. */
  key: string;
  sourceId: string;
  kind: PlanItemKind;
  source: PlanItemSource;
  /** Short headline ("Angebot schicken", "Anna Hoffmann"). */
  title: string;
  /** WHY it's here — explainability. Commitment → source_sentence; reply →
   *  sender + waiting time. Always present. */
  reason: string;
  /** Optional deadline/age sub-label ("fällig heute", "3 Tage überfällig"). */
  timing: string | null;
  /** high confidence → asserted; medium/low → posed as a QUESTION. */
  confidence: PlanConfidence;
  /** true when this must be rendered as a question, not a statement. */
  isQuestion: boolean;
  /** Deterministic priority score (higher = more urgent). For ordering/debug. */
  score: number;
  /** Which one-tap actions apply to this item. */
  actions: PlanAction[];
  /** Deep-link target. */
  href: string;
  /** Customer linkage when known. */
  customerName: string | null;
  /** Customer id when this item is tied to one (commitments) — for assignee lookup. */
  customerId: string | null;
  /** Team responsibility, resolved post-compute (build layer) for items whose
   *  customer is assigned. Null/undefined when unassigned or not customer-tied. */
  assignee?: PlanAssignee | null;
};

export type PlanAssignee = {
  name: string;
  initials: string;
  /** True when the contact is assigned to the viewing user. */
  isMe: boolean;
};

export type PlanCollision = {
  kind:
    | 'due_today_vs_busy' // a commitment due today + a packed calendar
    | 'multiple_overdue_commitments'
    | 'customer_long_wait'; // a customer waiting many days for a reply
  /** Concise, assistive insight — the value is the realisation, not a list. */
  message: string;
  /** Keys of the plan items this collision concerns (for highlighting). */
  relatedKeys: string[];
  severity: 'high' | 'medium';
};

export type MorningPlan = {
  /** The single prioritised stream — the heart of the plan. */
  items: PlanItem[];
  /** Cross-source insights. Empty ⇒ genuinely calm day (never invented). */
  collisions: PlanCollision[];
  /** Deterministic, source-grounded summary counts for the header line. */
  stats: {
    overdueCommitments: number;
    dueTodayCommitments: number;
    repliesWaiting: number;
    eventsToday: number;
    todosDueToday: number;
    /** Items needing confirmation (medium/low commitments). */
    questions: number;
  };
  /** True when there is genuinely nothing pressing → honest calm state. */
  isCalm: boolean;
};
