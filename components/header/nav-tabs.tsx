'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = {
  label: string;
  href: string;
  // Tabs without a scopes array are always visible.
  // Tabs with a scopes array are only visible if the current workspace scope is included.
  scopes?: ('business' | 'private')[];
  // Tabs flagged `rental` only show when the workspace opted into the
  // uRent/Vermietungs-Pack. Keeps the default product horizontal.
  rental?: boolean;
  // Tabs flagged `businessOrRental` show in Business-scope workspaces OR
  // rental-pack ones (the customer-management module — hidden for solo/private).
  businessOrRental?: boolean;
};

// Primary tabs sit inline in the header pill. Kept lean so the pill never
// overflows; everything else lives behind the "Mehr" menu.
const PRIMARY: Tab[] = [
  // Plan leads: the synthesis surface the day starts from. Inbox/Todos/
  // Kalender are its inputs (Prompt 4) — they stay reachable as their own
  // views, but the Plan is where the priorities are computed.
  { label: 'Plan', href: '/plan' },
  { label: 'Inbox', href: '/inbox' },
  { label: 'Todos', href: '/todos' },
  // Channels only make sense once there's more than one person.
  { label: 'Channels', href: '/channels', scopes: ['business'] },
  { label: 'Kalender', href: '/kalender' },
];

// Secondary modules — fully built but previously unreachable from the nav.
// Contacts are useful for everyone (private: people you track; business:
// CRM-light); the rental/ops trio is business-only.
const MORE: Tab[] = [
  // Notizen demoted from a primary pillar (Schritt 2): notes are a light
  // capture surface, not a top-level destination. Still reachable here in
  // "Mehr"; the /notes route and all note data stay untouched.
  // TODO: Notizen in Morgen-Plan integrieren — siehe Prompt 4.
  { label: 'Notizen', href: '/notes' },
  // Contacts stay horizontal — useful for everyone, no pack required.
  { label: 'Kontakte', href: '/people' },
  // Kunden: the customer-management module — visible in Business-scope
  // workspaces (calm wedge overview + manual contacts) and rental-pack ones
  // (full CRM). Hidden for solo/private (page redirects them too).
  { label: 'Kunden', href: '/kunden', businessOrRental: true },
  { label: 'Flotte', href: '/flotte', rental: true },
  { label: 'Verträge', href: '/vertraege', rental: true },
];

export function NavTabs({
  scope = 'business',
  rentalPack = false,
}: {
  scope?: 'business' | 'private';
  rentalPack?: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const inScope = (t: Tab) =>
    (!t.scopes || t.scopes.includes(scope)) &&
    (!t.rental || rentalPack) &&
    (!t.businessOrRental || scope === 'business' || rentalPack);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const primary = PRIMARY.filter(inScope);
  const more = MORE.filter(inScope);
  const moreActive = more.some((t) => isActive(t.href));

  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  // Collapse the menu after navigating.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const tabClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-[12.5px] font-normal leading-none transition-colors duration-150 ease-out ${
      active
        ? 'bg-white/[0.06] text-[#FAFAFA]'
        : 'text-[#cbcbd0] hover:bg-white/[0.04] hover:text-[#FAFAFA]'
    }`;

  return (
    <nav className="flex items-center gap-1" aria-label="Module">
      {primary.map((t) => (
        <Link key={t.href} href={t.href} className={tabClass(isActive(t.href))}>
          {t.label}
        </Link>
      ))}

      {more.length > 0 && (
        <div ref={wrapRef} className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className={`flex items-center gap-1 ${tabClass(moreActive || moreOpen)}`}
          >
            Mehr
            <span aria-hidden className="text-[9px] opacity-70">▾</span>
          </button>
          {moreOpen && (
            <div
              role="menu"
              className="absolute left-1/2 top-9 z-50 min-w-[160px] -translate-x-1/2 rounded-[12px] border border-[#1F1F23] bg-[rgba(17,17,20,0.96)] p-1 shadow-[0_12px_32px_rgba(0,0,0,.5)] backdrop-blur-xl"
            >
              {more.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  role="menuitem"
                  className={`block rounded-[8px] px-3 py-1.5 text-[12.5px] leading-none transition-colors duration-150 ${
                    isActive(t.href)
                      ? 'bg-white/[0.06] text-[#FAFAFA]'
                      : 'text-[#cbcbd0] hover:bg-white/[0.04] hover:text-[#FAFAFA]'
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
