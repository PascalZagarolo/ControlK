'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { HashAvatar } from './hash-avatar';
import type { ChannelMemberDetail } from '@/lib/types';

const CANVAS = '#0A0A0C';
const STACK_LIMIT = 5;

export function MemberStack({
  members,
  currentUserId,
  isOwner,
}: {
  members: ChannelMemberDetail[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const sorted = [...members].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });
  const visible = sorted.slice(0, STACK_LIMIT);
  const overflow = sorted.length - visible.length;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${members.length} ${members.length === 1 ? 'Mitglied' : 'Mitglieder'}`}
        aria-expanded={open}
        className="group flex items-center"
      >
        <span className="flex items-center">
          {visible.map((m, i) => (
            <span
              key={m.userId}
              className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: visible.length - i }}
            >
              <HashAvatar userId={m.userId} name={m.name} size={24} ringColor={CANVAS} />
            </span>
          ))}
          {overflow > 0 && (
            <span
              className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
              style={{ marginLeft: -8, zIndex: 0 }}
            >
              <OverflowPill count={overflow} ringColor={CANVAS} />
            </span>
          )}
        </span>
      </button>

      {open && (
        <MemberPopover members={sorted} isOwner={isOwner} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function OverflowPill({ count, ringColor }: { count: number; ringColor: string }) {
  const label = count > 99 ? '+99' : `+${count}`;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#1F1F23] font-medium leading-none text-white"
      style={{
        width: 24,
        height: 24,
        fontSize: 11,
        boxShadow: `0 0 0 2px ${ringColor}`,
      }}
    >
      {label}
    </span>
  );
}

function MemberPopover({
  members,
  isOwner,
  onClose,
}: {
  members: ChannelMemberDetail[];
  isOwner: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Mitglieder"
      className="absolute right-0 top-[calc(100%+8px)] z-40 w-[280px] origin-top-right animate-[popoverIn_120ms_ease-out] rounded-lg border border-[#1F1F23] bg-[#161618] p-4"
      style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
        Mitglieder · {members.length}
      </p>

      <ul className="mt-3 flex flex-col">
        {members.map((m) => (
          <li key={m.userId}>
            <button
              type="button"
              onClick={() => {
                // V2: open user profile side sheet
              }}
              className="flex w-full items-center gap-3 rounded-md px-1.5 py-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <HashAvatar userId={m.userId} name={m.name} size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] leading-tight text-[#FAFAFA]">
                  {m.name}
                </span>
                <span className="mt-0.5 block truncate text-[12px] leading-tight text-[#71717A]">
                  {m.email}
                </span>
              </span>
              <span
                className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] ${
                  m.role === 'owner' ? 'text-[#E8B86D]' : 'text-[#52525B]'
                }`}
              >
                {m.role === 'owner' ? 'Owner' : 'Member'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {isOwner && (
        <>
          <div className="my-3 h-px bg-[#1F1F23]" />
          <Link
            href="/workspace/settings"
            onClick={onClose}
            className="flex items-center gap-2 px-1.5 py-1.5 text-[13px] text-[#A1A1AA] transition-colors hover:text-[#E8B86D]"
          >
            <Plus size={14} strokeWidth={2} />
            <span>Mitglied einladen</span>
          </Link>
        </>
      )}
    </div>
  );
}
