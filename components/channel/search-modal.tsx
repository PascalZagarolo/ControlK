'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/modal';

type Hit = {
  id: string;
  body: string;
  channelId: string;
  channelSlug: string;
  channelName: string;
  authorName: string;
  authorInitials: string;
  createdAt: string;
};

export function ChannelSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      start(async () => {
        const res = await fetch(`/api/channel-search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return;
        const data = (await res.json()) as Hit[];
        setHits(data);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <Modal open={open} onClose={onClose} kicker="Suche" title="Channels durchsuchen" maxWidth={640}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nachricht, Begriff, @-Mention …"
          className="rounded-[8px] border border-white/[0.10] bg-white/[0.03] px-3 py-2.5 text-[14px] text-ink-50 outline-none focus:border-white/[0.25]"
        />
        {pending && (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
            Suche …
          </p>
        )}
        {!pending && query.trim() && hits.length === 0 && (
          <p className="text-[12.5px] text-ink-300">Keine Treffer für „{query}".</p>
        )}
        <div className="flex max-h-[460px] flex-col gap-1.5 overflow-y-auto">
          {hits.map((h) => (
            <Link
              key={h.id}
              href={`/channels/${h.channelSlug}`}
              onClick={onClose}
              className="group flex items-start gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
            >
              <span className="font-mono text-[12px] text-ink-300">#</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-medium text-ink-50">{h.channelName}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                    {h.authorName} ·{' '}
                    {new Date(h.createdAt).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.45] text-ink-200">
                  {h.body}
                </p>
              </div>
              <span className="font-mono text-[11px] text-ink-300 group-hover:text-ink-50">→</span>
            </Link>
          ))}
        </div>
      </div>
    </Modal>
  );
}
