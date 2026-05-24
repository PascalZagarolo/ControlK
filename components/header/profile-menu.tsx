'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type ProfileProps = {
  name: string;
  email: string;
  initials: string;
  from: string;
  to: string;
  /**
   * Where the dropdown opens relative to the trigger.
   * - 'bottom' (default): menu drops down + right-aligned. Used in the
   *   top-center floating header dock.
   * - 'top': menu opens upward + left-aligned. Used by the bottom-left
   *   ProfileDock so the menu doesn't get clipped by the viewport.
   */
  placement?: 'top' | 'bottom';
  /**
   * Trigger size in px. Top-dock uses 28; bottom-left dock uses a larger
   * anchored avatar (36) since it stands alone.
   */
  size?: number;
};

export function ProfileMenu({ placement = 'bottom', size = 28, ...props }: ProfileProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  // Placement controls trigger size hit-area + menu anchor. We compute
  // the trigger and menu classes here so the JSX below stays plain.
  const triggerPx = size;
  const triggerSize = `${triggerPx}px`;
  const menuClass =
    placement === 'top'
      ? 'absolute left-0 bottom-[calc(100%+10px)]'
      : 'absolute right-0 top-[calc(100%+8px)]';

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profil-Menü öffnen"
        className="group flex items-center justify-center rounded-full ring-1 ring-white/[0.08] transition-all duration-150 hover:ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        style={{ width: triggerSize, height: triggerSize }}
      >
        <Avatar profile={props} size={triggerPx} />
      </button>

      {open && (
        <div
          role="menu"
          className={`${menuClass} z-[1000] min-w-[260px] rounded-[10px] border border-white/10 bg-[rgba(20,21,23,0.96)] p-1.5 text-[13px] shadow-panel backdrop-blur-md backdrop-saturate-150`}
        >
          <div className="flex items-center gap-2.5 px-2 py-2.5">
            <Avatar profile={props} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-tight text-ink-50">
                {props.name}
              </div>
              <div className="mt-0.5 truncate text-[11.5px] leading-tight text-ink-300">
                {props.email}
              </div>
            </div>
          </div>

          <div className="mx-1 my-1 h-px bg-white/[0.07]" />

          <ItemLink href="/settings/account" icon={<UserIcon />}>
            Profil
          </ItemLink>
          <ItemLink href="/settings/security" icon={<ShieldIcon />}>
            Sicherheit & 2FA
          </ItemLink>
          <ItemLink href="/settings/integrations" icon={<PlugIcon />}>
            Integrationen
          </ItemLink>
          <ItemLink href="/settings/account" icon={<DownloadIcon />}>
            Daten-Export
          </ItemLink>

          <div className="mx-1 my-1 h-px bg-white/[0.07]" />

          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[13px] text-[#ff8a8a] transition-colors duration-150 hover:bg-[#ff6363]/10 hover:text-[#ff9b9b]"
            >
              <span className="flex shrink-0 items-center text-[#ff8a8a]/80">
                <LogoutIcon />
              </span>
              <span className="flex-1">Abmelden</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Avatar({ profile, size }: { profile: ProfileProps; size: number }) {
  // Header avatar uses the system amber accent — matches the workspace
  // indicator dot and the active scope chip. Per-user gradient (from/to)
  // is intentionally ignored here for visual consistency; it still drives
  // avatars in other surfaces (assignee chips, etc.).
  void profile.from;
  void profile.to;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium leading-none text-[#FAFAFA]"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: '#E8B86D',
      }}
    >
      {profile.initials}
    </span>
  );
}

function ItemLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[13px] text-[#cdcece] transition-colors duration-150 hover:bg-white/[0.05] hover:text-white"
    >
      <span className="flex shrink-0 items-center text-ink-300">{icon}</span>
      <span className="flex-1">{children}</span>
    </Link>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function PlugIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5" />
      <path d="M9 7V2" />
      <path d="M15 7V2" />
      <path d="M6 13V8h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4Z" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
