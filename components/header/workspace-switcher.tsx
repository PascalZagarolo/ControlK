'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkspace, switchWorkspace } from '@/lib/actions/workspace';

type Ws = {
  id: string;
  slug: string;
  name: string;
  short: string;
  from: string;
  to: string;
};

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

  const onCreate = (form: FormData) => {
    start(async () => {
      const res = await createWorkspace(form);
      if (res.ok) {
        setCreating(false);
        setOpen(false);
        router.push('/');
        router.refresh();
      }
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

          {others.length > 0 && <SectionLabel>Workspaces</SectionLabel>}
          {others.map((w) => (
            <Item
              key={w.id}
              leading={<Badge ws={w} size={20} />}
              onClick={() => onSwitch(w.slug)}
            >
              {w.name}
            </Item>
          ))}

          <div className="mx-1 my-1.5 h-px bg-white/[0.07]" />

          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onCreate(new FormData(e.currentTarget));
              }}
              className="flex flex-col gap-2 p-2"
            >
              <input
                name="name"
                required
                autoFocus
                placeholder="Workspace-Name"
                className="block w-full rounded-[6px] border border-white/[0.10] bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.25]"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-[6px] px-2.5 py-1.5 text-[12px] text-ink-300 hover:text-ink-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-[6px] bg-white px-2.5 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
                >
                  Erstellen
                </button>
              </div>
            </form>
          ) : (
            <Item leading={<PlusIcon />} muted onClick={() => setCreating(true)}>
              Workspace hinzufügen
            </Item>
          )}
        </div>
      )}
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
