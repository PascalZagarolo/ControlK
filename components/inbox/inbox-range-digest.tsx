'use client';

/**
 * AI summary line for the active time range ("Heute" / "Diese Woche"): a
 * natural-language synthesis of what arrived — "Vier Kunden haben sich
 * gemeldet. Dein DHL-Paket kommt heute." Auto-loads when the range changes.
 */
import { useEffect, useState, useTransition } from 'react';
import { motion } from 'framer-motion';
import { inboxRangeDigest } from '@/lib/actions/inbox-ai';
import type { InboxRange } from '@/lib/db/queries/inbox-overview';

export function InboxRangeDigest({ range }: { range: InboxRange }) {
  const [digest, setDigest] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setDigest(null);
    setErr(null);
    start(async () => {
      const res = await inboxRangeDigest(range);
      if (res.ok) setDigest(res.digest);
      else setErr(res.error);
    });
  }, [range]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 flex items-start gap-3 rounded-[12px] border border-[#5E9EFF]/18 bg-[#5E9EFF]/[0.05] px-4 py-3"
    >
      <span className="mt-0.5 shrink-0 text-[13px] text-[#5E9EFF]" aria-hidden>
        ✦
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#5E9EFF]">
          {range === 'today' ? 'Heute' : 'Diese Woche'}
        </p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-50">
          {pending ? 'Fasse zusammen …' : err ? `⚠ ${err}` : digest}
        </p>
      </div>
    </motion.div>
  );
}
