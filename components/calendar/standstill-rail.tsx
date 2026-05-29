'use client';

/**
 * Compact "Stille Fäden" rail — surfaces the inverse-calendar standstills
 * (contacts whose normal rhythm has lapsed, e.g. "Vermieter Schmidt meldet
 * sich sonst alle 3 Tage — jetzt 12 Tage still") right next to the calendar,
 * each with a one-click acknowledge / snooze. Reuses the existing inverse
 * engine + actions; this is purely the surfacing layer.
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { acknowledgeStandstill, snoozeStandstill } from '@/lib/actions/inverse-calendar';
import { gridStagger, chipVariants } from './_motion';
import type { StandstillRow } from '@/lib/db/queries/inverse-calendar';

const SEVERITY: Record<string, { color: string; label: string }> = {
  kritisch: { color: '#ff8a8a', label: 'kritisch' },
  auffällig: { color: '#E8B86D', label: 'auffällig' },
};

export function StandstillRail({ standstills }: { standstills: StandstillRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <section className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] shadow-panel">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[13px]">↯</span>
          <h3 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-200">
            Stille Fäden
          </h3>
        </div>
        {standstills.length > 0 && (
          <span className="font-mono text-[10.5px] tabular-nums text-ink-300">
            {standstills.length}
          </span>
        )}
      </header>

      {standstills.length === 0 ? (
        <p className="px-4 py-5 text-[12.5px] leading-relaxed text-ink-300">
          Alles im Fluss — niemand ist über seinen üblichen Rhythmus hinaus still.
        </p>
      ) : (
        <motion.ul
          variants={gridStagger}
          initial="hidden"
          animate="show"
          className="flex flex-col"
        >
          {standstills.slice(0, 6).map((s) => {
            const sev = SEVERITY[s.severity] ?? { color: '#9c9c9d', label: s.severity };
            const rhythm = s.medianDaysBetween
              ? `sonst ~${Math.round(s.medianDaysBetween)}d`
              : `Schwelle ${s.alertThresholdDays}d`;
            return (
              <motion.li
                key={s.id}
                variants={chipVariants}
                className="flex flex-col gap-1.5 border-b border-white/[0.04] px-4 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: sev.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-50">
                    {s.entityDisplayName}
                  </span>
                  <span
                    className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.3px]"
                    style={{ color: sev.color }}
                  >
                    {sev.label}
                  </span>
                </div>
                <p className="text-[11.5px] text-ink-300">
                  seit <span className="text-ink-100">{s.daysSilent}d</span> still · {rhythm}
                </p>
                <div className="flex items-center gap-3 pt-0.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(() => acknowledgeStandstill(s.id))}
                    className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:text-ink-50 disabled:opacity-50"
                  >
                    Erledigt
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(() => snoozeStandstill(s.id, 7))}
                    className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:text-ink-50 disabled:opacity-50"
                  >
                    7 Tage später
                  </button>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </section>
  );
}
