'use client';

/**
 * AI renewal draft for a contract — one button produces an editable renewal
 * message (email) the user can copy. Surfaced on the contract detail page,
 * useful especially for expiring / renewable contracts.
 */
import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { contractRenewalDraft } from '@/lib/actions/crm-ai';
import { toast } from '@/lib/stores/toast-store';

export function ContractRenewalDraft({ contractId }: { contractId: string }) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    start(async () => {
      const res = await contractRenewalDraft(contractId);
      if (res.ok) setDraft(res.draft);
      else setError(res.error);
    });
  };

  const copy = () => {
    if (!draft) return;
    navigator.clipboard?.writeText(draft).then(
      () => toast('Entwurf kopiert', 'success'),
      () => toast('Kopieren fehlgeschlagen', 'danger')
    );
  };

  return (
    <section className="rounded-[12px] border border-[#5E9EFF]/15 bg-[#5E9EFF]/[0.04] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-[#5E9EFF]">
          <span aria-hidden>✦</span> KI
        </span>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[12px] text-ink-100 transition-colors hover:border-white/[0.18] hover:text-ink-50 disabled:opacity-50"
        >
          {pending ? 'Entwerfe …' : draft ? 'Neu entwerfen' : 'Verlängerung entwerfen'}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-[#ff8a8a]">⚠ {error}</p>}

      <AnimatePresence initial={false}>
        {draft !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
                className="w-full resize-y rounded-[8px] border border-white/[0.08] bg-black/20 p-3 text-[13px] leading-relaxed text-ink-100 outline-none focus:border-[#5E9EFF]/40"
              />
              <button
                type="button"
                onClick={copy}
                className="mt-2 rounded-full bg-[#5E9EFF] px-3 py-1 text-[12px] font-medium text-black transition-colors hover:bg-[#7CB0FF]"
              >
                Kopieren
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
