'use client';

/**
 * Foyer — the workspace landing.
 *
 * Intentionally NOT a dashboard. It's the lobby of the workspace: calm,
 * centered, time-aware, with clear paths into the actual work surfaces
 * (modules). The "breathing" comes from a single ambient-light element
 * whose color temperature shifts through the day and whose center drifts
 * over a 60s loop. Nothing else moves on its own.
 *
 * This is the client component. All workspace data (events, todo counts,
 * unread numbers, latest message) is fetched server-side in app/page.tsx
 * and passed in as props — the client just renders + handles interactions
 * (search focus, doorway transition, suggestion cycling, etc.).
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { NotificationStack, type NotifCard } from './notification-stack';
import { WorkspaceSwitcher } from '@/components/header/workspace-switcher';

// ───────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────

export type FoyerEvent = { time: string; title: string };

export type FoyerLatestMessage = {
  sender: string;
  preview: string;
  minAgo: number;
  href: string;
};

export type FoyerSuggestion = {
  kind: string;
  icon: string;
  title: string;
  context: string;
  href: string;
};

export type FoyerData = {
  /** User's first name for the greeting */
  userName: string;
  /** Today's calendar events, sorted by start time */
  events: FoyerEvent[];
  /** Total unread items across all sources (= email + channels + mentions or DB-summed) */
  unread: number;
  /** Unread email count — 0 if email-inbound not configured */
  email: number;
  /** Unread channel messages count */
  channels: number;
  /** Unread mentions count */
  mentions: number;
  /** Most recent unread message across all sources, or null if none */
  latestMessage: FoyerLatestMessage | null;
  /** Todos due today */
  dueToday: number;
  /** Todos due in the next 7 days */
  dueWeek: number;
  /** Todos due tomorrow */
  dueTomorrow: number;
  /**
   * Suggestions for the "Jetzt" section — 1-N items the user can cycle
   * through with "Anderes vorschlagen". Caller may provide computed
   * suggestions; this component falls back to a static set if empty.
   */
  jetztSuggestions: FoyerSuggestion[];
  /**
   * Real inbox items rendered in the left-periphery NotificationStack.
   * Empty array means "Gmail is connected but no unread mails right
   * now"; missing means "no real query ran" (anon foyer).
   */
  inboxCards?: NotifCard[];
  /**
   * Gmail connection state — drives the stack's empty/loading branches.
   * connected=false → show "Mit Gmail verbinden" CTA instead of mocks.
   * connected=true + empty inboxCards → Inbox-Zero state.
   * syncedAt powers the auto-trigger debounce (don't re-sync on every
   * foyer load if Gmail was just synced).
   */
  gmail?: { connected: boolean; syncedAt: string | null };
  /**
   * Smart briefing — 2-3 sentence narrative summarising what matters
   * right now. Falls back to a deterministic one-liner when AI isn't
   * configured. isFallback=true means the prose was rule-built, not
   * model-generated; we render with a subtle tone tweak in that case.
   */
  briefing?: {
    narrative: string;
    generatedAt: string;
    fromCache: boolean;
    isFallback: boolean;
  } | null;
  /**
   * Active workspace summary for the inline foyer TopNav switcher.
   * Anonymous foyer leaves this null and renders a generic pill
   * (the user has no workspaces yet to switch between).
   */
  activeWorkspace?: FoyerWorkspace | null;
  /**
   * All workspaces the current user is a member of — feeds the
   * foyer's WorkspaceSwitcher dropdown. Empty array on anon foyer.
   */
  workspaces?: FoyerWorkspace[];
};

export type FoyerWorkspace = {
  id: string;
  slug: string;
  name: string;
  short: string;
  from: string;
  to: string;
  scope?: 'business' | 'private';
};

// ───────────────────────────────────────────────────────────────
// Constants — non-data UI defaults
// ───────────────────────────────────────────────────────────────

// Foyer top-nav modules. Mirrors the global NavTabs set (Inbox / Todos /
// Notizen / Channels / Kalender) — uRent-specific entities (Kunden,
// Flotte, Verträge) live in their own pages but stay off this strip so
// the foyer reads as a focused workspace lobby, not a full module menu.
const MODULES = [
  { label: 'Inbox', href: '/inbox' },
  { label: 'Todos', href: '/todos' },
  { label: 'Notizen', href: '/notes' },
  { label: 'Channels', href: '/channels' },
  { label: 'Kalender', href: '/kalender' },
] as const;

const PLACEHOLDERS = [
  'Suche Kunden …',
  'Frag deinen Workspace …',
  'Springe zu Verträgen …',
  'Was steht heute an?',
];


// ───────────────────────────────────────────────────────────────
// Time / mood
// ───────────────────────────────────────────────────────────────

type Mood = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

function getMood(d: Date): Mood {
  const h = d.getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 13) return 'midday';
  if (h >= 13 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

function greetingFor(mood: Mood, userName: string): string {
  switch (mood) {
    case 'morning':
      return `Guten Morgen, ${userName}.`;
    case 'midday':
      return `Hallo, ${userName}.`;
    case 'afternoon':
      return `Schönen Nachmittag, ${userName}.`;
    case 'evening':
      return `Guten Abend, ${userName}.`;
    case 'night':
      return `Spät unterwegs, ${userName}.`;
  }
}

function lightFor(mood: Mood): { color: string; opacity: number } {
  switch (mood) {
    case 'morning':
      return { color: '#FFD9B0', opacity: 0.10 };
    case 'midday':
      return { color: '#E5EAF0', opacity: 0.06 };
    case 'afternoon':
      return { color: '#E8B86D', opacity: 0.09 };
    case 'evening':
      return { color: '#FF9966', opacity: 0.11 };
    case 'night':
      return { color: '#A0B0D8', opacity: 0.05 };
  }
}

function subtitleFor(
  mood: Mood,
  isWeekend: boolean,
  events: number,
  unread: number
): string {
  if (isWeekend) return 'Wochenende. Nur das Nötigste.';
  if (mood === 'night') return 'Vielleicht noch eine letzte Sache.';
  if (mood === 'evening') return 'Der Tag klingt aus.';
  if (events === 0 && unread === 0) return 'Ruhiger Tag bisher.';
  const parts: string[] = [];
  if (events > 0) {
    parts.push(events === 1 ? 'Ein Termin heute' : `${spellOut(events)} Termine heute`);
  }
  if (unread > 0) {
    parts.push(`${spellOut(unread)} ungelesene Nachrichten`);
  }
  return parts.join(' · ') + '.';
}

function spellOut(n: number): string {
  const map = ['null', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf'];
  return map[n] ?? String(n);
}

function suggestionsFor(
  mood: Mood,
  isWeekend: boolean,
  unread: number
): { label: string; href: string }[] {
  if (isWeekend) {
    return [
      { label: 'Inbox abschließen', href: '/inbox' },
      { label: 'Wochenstart vorbereiten', href: '/todos/brief' },
    ];
  }
  switch (mood) {
    case 'morning':
      return [
        { label: 'Termine heute', href: '/kalender' },
        { label: 'Neuer Vertrag', href: '/vertraege' },
        { label: unread > 0 ? `Inbox (${unread} neu)` : 'Inbox', href: '/inbox' },
      ];
    case 'midday':
      return [
        { label: 'Heute fällig', href: '/todos?view=today' },
        { label: 'Brief vorlesen', href: '/todos/brief' },
        { label: 'Schreib eine Notiz', href: '/notes' },
      ];
    case 'afternoon':
      return [
        { label: 'Wochenrückblick', href: '/todos/brief' },
        { label: 'Offene Verträge', href: '/vertraege?status=auslaufend' },
        { label: 'Schreib eine Notiz', href: '/notes' },
      ];
    case 'evening':
      return [
        { label: 'Morgen vorbereiten', href: '/todos?view=tomorrow' },
        { label: 'Inbox abschließen', href: '/inbox' },
      ];
    case 'night':
      return [
        { label: 'Inbox abschließen', href: '/inbox' },
        { label: 'Eine letzte Notiz', href: '/notes' },
      ];
  }
}

function relativeMinutes(min: number): string {
  if (min < 1) return 'jetzt';
  if (min < 60) return `vor ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.floor(h / 24)}T`;
}

// ───────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────

export function FoyerClient(props: FoyerData) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    document.body.dataset.foyer = 'true';
    return () => {
      delete document.body.dataset.foyer;
    };
  }, []);

  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length),
      4000
    );
    return () => window.clearInterval(id);
  }, []);

  const [searchFocused, setSearchFocused] = useState(false);

  const [doorway, setDoorway] = useState<{ active: boolean; href: string | null }>({
    active: false,
    href: null,
  });

  const enterDoorway = useCallback(
    (href: string) => {
      if (doorway.active) return;
      if (prefersReducedMotion) {
        router.push(href);
        return;
      }
      setDoorway({ active: true, href });
      window.setTimeout(() => router.push(href), 500);
    },
    [doorway.active, prefersReducedMotion, router]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('foyer-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ctx = useMemo(() => {
    const d = now ?? new Date(0);
    const mood: Mood = now ? getMood(d) : 'midday';
    const weekend = now ? d.getDay() === 0 || d.getDay() === 6 : false;
    const greeting = now ? greetingFor(mood, props.userName) : ' ';
    const subtitle = now
      ? subtitleFor(mood, weekend, props.events.length, props.unread)
      : ' ';
    const suggestions = now ? suggestionsFor(mood, weekend, props.unread) : [];
    const light = lightFor(mood);
    return { mood, weekend, greeting, subtitle, suggestions, light };
  }, [now, props.userName, props.events.length, props.unread]);

  const dimRest = searchFocused;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0A0A0C] text-[#E5E5E7]">
      <style>{`body[data-foyer="true"] > header { display: none !important; }`}</style>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #101013 0%, #0A0A0C 50%, #07070A 100%)',
        }}
      />

      <AmbientLight color={ctx.light.color} opacity={ctx.light.opacity} />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% 60%, transparent 50%, rgba(0,0,0,0.45) 100%)',
        }}
      />

      {/* Notification stack — left periphery, ≥xl only. Inherits foyer dim
          via its own opacity prop instead of riding the parent div's opacity,
          because the stack is `fixed` and we want independent dim control. */}
      <NotificationStack
        dim={dimRest}
        initial={props.inboxCards ?? null}
        gmailConnected={props.gmail?.connected ?? false}
        gmailSyncedAt={props.gmail?.syncedAt ?? null}
      />

      <div
        className="relative z-10 flex min-h-screen flex-col transition-opacity duration-300 ease-out"
        style={{ opacity: dimRest ? 0.85 : 1 }}
      >
        <TopNav
          modules={MODULES}
          workspaceName={`${props.userName}'s Workspace`}
          activeWorkspace={props.activeWorkspace ?? null}
          workspaces={props.workspaces ?? []}
          onClick={enterDoorway}
          dim={dimRest}
        />

        {/* One unified column. Jetzt joins the hero — no separate section.
            Rhythm: greeting → 16 → subtitle → 56 → briefing → 48 → search →
            24 → suggestions → 64 → jetzt. Sized so the whole column fits
            comfortably on a 1440px-tall screen. */}
        <section className="flex justify-center px-6 pt-[8vh] pb-[8vh]">
          <div className="flex w-full max-w-[680px] flex-col items-center">
            <header className="flex flex-col items-center gap-4 text-center">
              <h1
                suppressHydrationWarning
                className="text-[36px] font-normal leading-[1.1] tracking-[-0.4px] text-[#F0F0F2]"
              >
                {ctx.greeting}
              </h1>
              <p
                suppressHydrationWarning
                className="text-[15px] font-normal leading-[1.55] text-[#9b9ba0]"
              >
                {ctx.subtitle}
              </p>
            </header>

            {props.briefing && (
              <div className="mt-10 flex w-full justify-center">
                <SmartBriefing briefing={props.briefing} dim={dimRest} />
              </div>
            )}

            <div className="mt-8 flex w-full justify-center">
              <DailyBriefing
                events={props.events}
                dueToday={props.dueToday}
                dueWeek={props.dueWeek}
                dueTomorrow={props.dueTomorrow}
                mood={ctx.mood}
                onNavigate={enterDoorway}
                inboxHasItems={props.unread > 0 || props.mentions > 0 || !!props.latestMessage}
              />
            </div>

            <div className="mt-12 flex w-full justify-center">
              <SearchBar
                focused={searchFocused}
                setFocused={setSearchFocused}
                placeholderIdx={placeholderIdx}
              />
            </div>

            <div className="mt-6 flex w-full justify-center">
              <Suggestions
                items={ctx.suggestions}
                onClick={enterDoorway}
                dim={dimRest}
              />
            </div>

          </div>
        </section>
      </div>

      <AnimatePresence>{doorway.active && <Doorway />}</AnimatePresence>
    </main>
  );
}

// ───────────────────────────────────────────────────────────────
// Sub-components (unchanged from previous foyer)
// ───────────────────────────────────────────────────────────────

function AmbientLight({ color, opacity }: { color: string; opacity: number }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute"
        initial={false}
        animate={prefersReducedMotion ? {} : { x: ['-1%', '1%', '-1%'], y: ['-1%', '1.5%', '-1%'] }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 60, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }
        }
        style={{
          top: '8%',
          left: '52%',
          width: '900px',
          height: '900px',
          background: `radial-gradient(circle at center, ${color} 0%, transparent 60%)`,
          opacity,
          filter: 'blur(40px)',
          transition: 'background 5000ms ease, opacity 5000ms ease',
        }}
      />
    </div>
  );
}

function TopNav({
  modules,
  workspaceName,
  activeWorkspace,
  workspaces,
  onClick,
  dim,
}: {
  modules: readonly { label: string; href: string }[];
  /** Fallback name used only for the anonymous foyer (no user / no workspace). */
  workspaceName: string;
  /** When set, the inline span is replaced with the real WorkspaceSwitcher. */
  activeWorkspace: FoyerWorkspace | null;
  workspaces: FoyerWorkspace[];
  onClick: (href: string) => void;
  dim: boolean;
}) {
  return (
    <div
      className="relative z-20 flex justify-center pt-6 transition-opacity duration-300 ease-out"
      style={{ opacity: dim ? 0.55 : 1 }}
    >
      <nav
        aria-label="Module"
        className="flex items-center gap-1 rounded-full border border-[#1F1F23] px-2 py-1.5 backdrop-blur-xl backdrop-saturate-150"
        style={{ background: 'rgba(17, 17, 20, 0.5)' }}
      >
        {activeWorkspace ? (
          <WorkspaceSwitcher active={activeWorkspace} workspaces={workspaces} />
        ) : (
          // Anonymous / no-membership fallback: static pill, no dropdown
          // (there'd be nothing to switch between).
          <span className="mx-2 inline-flex items-center gap-2 text-[12px] text-[#9b9ba0]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#E8B86D]" />
            {workspaceName}
          </span>
        )}
        <span className="mx-1 h-4 w-px bg-[#1F1F23]" />
        {modules.map((m) => (
          <button
            key={m.href}
            type="button"
            onClick={() => onClick(m.href)}
            className="rounded-full px-3 py-1.5 text-[12.5px] text-[#cbcbd0] transition-colors duration-150 hover:bg-white/[0.04] hover:text-[#F0F0F2]"
          >
            {m.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function SearchBar({
  focused,
  setFocused,
  placeholderIdx,
}: {
  focused: boolean;
  setFocused: (v: boolean) => void;
  placeholderIdx: number;
}) {
  return (
    <div className="relative w-full max-w-[560px]">
      <div
        className="relative flex items-center gap-3 px-1 py-3"
        style={{
          borderBottom: `1px solid ${focused ? '#E8B86D' : '#1F1F23'}`,
          transition: 'border-color 240ms ease',
        }}
      >
        <input
          id="foyer-search"
          type="text"
          aria-label="Suche oder Befehl"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder=" "
          className="flex-1 bg-transparent text-[18px] font-normal text-[#F0F0F2] outline-none placeholder:text-transparent"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="pointer-events-none absolute left-1 right-12 top-1/2 -translate-y-1/2">
          <AnimatePresence mode="wait">
            <motion.span
              key={placeholderIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: focused ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="block text-[18px] text-[#5d5d62]"
            >
              {PLACEHOLDERS[placeholderIdx]}
            </motion.span>
          </AnimatePresence>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-[#5d5d62]">
          ⌘K
        </span>
      </div>
    </div>
  );
}

function Suggestions({
  items,
  onClick,
  dim,
}: {
  items: { label: string; href: string }[];
  onClick: (href: string) => void;
  dim: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <p
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[13px] text-[#7c7c83] transition-opacity duration-300 ease-out"
      style={{ opacity: dim ? 0 : 1 }}
    >
      {items.map((s, i) => (
        <span key={s.href} className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => onClick(s.href)}
            className="transition-colors duration-150 hover:text-[#F0F0F2]"
          >
            {s.label}
          </button>
          {i < items.length - 1 && (
            <span aria-hidden className="text-[#3a3a3f]">
              —
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-[#FAFAFA]">{children}</span>;
}

function SmartBriefing({
  briefing,
  dim,
}: {
  briefing: NonNullable<FoyerData['briefing']>;
  dim: boolean;
}) {
  // Prose block, centred, max 600px so long sentences don't stretch
  // across the whole foyer column. Subtle amber dot to anchor the eye
  // and signal "this is the briefing"; otherwise zero chrome.
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.18, ease: 'easeOut' }}
      className="w-full max-w-[600px]"
      style={{ opacity: dim ? 0.6 : 1 }}
    >
      <div className="flex items-start gap-3 px-1">
        <span
          aria-hidden
          className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: briefing.isFallback ? '#52525B' : '#E8B86D',
            boxShadow: briefing.isFallback
              ? 'none'
              : '0 0 8px rgba(232, 184, 109, 0.5)',
          }}
        />
        <p
          className="flex-1 text-[14.5px] leading-[1.65] text-[#D4D4D8]"
          style={{ letterSpacing: '-0.005em' }}
        >
          {briefing.narrative}
        </p>
      </div>
    </motion.div>
  );
}

function DailyBriefing({
  events,
  dueToday,
  dueWeek,
  dueTomorrow,
  mood,
  onNavigate,
  inboxHasItems,
}: {
  events: FoyerEvent[];
  dueToday: number;
  dueWeek: number;
  dueTomorrow: number;
  mood: Mood;
  onNavigate: (href: string) => void;
  /** True when the notification stack on the left has any unread items —
   *  changes the wording of the all-empty briefing state. */
  inboxHasItems: boolean;
}) {
  const isEvening = mood === 'evening' || mood === 'night';

  // Briefing now shows ONLY Termine + Todos. Inbox state (counts, latest
  // message) lives in the NotificationStack on the left periphery, where
  // it can breathe and update without bloating the center column.
  const termineEmpty = events.length === 0;
  const termineContent: React.ReactNode = termineEmpty ? (
    <>Keine Termine heute</>
  ) : (
    <>
      {events.slice(0, 3).map((e, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <Num>{e.time}</Num> {e.title}
        </span>
      ))}
    </>
  );

  const todosEmpty =
    dueToday === 0 && (isEvening ? dueTomorrow === 0 : dueWeek === 0);
  const todosContent: React.ReactNode = todosEmpty ? (
    <>Nichts fällig</>
  ) : isEvening ? (
    <>
      <Num>{dueToday}</Num> fällig heute · <Num>{dueTomorrow}</Num> morgen
    </>
  ) : (
    <>
      <Num>{dueToday}</Num> fällig heute · <Num>{dueWeek}</Num> diese Woche
    </>
  );

  const allEmpty = termineEmpty && todosEmpty;
  if (allEmpty) {
    // Two flavors of empty:
    //  - inbox also empty → italic, gentle: a true rest moment.
    //  - inbox has items   → matter-of-fact: the day itself is clear, but
    //                        work is incoming from the left.
    return inboxHasItems ? (
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.22, ease: 'easeOut' }}
        className="text-center text-[13px] text-[#A1A1AA]"
      >
        Keine Termine, keine offenen Todos. Inbox links.
      </motion.p>
    ) : (
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.22, ease: 'easeOut' }}
        className="text-center text-[13px] italic text-[#7c7c83]"
      >
        Heute ist nichts geplant. Genieß den Tag.
      </motion.p>
    );
  }

  type BriefingRow = {
    label: string;
    content: React.ReactNode;
    empty: boolean;
    href: string;
    rightMeta?: React.ReactNode;
  };

  const rows: BriefingRow[] = [
    { label: 'Termine', content: termineContent, empty: termineEmpty, href: '/kalender' },
    { label: 'Todos', content: todosContent, empty: todosEmpty, href: '/todos' },
  ];

  return (
    <div className="w-full max-w-[560px]">
      {rows.map((row, i) => (
        <motion.button
          key={row.label}
          type="button"
          onClick={() => onNavigate(row.href)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.3,
            delay: 0.22 + i * 0.03,
            ease: 'easeOut',
          }}
          className={`group flex h-9 w-full items-center gap-4 px-2 text-left transition-colors duration-150 ease-out hover:bg-white/[0.02] ${
            i < rows.length - 1 ? 'border-b border-[#1F1F23]/10' : ''
          }`}
        >
          <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.4px] text-[#52525B]">
            {row.label}
          </span>
          <span
            className={`min-w-0 flex-1 truncate text-[14px] ${
              row.empty ? 'text-[#52525B]' : 'text-[#FAFAFA]'
            }`}
          >
            {row.content}
          </span>
          {row.rightMeta && (
            <span
              className={`shrink-0 font-mono text-[11px] ${
                row.empty ? 'text-[#3a3a3f]' : 'text-[#52525B]'
              }`}
            >
              {row.rightMeta}
            </span>
          )}
          <ArrowUpRight
            className={`shrink-0 transition-colors duration-150 ease-out ${
              row.empty ? 'text-[#3a3a3f]' : 'text-[#52525B]'
            } group-hover:text-[#FAFAFA]`}
          />
        </motion.button>
      ))}
    </div>
  );
}

function Doorway() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[1000]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ backgroundColor: 'rgba(7, 7, 10, 0)' }}
        animate={{ backgroundColor: 'rgba(7, 7, 10, 0.72)' }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute inset-x-0 h-[2px]"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(232,184,109,0.95) 50%, transparent 100%)',
          boxShadow:
            '0 0 18px rgba(232,184,109,0.6), 0 0 60px rgba(232,184,109,0.25), 0 0 120px rgba(232,184,109,0.12)',
          filter: 'blur(0.5px)',
        }}
        initial={{ top: '-4%', opacity: 0 }}
        animate={{ top: ['-4%', '50%', '104%'], opacity: [0, 1, 0] }}
        transition={{
          duration: 0.36,
          delay: 0.12,
          ease: [0.65, 0, 0.35, 1],
          times: [0, 0.5, 1],
        }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[40%]"
        style={{
          background:
            'linear-gradient(0deg, rgba(232,184,109,0.10) 0%, transparent 100%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0] }}
        transition={{
          duration: 0.32,
          delay: 0.28,
          times: [0, 0.4, 1],
        }}
      />
    </motion.div>
  );
}
