'use client';

/**
 * Churn Alerts — customers who used to write regularly and have gone quiet.
 * Derived purely from the inbox chronology (no AI, no extra tables): a
 * customer with an established cadence whose silence now far outruns it.
 * The inverse of the unread list — it surfaces the absence of contact.
 */
import Link from 'next/link';
import type { ChurnAlert } from '@/lib/db/queries/churn';

function severity(ratio: number): string {
  if (ratio >= 4) return '#ff8a8a';
  if (ratio >= 3) return '#E8B86D';
  return '#9c9c9d';
}

export function ChurnPanel({ alerts }: { alerts: ChurnAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <section className="mb-6 rounded-[16px] border border-white/[0.06] bg-white/[0.015] shadow-panel">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span aria-hidden className="text-[13px]">📉</span>
        <h3 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-200">
          Churn-Risiko · {alerts.length}
        </h3>
        <span className="ml-auto text-[11px] text-ink-300">stiller als üblich</span>
      </header>

      <ul className="flex flex-col divide-y divide-white/[0.04]">
        {alerts.map((a) => (
          <li key={a.customerId} className="flex items-center gap-3 px-4 py-2.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: severity(a.silenceRatio) }}
            />
            <span className="min-w-0 flex-1">
              <Link
                href={`/kunden/${a.customerId}`}
                className="block truncate text-[13px] text-ink-50 hover:underline"
              >
                {a.customerName}
              </Link>
              <span className="mt-0.5 block text-[11.5px] text-ink-300">
                schrieb sonst alle ~{a.avgIntervalDays} Tage · jetzt{' '}
                <span style={{ color: severity(a.silenceRatio) }}>{a.daysSinceLast} Tage still</span>
              </span>
            </span>
            <span
              className="shrink-0 font-mono text-[11px] tabular-nums"
              style={{ color: severity(a.silenceRatio) }}
              title={`${a.silenceRatio}× der üblichen Pause`}
            >
              {a.silenceRatio}×
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
