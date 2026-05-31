'use client';

/**
 * Promise Tracker surface — "Offene Zusagen". What YOU promised in your sent
 * mails, AI-extracted, with deadlines and overdue highlighting. The inverse
 * of a normal inbox: not what arrived, but what you owe.
 *
 * Trust-UX (Schritt 4a): only HIGH-confidence promises are asserted as hard
 * "fällig". Lower-confidence ones are framed as "mögliche Zusage — bestätigen?"
 * and never counted as fact. Every item can reveal its source sentence ("warum
 * ist das hier") so the AI shows its evidence instead of just claiming.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  extractCommitments,
  resolveCommitment,
  dismissCommitment,
  commitmentToTodo,
  confirmCommitment,
} from '@/lib/actions/commitments';
import { toast } from '@/lib/stores/toast-store';
import type { OpenCommitment } from '@/lib/db/queries/commitments';

function dueLabel(c: OpenCommitment): { text: string; color: string } {
  if (c.overdueDays != null) {
    return { text: `${c.overdueDays} ${c.overdueDays === 1 ? 'Tag' : 'Tage'} überfällig`, color: '#ff8a8a' };
  }
  if (c.dueAt) {
    const d = new Date(c.dueAt);
    const days = Math.round((new Date(c.dueAt).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
    const label = days === 0 ? 'heute' : days === 1 ? 'morgen' : days < 7 ? `in ${days}T` : d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    return { text: `fällig ${label}`, color: days <= 1 ? '#E8B86D' : '#9c9c9d' };
  }
  return { text: 'ohne Frist', color: '#6a6b6c' };
}

export function CommitmentsPanel({ commitments }: { commitments: OpenCommitment[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const scan = () =>
    start(async () => {
      const res = await extractCommitments();
      if (!res.ok) {
        toast(res.error, 'danger');
        return;
      }
      if (res.rateLimited) {
        toast(
          res.found > 0
            ? `${res.found} erfasst, dann KI-Limit erreicht — Rest beim nächsten Versuch`
            : 'KI-Limit erreicht (Gateway) — bitte später erneut, nichts geht verloren',
          'danger'
        );
      } else {
        toast(
          res.found > 0 ? `${res.found} Zusage${res.found === 1 ? '' : 'n'} erfasst` : 'Keine neuen Zusagen gefunden',
          'success'
        );
      }
      router.refresh();
    });

  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  // Split by confidence threshold: 'high' is asserted; everything else needs
  // confirmation before it's treated as a real obligation.
  const firm = commitments.filter((c) => c.confidence === 'high');
  const tentative = commitments.filter((c) => c.confidence !== 'high');

  return (
    <section className="mb-6 rounded-[16px] border border-white/[0.06] bg-white/[0.015] shadow-panel">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[13px]">🤝</span>
          <h3 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-200">
            Offene Zusagen{firm.length > 0 ? ` · ${firm.length}` : ''}
          </h3>
        </div>
        <button
          type="button"
          onClick={scan}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#5E9EFF]/25 bg-[#5E9EFF]/[0.08] px-3 py-1 text-[12px] text-[#5E9EFF] transition-colors hover:bg-[#5E9EFF]/[0.14] disabled:opacity-50"
        >
          <span aria-hidden>✦</span>
          {pending ? 'Scanne …' : 'Gesendete Mails scannen'}
        </button>
      </header>

      {commitments.length === 0 ? (
        <p className="px-4 py-5 text-[12.5px] leading-relaxed text-ink-300">
          Ctrl K verfolgt, was <span className="text-ink-100">du</span> versprochen hast — aus deinen
          gesendeten Mails. Scanne sie, um offene Zusagen mit Fristen hier zu sehen.
        </p>
      ) : (
        <AnimatePresence initial={false}>
          <ul className="flex flex-col divide-y divide-white/[0.04]">
            {firm.map((c) => (
              <CommitmentRow key={c.id} c={c} pending={pending} act={act} tentative={false} />
            ))}
          </ul>

          {tentative.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-4 pb-1.5 pt-3">
                <span aria-hidden className="text-[11px]">❓</span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.4px] text-ink-300">
                  Mögliche Zusagen · bitte bestätigen
                </span>
              </div>
              <ul className="flex flex-col divide-y divide-white/[0.04]">
                {tentative.map((c) => (
                  <CommitmentRow key={c.id} c={c} pending={pending} act={act} tentative />
                ))}
              </ul>
            </>
          )}
        </AnimatePresence>
      )}
    </section>
  );
}

function CommitmentRow({
  c,
  pending,
  act,
  tentative,
}: {
  c: OpenCommitment;
  pending: boolean;
  act: (fn: () => Promise<unknown>) => void;
  tentative: boolean;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const due = dueLabel(c);

  return (
    <motion.li
      layout
      exit={{ opacity: 0, height: 0 }}
      className="group flex flex-col gap-1 px-4 py-2.5"
      style={tentative ? { opacity: 0.82 } : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-ink-50">{c.promiseText}</span>
          <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-300">
            {c.customerId && c.customerName ? (
              <Link href={`/kunden/${c.customerId}`} className="truncate text-[#5ee08a] hover:underline">
                {c.customerName}
              </Link>
            ) : (
              <span className="truncate">{c.recipientName ?? c.recipientEmail ?? '—'}</span>
            )}
            {!tentative && (
              <>
                <span aria-hidden className="text-ink-300/60">·</span>
                <span style={{ color: due.color }}>{due.text}</span>
              </>
            )}
            {c.sourceQuote && (
              <>
                <span aria-hidden className="text-ink-300/60">·</span>
                <button
                  type="button"
                  onClick={() => setShowWhy((v) => !v)}
                  className="text-ink-300 underline decoration-dotted underline-offset-2 transition-colors hover:text-ink-100"
                >
                  warum?
                </button>
              </>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {tentative && (
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => confirmCommitment(c.id))}
              className="font-mono text-[10px] uppercase tracking-[0.3px] text-[#E8B86D] transition-colors hover:text-[#F0C079] disabled:opacity-50"
            >
              Ist Zusage
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              act(async () => {
                const r = await commitmentToTodo(c.id);
                toast(r.ok ? 'Als Todo angelegt' : r.error, r.ok ? 'success' : 'danger');
              })
            }
            className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:text-[#5E9EFF] disabled:opacity-50"
          >
            → Todo
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => resolveCommitment(c.id))}
            className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:text-[#5ee08a] disabled:opacity-50"
          >
            Erledigt
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => dismissCommitment(c.id))}
            className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:text-ink-50 disabled:opacity-50"
          >
            Verwerfen
          </button>
        </span>
      </div>

      {showWhy && c.sourceQuote && (
        <p className="ml-0 mt-1 border-l-2 border-white/10 pl-2.5 font-mono text-[11px] italic leading-relaxed text-ink-300">
          „{c.sourceQuote}"
        </p>
      )}
    </motion.li>
  );
}
