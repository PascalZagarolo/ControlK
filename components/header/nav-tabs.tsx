'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = {
  label: string;
  href: string;
  // Tabs without a scopes array are always visible.
  // Tabs with a scopes array are only visible if the current workspace scope is included.
  scopes?: ('business' | 'private')[];
};

const TABS: Tab[] = [
  { label: 'Inbox', href: '/inbox' },
  { label: 'Todos', href: '/todos' },
  { label: 'Notizen', href: '/notes' },
  { label: 'Channels', href: '/channels' },
  { label: 'Kunden', href: '/kunden', scopes: ['business'] },
  { label: 'Flotte', href: '/flotte', scopes: ['business'] },
  { label: 'Verträge', href: '/vertraege', scopes: ['business'] },
  { label: 'Kalender', href: '/kalender' },
];

export function NavTabs({ scope = 'business' }: { scope?: 'business' | 'private' }) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => !t.scopes || t.scopes.includes(scope));
  return (
    <nav className="flex items-center gap-1" aria-label="Module">
      {visible.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-3 py-1 text-[12.5px] font-normal leading-none transition-colors duration-150 ease-out ${
              active
                ? 'bg-white/[0.06] text-[#FAFAFA]'
                : 'text-[#cbcbd0] hover:bg-white/[0.04] hover:text-[#FAFAFA]'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
