'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { HashAvatar } from './hash-avatar';
import { getDiscriminator } from '@/lib/avatar-colors';
import type { ChannelMemberDetail } from '@/lib/types';

const ROLE_ORDER: Record<ChannelMemberDetail['role'], number> = {
  owner: 0,
  admin: 1,
  member: 2,
  guest: 3,
};

export function MembersSidebar({
  members,
  currentUserId,
  isOwner,
}: {
  members: ChannelMemberDetail[];
  currentUserId: string;
  isOwner: boolean;
}) {
  const sorted = [...members].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    const ra = ROLE_ORDER[a.role] ?? 99;
    const rb = ROLE_ORDER[b.role] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-l border-[#1F1F23] bg-[#0B0B0E] lg:flex">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#52525B]">
          Mitglieder · {members.length}
        </span>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <ul className="flex flex-col">
          {sorted.map((m) => (
            <li key={m.userId}>
              <button
                type="button"
                onClick={() => {
                  // V2: open user profile side sheet
                }}
                className="group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.025]"
              >
                <HashAvatar userId={m.userId} name={m.name} size={22} />
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] leading-tight ${
                    m.userId === currentUserId ? 'text-[#FAFAFA]' : 'text-[#A1A1AA]'
                  } group-hover:text-[#FAFAFA]`}
                >
                  {m.name}
                  <span
                    title={`${m.name} ${getDiscriminator(m.userId)}`}
                    className="ml-1.5 font-mono text-[10px] text-[#3a3a3f] transition-colors group-hover:text-[#71717A]"
                  >
                    {getDiscriminator(m.userId)}
                  </span>
                </span>
                {m.role === 'owner' && (
                  <span
                    aria-label="Owner"
                    title="Owner"
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8B86D]"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {isOwner && (
        <div className="border-t border-[#1F1F23] px-3 py-3">
          <Link
            href="/workspace/settings"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-[#71717A] transition-colors hover:bg-white/[0.025] hover:text-[#E8B86D]"
          >
            <Plus size={13} strokeWidth={2} />
            <span>Einladen</span>
          </Link>
        </div>
      )}
    </aside>
  );
}
