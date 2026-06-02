'use client';

/**
 * Morgen-Plan UI — renders the deterministic plan from lib/morning-plan.
 *
 * Principles (Prompt 4):
 *  - One prioritised STREAM, not per-source lists.
 *  - Collision hints on top — the cross-source insight, the differentiator.
 *  - Every item is explainable (reason) and one-tap actionable.
 *  - medium/low commitments render as QUESTIONS, never assertions.
 *  - Assistive tone; honest calm state when nothing presses.
 *
 * It owns NO state logic — each tap calls applyPlanAction, which routes to
 * the existing Prompt-3 / inbox / todo server actions.
 */
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { applyPlanAction } from '@/lib/actions/morning-plan';
import { toast } from '@/lib/stores/toast-store';
import type { BuiltMorningPlan } from '@/lib/morning-plan/build';
import type { PlanAction, PlanItem } from '@/lib/morning-plan/types';

function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Noch wach';
  if (h < 11) return 'Guten Morgen';
  if (h < 14) return 'Guten Mittag';
  if (h < 18) return 'Hallo';
  return 'Guten Abend';
}

const ACTION_LABEL: Record<PlanAction, string> = {
  done: 'Erledigt',
  dismiss: 'Verwerfen',
  not_today: 'Nicht heute',
  confirm: 'Ist Zusage',
  to_todo: '→ Todo',
};

// Accent per item kind — urgency read at a glance, no extra copy.
function accentFor(item: PlanItem): string {
  switch (item.kind) {
    case 'commitment_overdue':
    case 'todo_overdue':
      return '#ff8a8a';
    case 'commitment_due_today':
      return '#E8B86D';
    case 'reply_waiting':
      return '#5E9EFF';
    case 'event_today':
      return '#5ee08a';
    default:
      return '#9c9c9d';
  }
}

const KIND_KICKER: Record<PlanItem['kind'], string> = {
  commitment_overdue: 'Zusage · überfällig',
  commitment_due_today: 'Zusage · heute fällig',
  commitment_open: 'Zusage',
  reply_waiting: 'Braucht Antwort',
  event_today: 'Termin',
  todo_overdue: 'Todo · überfällig',
  todo_due_today: 'Todo · heute',
};

export function MorningPlanClient({
  plan,
  firstName,
}: {
  plan: BuiltMorningPlan;
  firstName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Items the user has handled this session collapse immediately; the server
  // revalidate then makes it permanent on the next load.
  const [handled, setHandled] = useState<Set<string>>(new Set());

  const visibleItems = useMemo(
    () => plan.items.filter((i) => !handled.has(i.key)),
    [plan.items, handled]
  );

  const act = (item: PlanItem, action: PlanAction) =>
    start(async () => {
      const res = await applyPlanAction({
        source: item.source,
        sourceId: item.sourceId,
        action,
      });
      if (!res.ok) {
        toast(res.error, 'danger');
        return;
      }
      // 'confirm' keeps the item (now firm) — just refresh. Everything else
      // removes it from today's plan.
      if (action === 'confirm') {
        toast('Als Zusage bestätigt', 'success');
        router.refresh();
        return;
      }
      setHandled((prev) => new Set(prev).add(item.key));
      toast(
        action === 'to_todo'
          ? 'Als Todo angelegt'
          : action === 'not_today'
            ? 'Auf morgen verschoben'
            : action === 'dismiss'
              ? 'Verworfen'
              : 'Erledigt',
        'success'
      );
      router.refresh();
    });

  const allDone = visibleItems.length === 0;
  const trulyCalm = plan.isCalm && plan.items.length === 0;

  // R1 for collisions: resolve each collision's relatedKeys to the actual
  // item titles it concerns, so the hint references its source items rather
  // than being a free-floating sentence.
  const itemByKey = new Map(plan.items.map((i) => [i.key, i]));
  const relatedTitles = (keys: string[]): string[] =>
    keys.map((k) => itemByKey.get(k)?.title).filter((t): t is string => !!t);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-32 pt-28 md:px-6">
      {/* Header — greeting + assistive summary (LLM-phrased, fact-grounded) */}
      <header>
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Morgen-Plan
        </span>
        <h1 className="mt-1 text-[32px] font-medium leading-[1.1] tracking-[-0.4px] text-ink-50">
          {greeting()}, {firstName}.
        </h1>
        {plan.summary && (
          <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.55] text-ink-200">
            {plan.summary}
          </p>
        )}
      </header>

      {/* Collisions — the cross-source insight, surfaced first. */}
      {plan.collisions.length > 0 && (
        <section className="flex flex-col gap-2">
          {plan.collisions.map((c, i) => {
            const refs = relatedTitles(c.relatedKeys);
            return (
              <div
                key={i}
                className="flex items-start gap-3 rounded-[12px] border px-4 py-3"
                style={{
                  borderColor: c.severity === 'high' ? 'rgba(255,138,138,0.3)' : 'rgba(232,184,109,0.28)',
                  background: c.severity === 'high' ? 'rgba(255,138,138,0.06)' : 'rgba(232,184,109,0.05)',
                }}
              >
                <span aria-hidden className="mt-0.5 text-[13px]">
                  {c.severity === 'high' ? '⚠' : '◔'}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13.5px] leading-[1.5]"
                    style={{ color: c.severity === 'high' ? '#ffb3b3' : '#E8C99A' }}
                  >
                    {c.message}
                  </p>
                  {/* R1 — the specific items this hint is about. */}
                  {refs.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {refs.slice(0, 4).map((t, j) => (
                        <span
                          key={j}
                          className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-ink-200"
                        >
                          {t}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* The prioritised stream. Connection state takes precedence so an
          empty plan is never mis-shown as "calm" when we simply haven't
          read the mailbox yet (L1/L3 — honest first-run + error states). */}
      {plan.connectionState === 'not_connected' && plan.items.length === 0 ? (
        <NotConnectedState />
      ) : plan.connectionState === 'first_scan' && plan.items.length === 0 ? (
        <FirstScanState />
      ) : trulyCalm ? (
        <CalmState eventsToday={plan.stats.eventsToday} />
      ) : allDone ? (
        <DoneState />
      ) : (
        <section className="flex flex-col">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              Heute zuerst
            </h2>
            <span className="font-mono text-[10px] text-ink-300">
              {visibleItems.length} {visibleItems.length === 1 ? 'Sache' : 'Sachen'}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {visibleItems.map((item) => (
                <PlanRow key={item.key} item={item} pending={pending} onAct={act} />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {/* Footer — provenance, honest about how the plan is made. */}
      <p className="border-t border-white/[0.06] pt-5 text-[11px] leading-[1.5] text-ink-300">
        Priorisierung und Hinweise werden aus deinen echten Daten berechnet
        (Zusagen, Mails, Kalender, Todos). Die Zusammenfassung oben formuliert nur —
        sie erfindet keine Einträge.
      </p>
    </div>
  );
}

function PlanRow({
  item,
  pending,
  onAct,
}: {
  item: PlanItem;
  pending: boolean;
  onAct: (item: PlanItem, action: PlanAction) => void;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const accent = accentFor(item);

  return (
    <motion.li
      layout
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="group overflow-hidden rounded-[12px] border border-white/[0.06] bg-white/[0.015] transition-colors hover:border-white/[0.12]"
      style={item.isQuestion ? { opacity: 0.92 } : undefined}
    >
      <div className="flex items-stretch">
        <span aria-hidden className="w-[3px] shrink-0" style={{ background: accent }} />
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3">
          {/* Kicker — kind + timing (the WHERE it comes from / urgency). */}
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[9.5px] uppercase tracking-[0.3px]"
              style={{ color: accent }}
            >
              {KIND_KICKER[item.kind]}
            </span>
            {item.timing && (
              <>
                <span aria-hidden className="text-ink-300/50">·</span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
                  {item.timing}
                </span>
              </>
            )}
            {item.customerName && (
              <>
                <span aria-hidden className="text-ink-300/50">·</span>
                <span className="truncate text-[10.5px] text-[#5ee08a]">{item.customerName}</span>
              </>
            )}
            {item.assignee && (
              <>
                <span aria-hidden className="text-ink-300/50">·</span>
                <span
                  className="truncate text-[10.5px]"
                  style={{ color: item.assignee.isMe ? '#E8B86D' : '#7c7c83' }}
                >
                  {item.assignee.isMe ? 'auf dich' : `${item.assignee.name.split(' ')[0]} ist dran`}
                </span>
              </>
            )}
          </div>

          {/* Title + link */}
          <Link href={item.href} className="block min-w-0">
            <span className="block truncate text-[14px] font-medium leading-tight text-ink-50">
              {item.title}
            </span>
          </Link>

          {/* Reason / explainability. For a question, this IS the question. */}
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            className="flex items-start gap-1 text-left"
          >
            <span
              className={`text-[12px] leading-[1.45] ${
                item.isQuestion ? 'text-[#E8C99A]' : 'text-ink-300'
              } ${showWhy ? '' : 'line-clamp-1'}`}
            >
              {item.reason}
            </span>
          </button>
        </div>

        {/* One-tap actions */}
        {item.actions.length > 0 && (
          <div className="flex shrink-0 items-center gap-1 pr-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {item.actions.map((a) => (
              <button
                key={a}
                type="button"
                disabled={pending}
                onClick={() => onAct(item, a)}
                className={`whitespace-nowrap rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2px] transition-colors disabled:opacity-40 ${
                  a === 'confirm'
                    ? 'text-[#E8B86D] hover:text-[#F0C079]'
                    : a === 'done'
                      ? 'text-ink-300 hover:text-[#5ee08a]'
                      : a === 'to_todo'
                        ? 'text-ink-300 hover:text-[#5E9EFF]'
                        : 'text-ink-300 hover:text-ink-50'
                }`}
              >
                {ACTION_LABEL[a]}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.li>
  );
}

function CalmState({ eventsToday }: { eventsToday: number }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.015] py-16 text-center">
      <span aria-hidden className="text-[22px]">☕</span>
      <p className="text-[15px] font-medium text-ink-100">
        Heute ist nichts Überfälliges offen.
      </p>
      <p className="max-w-[42ch] text-[12.5px] leading-[1.6] text-ink-300">
        {eventsToday > 0
          ? `Nur ${eventsToday} ${eventsToday === 1 ? 'Termin' : 'Termine'} im Kalender. Der Posteingang ist soweit ruhig — ein guter Moment, um vorzuarbeiten.`
          : 'Keine Zusagen fällig, keine Mails warten auf Antwort. Ein ruhiger Tag — du bist auf dem Laufenden.'}
      </p>
    </section>
  );
}

function DoneState() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.015] py-16 text-center">
      <span aria-hidden className="text-[22px]">✓</span>
      <p className="text-[15px] font-medium text-ink-100">Alles durch für heute.</p>
      <p className="max-w-[42ch] text-[12.5px] leading-[1.6] text-ink-300">
        Du hast alles aus dem heutigen Plan abgehakt. Neue Mails oder Zusagen tauchen
        automatisch beim nächsten Sync auf.
      </p>
    </section>
  );
}

// L1 — honest first-run state: connected, but the first read hasn't landed.
// NOT presented as "nothing to do" (that would be a silent empty).
function FirstScanState() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.015] py-16 text-center">
      <span aria-hidden className="text-[22px]">✦</span>
      <p className="text-[15px] font-medium text-ink-100">
        Ich schaue gerade deine letzten Mails durch …
      </p>
      <p className="max-w-[44ch] text-[12.5px] leading-[1.6] text-ink-300">
        Beim ersten Mal lese ich deinen Posteingang für die Triage und deine gesendeten
        Mails für offene Zusagen. Das dauert einen Moment — lad die Seite gleich neu.
      </p>
    </section>
  );
}

// L3 — honest "not connected" state, distinct from calm/empty.
function NotConnectedState() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.015] py-16 text-center">
      <span aria-hidden className="text-[22px]">✉</span>
      <p className="text-[15px] font-medium text-ink-100">Noch kein Postfach verbunden.</p>
      <p className="max-w-[44ch] text-[12.5px] leading-[1.6] text-ink-300">
        Verbinde dein Gmail, damit Ctrl K wartende Mails und deine Zusagen in den Plan
        holen kann. Es versendet nichts ohne deine Bestätigung.
      </p>
      <Link
        href="/settings/integrations"
        className="mt-1 rounded-md border border-[#E8B86D]/30 bg-[#E8B86D]/[0.06] px-3.5 py-2 text-[12.5px] text-[#E8B86D] transition-colors hover:bg-[#E8B86D]/[0.12]"
      >
        Postfach verbinden →
      </Link>
    </section>
  );
}
