'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Inbox', href: '/inbox' },
  { label: 'Todos', href: '/todos' },
  { label: 'Channels', href: '/channels' },
  { label: 'Kunden', href: '/kunden' },
  { label: 'Verträge', href: '/vertraege' },
  { label: 'Kalender', href: '/kalender' },
];

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {TABS.map((t) => {
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
