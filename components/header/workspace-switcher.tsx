'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { switchWorkspace } from '@/lib/actions/workspace';
import { CreateWorkspaceModal } from '@/components/workspace/create-workspace-modal';

type Ws = {
  id: string;
  slug: string;
  name: string;
  short: string;
  from: string;
  to: string;
  scope?: 'business' | 'private';
};

function ScopeChip({ scope }: { scope: 'business' | 'private' }) {
  const isPrivate = scope === 'private';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.4px]"
      style={{
        background: isPrivate ? '#ffb45e1f' : '#5eb6ff1f',
        color: isPrivate ? '#ffb45e' : '#5eb6ff',
      }}
      title={isPrivate ? 'Privater Workspace' : 'Business-Workspace'}
    >
      {isPrivate ? '🏡 Privat' : '💼 Business'}
    </span>
  );
}

function Badge({ ws, size = 22 }: { ws: Ws; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[5px] font-mono text-[10px] font-semibold leading-none text-white shadow-key"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(180deg, ${ws.from} 0%, ${ws.to} 100%)`,
      }}
    >
      {ws.short}
    </span>
  );
}

export function WorkspaceSwitcher({
  active,
  workspaces,
}: {
  active: Ws;
  workspaces: Ws[];
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open && !creating) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, creating]);

  const others = workspaces.filter((w) => w.id !== active.id);

  const onSwitch = (slug: string) => {
    setOpen(false);
    start(async () => {
      const res = await switchWorkspace(slug);
      if (res.ok) router.refresh();
    });
  };

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <a
        href="/"
        className="flex items-center gap-2 rounded-[6px] px-1 py-1.5 text-[15px] font-medium leading-none tracking-[-0.2px] text-ink-50 transition-colors hover:bg-white/[0.06]"
        aria-label={`${active.name} home`}
      >
        <Badge ws={active} />
        <span>{active.name}</span>
        {active.scope && <ScopeChip scope={active.scope} />}
      </a>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Workspace wechseln"
        className="ml-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-ink-50/60 transition-all duration-200 ease-soft hover:bg-white/[0.08] hover:text-ink-50"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ease-soft ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-[1000] min-w-[280px] rounded-[10px] border border-white/10 bg-[rgba(20,21,23,0.96)] p-1.5 text-[13px] shadow-panel backdrop-blur-md backdrop-saturate-150"
        >
          <SectionLabel>Aktiv</SectionLabel>
          <Item leading={<Badge ws={active} size={20} />} trailing={<CheckIcon />} ariaCurrent>
            {active.name}
          </Item>

          {(() => {
            const business = others.filter((w) => w.scope !== 'private');
            const privateOnes = others.filter((w) => w.scope === 'private');
            return (
              <>
                {business.length > 0 && <SectionLabel>💼 Business</SectionLabel>}
                {business.map((w) => (
                  <Item
                    key={w.id}
                    leading={<Badge ws={w} size={20} />}
                    onClick={() => onSwitch(w.slug)}
                  >
                    {w.name}
                  </Item>
                ))}
                {privateOnes.length > 0 && <SectionLabel>🏡 Privat</SectionLabel>}
                {privateOnes.map((w) => (
                  <Item
                    key={w.id}
                    leading={<Badge ws={w} size={20} />}
                    onClick={() => onSwitch(w.slug)}
                  >
                    {w.name}
                  </Item>
                ))}
              </>
            );
          })()}

          <div className="mx-1 my-1.5 h-px bg-white/[0.07]" />

          <Item
            leading={<PlusIcon />}
            muted
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
          >
            Neuen Workspace anlegen
          </Item>
          <Link
            href="/workspaces/across"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[12.5px] text-ink-200 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <span className="flex shrink-0 items-center text-ink-300">⌬</span>
            <span className="flex-1">Across all Workspaces</span>
          </Link>
          <Link
            href="/workspaces/discover"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[12.5px] text-ink-200 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <span className="flex shrink-0 items-center text-ink-300">⌖</span>
            <span className="flex-1">Public-Workspaces durchsuchen</span>
          </Link>
          <Link
            href="/workspace/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[12.5px] text-ink-200 transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <span className="flex shrink-0 items-center text-ink-300">⚙</span>
            <span className="flex-1">Workspace-Settings</span>
          </Link>
        </div>
      )}

      <CreateWorkspaceModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
      {children}
    </div>
  );
}

function Item({
  children,
  leading,
  trailing,
  onClick,
  muted,
  ariaCurrent,
}: {
  children: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  muted?: boolean;
  ariaCurrent?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      aria-current={ariaCurrent ? 'true' : undefined}
      className={`flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left transition-colors duration-150 hover:bg-white/[0.05] hover:text-white ${
        muted ? 'text-[12.5px] text-ink-200' : 'text-[13px] text-[#cdcece]'
      }`}
    >
      {leading && <span className="flex shrink-0 items-center text-ink-300">{leading}</span>}
      <span className="flex-1">{children}</span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-55">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
