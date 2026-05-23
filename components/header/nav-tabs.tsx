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
    <nav className="flex items-center gap-1">
      {visible.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-[6px] px-2.5 py-1.5 text-[13.5px] font-medium leading-none transition-colors duration-150 ${
              active ? 'text-ink-50' : 'text-ink-200 hover:bg-white/[0.05] hover:text-ink-50'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
