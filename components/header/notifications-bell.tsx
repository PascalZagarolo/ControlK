'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/channel/avatar';
import { formatRelativeTime } from '@/lib/time';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/actions/notifications';
import type { Notification, NotificationKind } from '@/lib/types';

const KIND_ICON: Record<NotificationKind, string> = {
  mention: '@',
  thread_reply: '↳',
  dm: '✉',
  system: '⌘',
  deal: '◆',
  task: '⏱',
};

export function NotificationsBell({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState<Notification[]>(initial);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const onPick = (n: Notification) => {
    setItems((items) => items.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
    setOpen(false);
    start(async () => {
      await markNotificationRead(n.id).catch(() => {});
    });
    router.push(n.sourceUrl);
  };

  const onMarkAll = () => {
    setItems((items) => items.map((n) => ({ ...n, read: true })));
    start(async () => {
      await markAllNotificationsRead().catch(() => {});
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread ? `Benachrichtigungen (${unread} ungelesen)` : 'Benachrichtigungen'}
        className={`relative flex h-8 w-8 items-center justify-center rounded-[6px] text-ink-200 transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink-50 ${
          open ? 'bg-white/[0.06] text-ink-50' : ''
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 5a2 2 0 1 1 4 0" />
          <path d="M5 17h14l-1.5-2.5V11a5.5 5.5 0 1 0-11 0v3.5L5 17z" />
          <path d="M9 21a3 3 0 0 0 6 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-[6px] top-[6px] h-[5px] w-[5px] rounded-full bg-[#ff8a8a] shadow-[0_0_4px_rgba(255,138,138,0.7)]" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[1000] w-[380px] overflow-hidden rounded-[10px] border border-white/10 bg-[rgba(14,15,18,0.96)] shadow-panel backdrop-blur-md backdrop-saturate-150"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
            <span className="text-[13px] font-medium text-ink-50">Benachrichtigungen</span>
            <button
              type="button"
              onClick={onMarkAll}
              disabled={unread === 0}
              className={`font-mono text-[10.5px] uppercase tracking-[0.3px] transition-colors ${
                unread > 0 ? 'text-ink-200 hover:text-ink-50' : 'cursor-default text-ink-300/40'
              }`}
            >
              Alle gelesen
            </button>
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-[13px] text-ink-300">
              Keine Benachrichtigungen.
            </div>
          ) : (
            <div className="max-h-[460px] overflow-y-auto py-1">
              {items.slice(0, 12).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onPick(n)}
                  className={`group flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.04] ${
                    !n.read ? 'bg-white/[0.015]' : ''
                  }`}
                >
                  <div className="pt-0.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.03] font-mono text-[12px] text-ink-200">
                      {KIND_ICON[n.kind]}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] font-medium leading-tight ${n.read ? 'text-ink-200' : 'text-ink-50'}`}>
                      {n.title}
                    </div>
                    {n.excerpt && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-ink-300">
                        {n.excerpt}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                      {formatRelativeTime(n.timestamp)}
                    </span>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-[#5eb6ff]" />}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-white/[0.06] px-3 py-2 text-center">
            <a
              href="/notifications"
              onClick={() => setOpen(false)}
              className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:text-ink-50"
            >
              Alle Benachrichtigungen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
