'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/channel/avatar';
import { switchWorkspace } from '@/lib/actions/workspace';
import { CreateWorkspaceModal } from './create-workspace-modal';
import type { Workspace } from '@/lib/types';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
};

export function WorkspaceSwitcher({
  current,
  all,
}: {
  current: Workspace;
  all: Workspace[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, start] = useTransition();

  const switchTo = (slug: string) => {
    setOpen(false);
    start(async () => {
      await switchWorkspace(slug);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
      >
        {current.iconEmoji ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white/[0.04] text-[16px]">
            {current.iconEmoji}
          </span>
        ) : (
          <Avatar initials={current.short} from={current.from} to={current.to} size={28} />
        )}
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium leading-tight text-ink-50">
            {current.name}
          </span>
          {current.role && (
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
              {ROLE_LABEL[current.role]}
            </span>
          )}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-1 text-ink-300"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-2 w-[280px] rounded-[12px] border border-white/[0.10] bg-[#16181d] p-2 shadow-xl backdrop-blur-md">
            <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              Meine Workspaces · {all.length}
            </p>
            <div className="flex max-h-[300px] flex-col gap-0.5 overflow-y-auto">
              {all.map((w) => {
                const active = w.id === current.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={pending}
                    onClick={() => !active && w.slug && switchTo(w.slug)}
                    className={`flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-left transition-colors ${
                      active
                        ? 'bg-white/[0.06]'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    {w.iconEmoji ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-white/[0.04] text-[14px]">
                        {w.iconEmoji}
                      </span>
                    ) : (
                      <Avatar initials={w.short} from={w.from} to={w.to} size={24} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] text-ink-50">{w.name}</span>
                      <span className="block font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
                        {w.role && ROLE_LABEL[w.role]}
                        {w.memberCount != null && ` · ${w.memberCount} Member`}
                      </span>
                    </span>
                    {active && (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#5eb6ff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="my-2 border-t border-white/[0.06]" />
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setCreateOpen(true);
                }}
                className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12.5px] text-ink-100 hover:bg-white/[0.04]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-dashed border-white/[0.18] text-[12px] text-ink-300">
                  +
                </span>
                <span>Neuen Workspace anlegen</span>
              </button>
              <Link
                href="/workspaces/discover"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12.5px] text-ink-100 hover:bg-white/[0.04]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[6px] border border-dashed border-white/[0.18] text-[12px] text-ink-300">
                  ⌖
                </span>
                <span>Public-Workspaces durchsuchen</span>
              </Link>
              <Link
                href="/workspace/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12.5px] text-ink-100 hover:bg-white/[0.04]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-white/[0.04] text-[12px] text-ink-300">
                  ⚙
                </span>
                <span>Workspace-Settings</span>
              </Link>
            </div>
          </div>
        </>
      )}

      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
