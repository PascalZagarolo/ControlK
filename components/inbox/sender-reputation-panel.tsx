'use client';

/**
 * Sender Reputation — "Wichtige Absender". The people you consistently reply
 * to, ranked by a composite score (reply rate · speed · volume · customer).
 * Surfaces who genuinely matters in your inbox vs. who's just loud.
 */
import Link from 'next/link';
import type { SenderReputation } from '@/lib/db/queries/sender-reputation';

function responseLabel(h: number | null): string {
  if (h == null) return 'noch nie geantwortet';
  if (h < 1) return 'antwortest in <1 Std';
  if (h < 24) return `antwortest in ~${Math.round(h)} Std`;
  return `antwortest in ~${Math.round(h / 24)} Tagen`;
}

function scoreColor(score: number): string {
  if (score >= 65) return '#5ee08a';
  if (score >= 40) return '#E8B86D';
  return '#9c9c9d';
}

export function SenderReputationPanel({ senders }: { senders: SenderReputation[] }) {
  if (senders.length === 0) return null;

  return (
    <section className="mb-6 rounded-[16px] border border-white/[0.06] bg-white/[0.015] shadow-panel">
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span aria-hidden className="text-[13px]">⭐</span>
        <h3 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-200">
          Wichtige Absender
        </h3>
        <span className="ml-auto text-[11px] text-ink-300">wen du wirklich beachtest</span>
      </header>

      <ul className="flex flex-col divide-y divide-white/[0.04]">
        {senders.map((s) => (
          <li key={s.senderEmail} className="flex items-center gap-3 px-4 py-2.5">
            <span
              className="grid h-7 w-9 shrink-0 place-items-center rounded-md font-mono text-[12px] font-semibold tabular-nums"
              style={{
                color: scoreColor(s.score),
                background: `${scoreColor(s.score)}14`,
                border: `1px solid ${scoreColor(s.score)}30`,
              }}
              title={`Reputation ${s.score}/100`}
            >
              {s.score}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                {s.customerId && s.customerName ? (
                  <Link
                    href={`/kunden/${s.customerId}`}
                    className="truncate text-[13px] text-ink-50 hover:underline"
                  >
                    {s.customerName}
                  </Link>
                ) : (
                  <span className="truncate text-[13px] text-ink-50">{s.senderName}</span>
                )}
                {s.vip && (
                  <span className="shrink-0 rounded-full bg-[#5ee08a]/[0.12] px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.3px] text-[#5ee08a]">
                    VIP
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] text-ink-300">
                {s.msgCount} Mails · {Math.round(s.replyRate * 100)}% beantwortet · {responseLabel(s.avgResponseHours)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
