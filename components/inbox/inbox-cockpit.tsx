'use client';

/**
 * "Heute"-Cockpit at the top of the inbox — the morning glance. Immediate,
 * data-driven value without any AI: what needs your reply, what you're
 * overdue waiting on, how many customer mails. An optional one-click KI
 * morning briefing adds the narrative.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { inboxDigest } from '@/lib/actions/inbox-ai';
import type { AwaitingRow } from '@/lib/db/queries/inbox-overview';

function ageColor(d: number): string {
  if (d >= 7) return '#ff8a8a';
  if (d >= 3) return '#E8B86D';
  return '#9c9c9d';
}

export function InboxCockpit({
  onYou,
  onThem,
  customerCount,
}: {
  onYou: AwaitingRow[];
  onThem: AwaitingRow[];
  customerCount: number;
}) {
  const [pending, start] = useTransition();
  const [digest, setDigest] = useState<string | null>(null);
  const [digestErr, setDigestErr] = useState<string | null>(null);

  const overdue = onThem.filter((r) => r.ageDays >= 3);
  const topReply = [...onYou].sort((a, b) => b.ageDays - a.ageDays).slice(0, 4);
  const topWaiting = [...overdue].sort((a, b) => b.ageDays - a.ageDays).slice(0, 4);
  const quiet = onYou.length === 0 && overdue.length === 0;

  const runDigest = () => {
    setDigestErr(null);
    start(async () => {
      const res = await inboxDigest();
      if (res.ok) setDigest(res.digest);
      else setDigestErr(res.error);
    });
  };

  return (
    <section className="mb-6 rounded-[16px] border border-white/[0.06] bg-white/[0.015] p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            Heute im Posteingang
          </span>
        </div>
        <button
          type="button"
          onClick={runDigest}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#5E9EFF]/25 bg-[#5E9EFF]/[0.08] px-3 py-1 text-[12px] text-[#5E9EFF] transition-colors hover:bg-[#5E9EFF]/[0.14] disabled:opacity-50"
        >
          <span aria-hidden>✦</span>
          {pending ? 'Briefing …' : 'KI-Morgen-Briefing'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {(digest || digestErr) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p
              className={`mt-3 rounded-[10px] border px-3 py-2.5 text-[13px] leading-relaxed ${
                digestErr
                  ? 'border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] text-[#ff8a8a]'
                  : 'border-[#5E9EFF]/20 bg-[#5E9EFF]/[0.05] text-ink-50'
              }`}
            >
              {digestErr ?? digest}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat tiles */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile
          href="/inbox?mode=awaiting"
          label="Braucht Antwort"
          value={onYou.length}
          accent="#5E9EFF"
        />
        <Tile
          href="/inbox?mode=awaiting"
          label="Du wartest"
          value={onThem.length}
          sub={overdue.length > 0 ? `${overdue.length} überfällig` : undefined}
          accent={overdue.length > 0 ? '#E8B86D' : '#9c9c9d'}
        />
        <Tile
          href="/inbox?category=customer"
          label="Von Kunden"
          value={customerCount}
          accent="#5ee08a"
        />
      </div>

      {quiet ? (
        <p className="mt-4 text-[13px] text-ink-300">
          Ruhiger Posteingang — nichts wartet gerade auf dich. ☕
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {topReply.length > 0 && (
            <MiniList title="Braucht deine Antwort" rows={topReply} />
          )}
          {topWaiting.length > 0 && (
            <MiniList title="Du wartest — überfällig" rows={topWaiting} waiting />
          )}
        </div>
      )}
    </section>
  );
}

function Tile({
  href,
  label,
  value,
  sub,
  accent,
}: {
  href: string;
  label: string;
  value: number;
  sub?: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-0.5 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
    >
      <span className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold tabular-nums text-ink-50" style={{ color: value > 0 ? accent : undefined }}>
          {value}
        </span>
        {sub && <span className="text-[11px] text-ink-300">{sub}</span>}
      </span>
      <span className="text-[11.5px] text-ink-300">{label}</span>
    </Link>
  );
}

function MiniList({ title, rows, waiting }: { title: string; rows: AwaitingRow[]; waiting?: boolean }) {
  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
      <div className="border-b border-white/[0.06] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        {title}
      </div>
      <ul className="flex flex-col divide-y divide-white/[0.04]">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/inbox/${r.id}`}
              className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.02]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink-50">
                  {waiting ? r.awaitingRecipient ?? r.senderName : r.senderName}
                </span>
                <span className="block truncate text-[11.5px] text-ink-300">
                  {r.subject ?? '(kein Betreff)'}
                </span>
              </span>
              <span
                className="shrink-0 font-mono text-[10.5px] tabular-nums"
                style={{ color: ageColor(r.ageDays) }}
              >
                {r.ageDays}d
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
