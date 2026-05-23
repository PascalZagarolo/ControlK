'use client';

import { useEffect } from 'react';
import Link from 'next/link';

type ChannelLite = { slug: string; name: string; unread?: number };

export function ChannelSwitcher({
  open,
  onClose,
  activeSlug,
  channels,
}: {
  open: boolean;
  onClose: () => void;
  activeSlug?: string;
  channels: ChannelLite[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed bottom-0 left-0 top-0 z-50 flex w-[300px] flex-col border-r border-white/[0.06] bg-[rgba(14,15,18,0.96)] shadow-panel backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-300">
            Channels
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {channels.length === 0 ? (
            <div className="px-2 py-8 text-center text-[13px] text-ink-300">
              Noch keine Channels.{' '}
              <Link
                href="/channels"
                onClick={onClose}
                className="text-ink-50 underline transition-colors hover:text-[#5eb6ff]"
              >
                Ersten erstellen
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {channels.map((c) => {
                const isActive = c.slug === activeSlug;
                return (
                  <Link
                    key={c.slug}
                    href={`/channels/${c.slug}`}
                    onClick={onClose}
                    className={`flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] transition-colors duration-150 ${
                      isActive
                        ? 'bg-white/[0.06] text-ink-50'
                        : 'text-ink-200 hover:bg-white/[0.05] hover:text-ink-50'
                    }`}
                  >
                    <span className="font-mono text-ink-300">#</span>
                    <span className="truncate">{c.name}</span>
                    {c.unread && c.unread > 0 ? (
                      <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#5eb6ff]/15 px-1.5 font-mono text-[10px] font-medium text-[#5eb6ff]">
                        {c.unread}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
