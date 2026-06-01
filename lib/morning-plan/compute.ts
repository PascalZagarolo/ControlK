// ─── Morning Plan — deterministic prioritisation + collision engine ──
//
// Pure. No DB, no AI, no `server-only`. Everything keys off the injected
// `now`, so tests are fully deterministic (compute.test.ts).
//
// Design (per Prompt 4):
//  - This is a SYNTHESIS, not a concatenation of sources. Items from all
//    sources flow into ONE prioritised stream, scored by a single rubric.
//  - Priority rubric: time-critical obligations TOWARD PEOPLE (commitments
//    you owe, customers waiting) outrank internal tasks (todos). Calendar
//    events anchor the day but rank below human obligations.
//  - Collisions are the differentiator: cross-source facts no single source
//    can see (a promise due today on a calendar-blocked morning; several
//    overdue promises; a customer waiting many days). NEVER invented — if
//    there's no real collision, the list is empty and the day is "calm".
//  - The LLM does NOT run here. It may later phrase the result (summarize.ts)
//    but the items + order + collisions are computed here from real data.

import type {
  CommitmentInput,
  EventInput,
  MorningPlan,
  MorningPlanInput,
  PlanCollision,
  PlanConfidence,
  PlanItem,
  ReplyWaitingInput,
  TodoInput,
} from './types';

const DAY_MS = 86_400_000;

// ── Score bands. Higher = more urgent. Bands are spaced so a kind never
//    crosses into another band via its within-band bonuses. ──
const BAND = {
  commitmentOverdue: 10_000,
  commitmentDueToday: 8_000,
  replyWaiting: 6_000,
  eventToday: 4_000,
  todoOverdue: 3_000,
  todoDueToday: 2_000,
  commitmentOpenFuture: 1_000,
} as const;

// A customer waiting at least this long is flagged as a collision.
const LONG_WAIT_DAYS = 4;
// "Morning packed" threshold for the due-today-vs-busy collision.
const BUSY_MORNING_EVENTS = 2;
// medium/low commitments are posed as questions, not asserted.
const QUESTION_CONFIDENCES: ReadonlySet<PlanConfidence> = new Set(['medium', 'low']);

function startOfDay(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isSameDay(iso: string, now: Date): boolean {
  const t = new Date(iso).getTime();
  const s = startOfDay(now);
  return t >= s && t < s + DAY_MS;
}

function daysOverdue(dueIso: string, now: Date): number {
  return Math.max(0, Math.floor((startOfDay(now) - startOfDay(new Date(dueIso))) / DAY_MS));
}

function isQuestionConfidence(c: PlanConfidence): boolean {
  return QUESTION_CONFIDENCES.has(c);
}

function personLabel(c: { recipientName: string | null; recipientEmail: string | null; customerName: string | null }): string {
  return c.customerName || c.recipientName || c.recipientEmail || 'jemanden';
}

// ── Commitment → plan item(s). Drops quote-less ones (Prompt-3 guard). ──
function commitmentItems(commitments: CommitmentInput[], now: Date): PlanItem[] {
  const out: PlanItem[] = [];
  for (const c of commitments) {
    // Hallucination guard (Prompt 3): never surface a commitment without
    // its verbatim source sentence — neither asserted nor as a question.
    if (!c.sourceQuote || !c.sourceQuote.trim()) continue;

    const question = isQuestionConfidence(c.confidence);
    const who = personLabel(c);
    // Reason = the source sentence (the evidence). For a question we frame it.
    const reason = question
      ? `Sieht nach einer Zusage aus: „${c.sourceQuote.trim()}" — stimmt das?`
      : `Du hast zugesagt: „${c.sourceQuote.trim()}"`;

    let kind: PlanItem['kind'];
    let score: number;
    let timing: string | null = null;

    if (c.dueAt && new Date(c.dueAt).getTime() < startOfDay(now)) {
      const od = daysOverdue(c.dueAt, now);
      kind = 'commitment_overdue';
      // Older overdue ranks higher within the band (capped so it can't leak).
      score = BAND.commitmentOverdue + Math.min(od, 30) * 10;
      timing = `${od} ${od === 1 ? 'Tag' : 'Tage'} überfällig`;
    } else if (c.dueAt && isSameDay(c.dueAt, now)) {
      kind = 'commitment_due_today';
      score = BAND.commitmentDueToday;
      timing = 'fällig heute';
    } else {
      kind = 'commitment_open';
      score = BAND.commitmentOpenFuture;
      timing = c.dueAt
        ? `fällig ${new Date(c.dueAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}`
        : c.dueBasis
          ? `Frist: ${c.dueBasis}`
          : 'ohne Frist';
    }

    // High-confidence dated obligations lead their band; questions sink a bit.
    if (c.confidence === 'high') score += 50;
    if (question) score -= 100;

    out.push({
      key: `commitment:${c.id}`,
      sourceId: c.id,
      kind,
      source: 'commitment',
      title: c.promiseText,
      reason,
      timing,
      confidence: c.confidence,
      isQuestion: question,
      score,
      // Questions: confirm or dismiss first. Firm: done / not today / dismiss.
      actions: question ? ['confirm', 'dismiss'] : ['done', 'to_todo', 'not_today', 'dismiss'],
      href: c.customerId ? `/kunden/${c.customerId}` : '/inbox',
      customerName: c.customerName,
    });
  }
  return out;
}

function replyItems(replies: ReplyWaitingInput[], now: Date): PlanItem[] {
  return replies.map((r) => {
    // Longer waits rank higher within the reply band (capped).
    const score = BAND.replyWaiting + Math.min(r.ageDays, 30) * 10;
    const timing =
      r.ageDays <= 0 ? 'heute eingegangen' : `wartet seit ${r.ageDays} ${r.ageDays === 1 ? 'Tag' : 'Tagen'}`;
    return {
      key: `inbox:${r.id}`,
      sourceId: r.id,
      kind: 'reply_waiting' as const,
      source: 'inbox' as const,
      title: r.senderName,
      reason: `Braucht deine Antwort · ${r.subject ?? '(kein Betreff)'}`,
      timing,
      confidence: 'high' as const,
      isQuestion: false,
      score,
      actions: ['to_todo', 'not_today', 'done'],
      href: `/inbox/${r.id}`,
      customerName: null,
    };
  });
}

function eventItems(events: EventInput[], now: Date): PlanItem[] {
  return events
    .filter((e) => e.allDay || isSameDay(e.startsAt, now))
    .map((e) => {
      const time = e.allDay
        ? 'ganztägig'
        : new Date(e.startsAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      // Earlier events rank slightly higher so the morning leads.
      const minsIntoDay = Math.max(0, Math.floor((new Date(e.startsAt).getTime() - startOfDay(now)) / 60_000));
      const score = BAND.eventToday + Math.max(0, 1440 - minsIntoDay) / 10;
      return {
        key: `calendar:${e.id}`,
        sourceId: e.id,
        kind: 'event_today' as const,
        source: 'calendar' as const,
        title: e.title,
        reason: e.customerName ? `Termin mit ${e.customerName}` : 'Termin heute',
        timing: time,
        confidence: 'high' as const,
        isQuestion: false,
        score,
        actions: [], // calendar events aren't checked off from the plan
        href: `/kalender?event=${e.id}`,
        customerName: e.customerName,
      };
    });
}

function todoItems(todos: TodoInput[], now: Date): PlanItem[] {
  const out: PlanItem[] = [];
  for (const t of todos) {
    const due = t.dueAt;
    const isOverdue = t.overdue && !!due;
    const isDueToday = !!due && isSameDay(due, now);
    if (!isOverdue && !isDueToday) continue; // plan only shows today-relevant todos

    const prioBonus = { urgent: 60, hoch: 40, mittel: 20, niedrig: 0 }[t.priority];
    const kind = isOverdue ? ('todo_overdue' as const) : ('todo_due_today' as const);
    const score = (isOverdue ? BAND.todoOverdue : BAND.todoDueToday) + prioBonus;
    const timing = isOverdue && due ? `${daysOverdue(due, now)} ${daysOverdue(due, now) === 1 ? 'Tag' : 'Tage'} überfällig` : 'fällig heute';
    out.push({
      key: `todo:${t.id}`,
      sourceId: t.id,
      kind,
      source: 'todo',
      title: t.title,
      reason: 'Eigenes Todo mit Fälligkeit heute',
      timing,
      confidence: 'high',
      isQuestion: false,
      score,
      actions: ['done', 'not_today'],
      href: `/todos?todo=${t.id}`,
      customerName: null,
    });
  }
  return out;
}

// ── Collision detection — the cross-source differentiator ──
function detectCollisions(items: PlanItem[], input: MorningPlanInput): PlanCollision[] {
  const { now, events } = input;
  const collisions: PlanCollision[] = [];

  const dueTodayCommitments = items.filter((i) => i.kind === 'commitment_due_today' && !i.isQuestion);
  const overdueCommitments = items.filter((i) => i.kind === 'commitment_overdue' && !i.isQuestion);

  // Morning = events that start before 13:00 today (or all-day events).
  const morningEvents = events.filter((e) => {
    if (e.allDay) return true;
    if (!isSameDay(e.startsAt, now)) return false;
    return new Date(e.startsAt).getHours() < 13;
  });

  // 1) A commitment due today while the morning is packed with meetings.
  if (dueTodayCommitments.length > 0 && morningEvents.length >= BUSY_MORNING_EVENTS) {
    const lead = dueTodayCommitments[0];
    collisions.push({
      kind: 'due_today_vs_busy',
      message:
        `„${lead.title}" ist heute fällig, aber der Vormittag ist mit ${morningEvents.length} Terminen belegt — ` +
        `die Zeit dafür wird knapp.`,
      relatedKeys: [lead.key, ...morningEvents.map((e) => `calendar:${e.id}`)],
      severity: 'high',
    });
  }

  // 2) Several overdue commitments at once. If they share a customer, say so.
  if (overdueCommitments.length >= 2) {
    const byCustomer = new Map<string, PlanItem[]>();
    for (const c of overdueCommitments) {
      const key = c.customerName ?? '';
      if (!key) continue;
      byCustomer.set(key, [...(byCustomer.get(key) ?? []), c]);
    }
    const sameCustomer = [...byCustomer.entries()].find(([, list]) => list.length >= 2);
    collisions.push({
      kind: 'multiple_overdue_commitments',
      message: sameCustomer
        ? `${sameCustomer[1].length} überfällige Zusagen an ${sameCustomer[0]} — die häufen sich.`
        : `${overdueCommitments.length} überfällige Zusagen offen — die ranken heute zuerst.`,
      relatedKeys: (sameCustomer ? sameCustomer[1] : overdueCommitments).map((c) => c.key),
      severity: 'high',
    });
  }

  // 3) A customer / sender waiting a long time for a reply.
  const longWaiters = items
    .filter((i) => i.kind === 'reply_waiting')
    .filter((i) => {
      const r = input.repliesWaiting.find((x) => x.id === i.sourceId);
      return r ? r.ageDays >= LONG_WAIT_DAYS : false;
    })
    .sort((a, b) => b.score - a.score);
  if (longWaiters.length > 0) {
    const top = longWaiters[0];
    const r = input.repliesWaiting.find((x) => x.id === top.sourceId)!;
    collisions.push({
      kind: 'customer_long_wait',
      message:
        longWaiters.length === 1
          ? `${top.title} wartet seit ${r.ageDays} Tagen auf eine Antwort.`
          : `${longWaiters.length} Personen warten seit Tagen auf Antwort — am längsten ${top.title} (${r.ageDays} Tage).`,
      relatedKeys: longWaiters.map((i) => i.key),
      severity: r.ageDays >= LONG_WAIT_DAYS * 2 ? 'high' : 'medium',
    });
  }

  return collisions;
}

/**
 * The deterministic core: synthesise one prioritised stream + collisions
 * from the four input sources. No invented items, no invented collisions.
 */
export function computeMorningPlan(input: MorningPlanInput): MorningPlan {
  const { now } = input;

  const items = [
    ...commitmentItems(input.commitments, now),
    ...replyItems(input.repliesWaiting, now),
    ...eventItems(input.events, now),
    ...todoItems(input.todos, now),
  ].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const collisions = detectCollisions(items, input);

  const stats = {
    overdueCommitments: items.filter((i) => i.kind === 'commitment_overdue').length,
    dueTodayCommitments: items.filter((i) => i.kind === 'commitment_due_today').length,
    repliesWaiting: items.filter((i) => i.kind === 'reply_waiting').length,
    eventsToday: items.filter((i) => i.kind === 'event_today').length,
    todosDueToday: items.filter((i) => i.kind === 'todo_due_today' || i.kind === 'todo_overdue').length,
    questions: items.filter((i) => i.isQuestion).length,
  };

  // Calm = nothing pressing. Calendar-only days still count as calm for the
  // "nothing needs action" framing, but we surface events; the calm copy
  // accounts for that. Pressing = any commitment, waiting reply, or due todo.
  const pressing =
    stats.overdueCommitments +
    stats.dueTodayCommitments +
    stats.repliesWaiting +
    stats.todosDueToday +
    items.filter((i) => i.kind === 'commitment_open').length;
  const isCalm = pressing === 0;

  return { items, collisions, stats, isCalm };
}
