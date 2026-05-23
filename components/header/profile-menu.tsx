'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type ProfileProps = {
  name: string;
  email: string;
  initials: string;
  from: string;
  to: string;
};

export function ProfileMenu(props: ProfileProps) {
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

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profil-Menü öffnen"
        className="group flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-white/[0.08] transition-all duration-150 hover:ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <Avatar profile={props} size={28} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-[1000] min-w-[260px] rounded-[10px] border border-white/10 bg-[rgba(20,21,23,0.96)] p-1.5 text-[13px] shadow-panel backdrop-blur-md backdrop-saturate-150"
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
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium leading-none text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        background: `linear-gradient(180deg, ${profile.from} 0%, ${profile.to} 100%)`,
        boxShadow: '0 1px 0 0 rgba(0,0,0,.2), inset 0 1px 0 0 rgba(255,255,255,.14)',
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
