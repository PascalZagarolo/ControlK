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

export type NotifCard = {
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

const GLOW_DURATION_MS = 600;
const STACK_REVEAL_DELAY_S = 0.28;
const STACK_STAGGER_S = 0.04;
// Only the first N cards get a per-index reveal stagger — anything below
// that animates simultaneously to keep initial paint cheap when scrolled
// stacks are long.
const STAGGER_LIMIT = 5;
// Visible-area height: 4½ cards. One card slot ≈ 84px content + 12px gap
// (mb-3 on each card). 4 × 96 + half of the 5th = ~420px. The mask-image
// at the bottom fades the half-card so it reads as "there's more below."
const STACK_VISIBLE_HEIGHT_PX = 420;

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

// sourceTypeLabel removed — the icon already conveys the source type.
// The label now shows just the specific account/channel/module ("Gmail",
// "#sales", "Notizen"). Less redundant, faster to read.

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

// >5 min triggers a sync on foyer mount. Recent (< this) we trust the
// cron has it under control; no point re-hitting Gmail on every load.
const SYNC_FRESHNESS_MS = 60_000;

type StackMode =
  | 'mock' // No real query ran (anon foyer / sign-in page) — show demo
  | 'connect' // Real query ran, user has no Gmail link — show CTA
  | 'syncing' // Connected, no cards yet but auto-sync in flight — skeleton
  | 'empty' // Connected, sync done, nothing unread — Inbox Zero
  | 'real'; // Have real cards to show

export function NotificationStack({
  dim = false,
  initial,
  gmailConnected = false,
  gmailSyncedAt = null,
}: {
  dim?: boolean;
  /**
   * Real inbox items from the server. Non-empty → render. Empty array
   * means "the query ran but the workspace has 0 unread items right
   * now" — combined with gmailConnected we decide between Inbox Zero
   * vs the Connect CTA vs the demo mock. null/omit = no query ran.
   */
  initial?: NotifCard[] | null;
  /** True when the user has gmail.readonly + a refresh token. */
  gmailConnected?: boolean;
  /** ISO timestamp of last successful Gmail sync, null if never. */
  gmailSyncedAt?: string | null;
}) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const realCards = initial ?? [];
  const haveRealCards = realCards.length > 0;

  // Decide what we should be showing right now. State transitions
  // (syncing → empty/real) are driven by the auto-trigger effect below.
  const [syncing, setSyncing] = useState(false);
  const mode: StackMode = haveRealCards
    ? 'real'
    : initial === null || initial === undefined
      ? 'mock'
      : !gmailConnected
        ? 'connect'
        : syncing
          ? 'syncing'
          : 'empty';

  const seed = mode === 'real' ? realCards : mode === 'mock' ? INITIAL_NOTIFS : [];
  const [items, setItems] = useState<NotifCard[]>(seed);

  // Re-seed when the server-side query result changes (selecting another
  // workspace, post-sync router.refresh()). Without this the local state
  // would stay frozen on the first paint's seed.
  useEffect(() => {
    setItems(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, mode]);

  const [glowId, setGlowId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const nextIdRef = useRef(7);

  // Auto-trigger an incremental sync on foyer mount when (a) the user
  // has Gmail connected and (b) the last sync is older than the freshness
  // threshold. The cron handles the background case; this is the
  // "I just opened the app and want my inbox up to date" path.
  useEffect(() => {
    if (!gmailConnected) return;
    const last = gmailSyncedAt ? new Date(gmailSyncedAt).getTime() : 0;
    if (Date.now() - last < SYNC_FRESHNESS_MS) return;

    let cancelled = false;
    setSyncing(true);
    fetch('/api/inbox/sync', { method: 'POST' })
      .catch(() => {
        // Network/timeout — silent. Cron will catch up.
      })
      .finally(() => {
        if (cancelled) return;
        setSyncing(false);
        // Pull the now-updated server-component data so the stack
        // re-renders with fresh cards. router.refresh() re-runs
        // the foyer's data fetch without a full page reload.
        router.refresh();
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmailConnected, gmailSyncedAt]);

  // After initial reveal, drop the stagger delay so dynamically-added
  // cards animate immediately (no 280ms wait for the new arrival).
  useEffect(() => {
    const wait =
      STACK_REVEAL_DELAY_S * 1000 +
      Math.min(items.length, STAGGER_LIMIT) * STACK_STAGGER_S * 1000 +
      220;
    const id = window.setTimeout(() => setHasInitialized(true), wait);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Hidden dev affordance: ⌘+Shift+M (M = Mitteilung) triggers a simulated
  // incoming notification. No visible button — the production foyer doesn't
  // need dev chrome. Demo-time use: hit the shortcut to see the arrival
  // motion + glow.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !e.shiftKey) return;
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        simulateNew();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {/* Hide the webkit scrollbar on the stack — the cards are the affordance,
          no chrome needed. Firefox uses scrollbar-width:none on the aside. */}
      <style>{`aside[data-notif-stack]::-webkit-scrollbar { width: 0; height: 0; display: none; }`}</style>

      <aside
        aria-label="Neue Mitteilungen"
        data-notif-stack
        className="pointer-events-none fixed left-8 top-[120px] z-30 hidden w-[320px] transition-opacity duration-300 ease-out xl:block"
        style={{
          opacity: dim ? 0.45 : 1,
          // Show 4½ cards. Anything beyond is reachable by scroll, but the
          // bottom mask fades the half-card so the affordance reads as
          // "more below" without needing a visible scrollbar.
          maxHeight: `${STACK_VISIBLE_HEIGHT_PX}px`,
          overflowY: 'auto',
          scrollbarWidth: 'none',
          maskImage:
            'linear-gradient(180deg, black 0, black calc(100% - 56px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, black 0, black calc(100% - 56px), transparent 100%)',
        }}
      >
        {/* Non-card states: Connect CTA / Skeleton / Inbox Zero. Rendered
            as a single placeholder so the stack's footprint stays steady
            (no layout shift when sync completes and real cards arrive). */}
        {mode !== 'real' && mode !== 'mock' && (
          <StackPlaceholder mode={mode} />
        )}

        <AnimatePresence initial={false}>
          {items.map((card, i) => {
            const isGlowing = card.id === glowId;
            const delay = hasInitialized
              ? 0
              : i < STAGGER_LIMIT
                ? STACK_REVEAL_DELAY_S + i * STACK_STAGGER_S
                : STACK_REVEAL_DELAY_S + STAGGER_LIMIT * STACK_STAGGER_S;
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
                    {card.sourceLabel}
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
      </aside>

    </>
  );
}

// ───────────────────────────────────────────────────────────────
// Non-card states
// ───────────────────────────────────────────────────────────────

function StackPlaceholder({ mode }: { mode: 'connect' | 'syncing' | 'empty' }) {
  if (mode === 'syncing') {
    // Skeleton triplet — same height as a real card so the layout
    // doesn't shift when sync finishes and real cards drop in.
    return (
      <div className="pointer-events-none flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[#1F1F23] p-3.5 backdrop-blur-[12px]"
            style={{ background: 'rgba(255, 255, 255, 0.025)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: 'rgba(232,184,109,0.5)' }}
              />
              <div className="h-2 w-14 animate-pulse rounded bg-white/[0.06]" />
              <div className="ml-auto h-2 w-6 animate-pulse rounded bg-white/[0.04]" />
            </div>
            <div className="mt-3 h-3 w-32 animate-pulse rounded bg-white/[0.08]" />
            <div className="mt-2 h-2.5 w-48 animate-pulse rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    );
  }

  if (mode === 'empty') {
    // Inbox Zero — single calm card, no CTA. "Alles erledigt" tells the
    // user the sync has run AND there's nothing waiting.
    return (
      <div className="pointer-events-none flex flex-col gap-3">
        <div
          className="rounded-[10px] border border-[#1F1F23] p-4 backdrop-blur-[12px]"
          style={{ background: 'rgba(255, 255, 255, 0.025)' }}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]"
            >
              Inbox
            </span>
            <span className="ml-auto text-[10px] text-[#52525B]">— zero —</span>
          </div>
          <p className="mt-2 text-[13px] font-medium leading-tight text-[#FAFAFA]">
            Alles erledigt.
          </p>
          <p className="mt-1 text-[12px] leading-tight text-[#A1A1AA]">
            Keine ungelesenen Nachrichten.
          </p>
        </div>
      </div>
    );
  }

  // mode === 'connect' — soft CTA. Real query ran but Gmail isn't
  // linked yet; we don't want to fall through to demo mocks because
  // that's misleading once the user is logged in.
  return (
    <div className="flex flex-col gap-3">
      <a
        href="/settings/integrations"
        className="pointer-events-auto block rounded-[10px] border border-[#1F1F23] p-4 backdrop-blur-[12px] transition-colors hover:border-[#E8B86D]/40"
        style={{ background: 'rgba(232,184,109,0.04)' }}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#E8B86D]"
          >
            Inbox
          </span>
          <span className="ml-auto text-[10px] text-[#52525B]">→</span>
        </div>
        <p className="mt-2 text-[13px] font-medium leading-tight text-[#FAFAFA]">
          Gmail verbinden.
        </p>
        <p className="mt-1 text-[12px] leading-tight text-[#A1A1AA]">
          Damit deine wichtigen Mails hier landen — neben Notizen, Kanälen,
          Erwähnungen.
        </p>
      </a>
    </div>
  );
}
