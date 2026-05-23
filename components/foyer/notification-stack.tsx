'use client';

/**
 * NotificationStack — vertical column of unread-inbox cards anchored to the
 * left of the foyer viewport. Makes inbox state *present* on the page
 * without forcing the user into a module.
 *
 * Visible at xl+ viewports only (≥1280px). Below that, hidden entirely;
 * the briefing's two-row form on its own is enough at smaller widths.
 *
 * The cards live on a slightly different visual layer than the rest of
 * the page: thin border, near-zero background tint, 12px backdrop-blur.
 * That makes them feel like floating objects, not flat UI.
 *
 * Mock-data only for now. Wiring to real inbox comes in a follow-up.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// ───────────────────────────────────────────────────────────────
// Types + mock data
// ───────────────────────────────────────────────────────────────

type NotifSource = 'email' | 'channel' | 'mention';

type NotifCard = {
  id: string;
  source: NotifSource;
  sourceLabel: string; // "Gmail" / "#flotte" / "Notizen"
  sender: string;
  preview: string;
  minAgo: number;
  href: string;
};

const INITIAL_NOTIFS: NotifCard[] = [
  {
    id: 'n1',
    source: 'email',
    sourceLabel: 'Gmail',
    sender: 'Anna Hoffmann',
    preview: 'Zum Vertrag morgen — kannst du den Entwurf nochmal durchgehen …',
    minAgo: 14,
    href: '/inbox?item=n1',
  },
  {
    id: 'n2',
    source: 'mention',
    sourceLabel: 'Notizen',
    sender: 'Niklas Berger',
    preview: '@Pascal — Frage zur Übergabe-Protokoll Vorlage',
    minAgo: 47,
    href: '/inbox?item=n2',
  },
  {
    id: 'n3',
    source: 'email',
    sourceLabel: 'Gmail',
    sender: 'DHL',
    preview: 'Deine Sendung ist unterwegs (Tracking ZH123456789DE)',
    minAgo: 60,
    href: '/inbox?item=n3',
  },
  {
    id: 'n4',
    source: 'channel',
    sourceLabel: '#flotte',
    sender: 'Marie Voigt',
    preview: 'WV-12 Inspektion verschoben auf Mittwoch',
    minAgo: 180,
    href: '/inbox?item=n4',
  },
  {
    id: 'n5',
    source: 'email',
    sourceLabel: 'Outlook',
    sender: 'Schmidt + Partner',
    preview: 'RE: Q4 Reporting — bitte um Rückmeldung',
    minAgo: 300,
    href: '/inbox?item=n5',
  },
  {
    id: 'n6',
    source: 'mention',
    sourceLabel: 'Todos',
    sender: 'Jonas Klein',
    preview: "@Pascal weist dir 'Steuerunterlagen sortieren' zu",
    minAgo: 420,
    href: '/inbox?item=n6',
  },
];

const SIMULATED_ARRIVALS: Omit<NotifCard, 'id' | 'href' | 'minAgo'>[] = [
  {
    source: 'email',
    sourceLabel: 'Gmail',
    sender: 'Lukas Brandt',
    preview: 'Können wir die Demo um eine Stunde vorziehen?',
  },
  {
    source: 'channel',
    sourceLabel: '#sales',
    sender: 'Jana Reiter',
    preview: 'Müller hat zugesagt — wir sollten den nächsten Schritt planen',
  },
  {
    source: 'mention',
    sourceLabel: 'Verträge',
    sender: 'Pascal R.',
    preview: '@Pascal hat dich in Q4-Rahmenvertrag erwähnt',
  },
];

const MAX_VISIBLE = 5;
const GLOW_DURATION_MS = 600;
const STACK_REVEAL_DELAY_S = 0.28;
const STACK_STAGGER_S = 0.04;

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function fmtMinAgo(min: number): string {
  if (min < 1) return 'jetzt';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}T`;
}

function sourceTypeLabel(s: NotifSource): string {
  if (s === 'email') return 'Email';
  if (s === 'channel') return 'Channel';
  return 'Mention';
}

// ───────────────────────────────────────────────────────────────
// Inline Lucide-style icons
// ───────────────────────────────────────────────────────────────

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  );
}

function HashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function AtSignIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );
}

function SourceIcon({ source, className }: { source: NotifSource; className?: string }) {
  if (source === 'email') return <MailIcon className={className} />;
  if (source === 'channel') return <HashIcon className={className} />;
  return <AtSignIcon className={className} />;
}

// ───────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────

export function NotificationStack({ dim = false }: { dim?: boolean }) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [items, setItems] = useState<NotifCard[]>(INITIAL_NOTIFS);
  const [glowId, setGlowId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const nextIdRef = useRef(7);

  // After initial reveal, drop the stagger delay so dynamically-added
  // cards animate immediately (no 280ms wait for the new arrival).
  useEffect(() => {
    const wait = STACK_REVEAL_DELAY_S * 1000 + items.length * STACK_STAGGER_S * 1000 + 220;
    const id = window.setTimeout(() => setHasInitialized(true), wait);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = items.slice(0, MAX_VISIBLE);
  const overflow = items.length - visible.length;

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
  };

  const simulateNew = () => {
    const id = `n${nextIdRef.current++}`;
    const pick = SIMULATED_ARRIVALS[Math.floor(Math.random() * SIMULATED_ARRIVALS.length)];
    const newCard: NotifCard = { id, minAgo: 0, href: `/inbox?item=${id}`, ...pick };
    setItems((prev) => [newCard, ...prev]);
    setGlowId(id);
    window.setTimeout(() => setGlowId(null), GLOW_DURATION_MS);
  };

  const handleClick = (e: React.MouseEvent, card: NotifCard) => {
    // ⌘/Ctrl-click dismisses without navigating. Right-click also dismisses.
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      dismiss(card.id);
      return;
    }
    router.push(card.href);
  };

  return (
    <>
      <aside
        aria-label="Neue Mitteilungen"
        className="pointer-events-none fixed left-8 top-[120px] z-30 hidden w-[320px] transition-opacity duration-300 ease-out xl:block"
        style={{ opacity: dim ? 0.45 : 1 }}
      >
        <AnimatePresence initial={false}>
          {visible.map((card, i) => {
            const isGlowing = card.id === glowId;
            const delay = hasInitialized
              ? 0
              : STACK_REVEAL_DELAY_S + i * STACK_STAGGER_S;
            return (
              <motion.button
                key={card.id}
                type="button"
                layout
                initial={prefersReducedMotion ? false : { opacity: 0, x: -12 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  boxShadow: isGlowing
                    ? '0 0 0 1px rgba(232, 184, 109, 0.55), 0 0 18px rgba(232, 184, 109, 0.30)'
                    : '0 0 0 0px rgba(232, 184, 109, 0), 0 0 0 0px rgba(232, 184, 109, 0)',
                }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        x: -50,
                        transition: { duration: 0.24, ease: [0.32, 0.72, 0, 1] },
                      }
                }
                transition={{
                  opacity: { duration: 0.2, delay, ease: 'easeOut' },
                  x: { duration: 0.2, delay, ease: 'easeOut' },
                  boxShadow: { duration: 0.3, ease: 'easeOut' },
                  layout: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
                }}
                onClick={(e) => handleClick(e, card)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  dismiss(card.id);
                }}
                className="pointer-events-auto mb-3 block w-full cursor-pointer rounded-[10px] border border-[#1F1F23] p-3.5 text-left backdrop-blur-[12px] transition-[background-color,border-color,transform] duration-150 ease-out hover:translate-x-[2px] hover:border-[#2A2A30]"
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
                }}
              >
                <div className="flex items-center gap-1.5">
                  <SourceIcon
                    source={card.source}
                    className="h-3 w-3 shrink-0 text-[#52525B]"
                  />
                  <span className="truncate font-mono text-[10px] uppercase tracking-[0.4px] text-[#52525B]">
                    {sourceTypeLabel(card.source)} · {card.sourceLabel}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-[#52525B]">
                    {fmtMinAgo(card.minAgo)}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[13px] font-medium leading-tight text-[#FAFAFA]">
                  {card.sender}
                </p>
                <p className="mt-1 truncate text-[12px] leading-tight text-[#A1A1AA]">
                  {card.preview}
                </p>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {overflow > 0 && (
          <motion.button
            type="button"
            onClick={() => router.push('/inbox')}
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{
              duration: 0.2,
              delay: hasInitialized
                ? 0
                : STACK_REVEAL_DELAY_S + visible.length * STACK_STAGGER_S,
            }}
            className="pointer-events-auto block w-full cursor-pointer rounded-[10px] border border-[#1F1F23] py-4 text-center text-[12px] text-[#52525B] backdrop-blur-[12px] transition-opacity duration-150 hover:opacity-60"
            style={{ background: 'rgba(255, 255, 255, 0.015)' }}
          >
            + {overflow} {overflow === 1 ? 'weiteres' : 'weitere'}
          </motion.button>
        )}
      </aside>

      {/* Dev-only: simulate an incoming notification. Hidden on small viewports
          where the stack itself is hidden. */}
      <button
        type="button"
        onClick={simulateNew}
        title="Dev: simulate incoming notification"
        className="fixed bottom-4 left-8 z-40 hidden rounded-md border border-[#1F1F23] bg-[#0E0E11] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-[#52525B] transition-colors duration-150 hover:border-[#2A2A30] hover:text-[#A1A1AA] xl:block"
      >
        ↓ neue Mitteilung
      </button>
    </>
  );
}
