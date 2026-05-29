'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_SOFT } from './_motion';
import { usePusherChannel } from '@/components/realtime/pusher-provider';
import { Headline, MetaTag, MetaDivider } from '@/components/ui/headline';
import { FilterPills } from '@/components/ui/filter-pills';
import { CreateEventModal } from './create-event-modal';
import { EventDetailDrawer } from './event-detail-drawer';
import { CalendarSidebar, type CalendarSmartView } from './calendar-sidebar';
import { MonthView } from './month-view';
import { WeekView } from './week-view';
import { DayView } from './day-view';
import { AgendaView } from './agenda-view';
import { ResourceView } from './resource-view';
import { YearHeatmapView } from './year-heatmap-view';
import { RecurringModal } from './recurring-modal';
import { TemplatesModal } from './templates-modal';
import { ShareCalendarModal } from './share-calendar-modal';
import { QuickAddBar } from './quick-add-bar';
import { UpNextPanel } from './up-next-panel';
import { StandstillRail } from './standstill-rail';
import { SlotFinderModal } from './slot-finder-modal';
import { KIND_META } from './event-color';
import type { QuickParsedEvent } from '@/lib/actions/calendar';
import type { StandstillRow } from '@/lib/db/queries/inverse-calendar';
import type {
  CalendarEvent,
  CalendarConflict,
  CalendarPreFlightAlert,
  CalendarTemplate,
  CalendarEventKind,
  DayDensityCell,
  TodoUser,
} from '@/lib/types';

const VIEWS = ['Monat', 'Woche', 'Tag', 'Agenda', 'Resource', 'Jahr'] as const;
type View = (typeof VIEWS)[number];

type Customer = { id: string; name: string };
type Vehicle = { id: string; plate: string; model: string; externalId?: string };
type Contract = { id: string; title: string };
type ResourceRow = Parameters<typeof ResourceView>[0]['rows'][number];

export function KalenderClient({
  events,
  density,
  yearDensity,
  conflicts,
  alerts,
  resourceRows,
  templates,
  customers,
  vehicles,
  contracts,
  counts,
  members = [],
  currentUserId,
  standstills = [],
  workspaceId,
}: {
  events: CalendarEvent[];
  density: DayDensityCell[];
  yearDensity: DayDensityCell[];
  conflicts: CalendarConflict[];
  alerts: CalendarPreFlightAlert[];
  resourceRows: ResourceRow[];
  templates: CalendarTemplate[];
  customers: Customer[];
  vehicles: Vehicle[];
  contracts: Contract[];
  counts: { today: number; thisWeek: number; conflicts: number; openChecklists: number };
  members?: TodoUser[];
  currentUserId?: string;
  standstills?: StandstillRow[];
  workspaceId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Live updates: any teammate creating/moving/deleting an event in this
  // workspace pushes a "calendar.changed" event → we refetch. No-op when
  // Pusher isn't configured.
  usePusherChannel(workspaceId ? `private-workspace-${workspaceId}-calendar` : null, {
    'calendar.changed': () => router.refresh(),
  });

  const [view, setView] = useState<View>('Woche');
  const [smartView, setSmartView] = useState<CalendarSmartView>('all');
  const [layers, setLayers] = useState({ internal: true, google: true, todo: true });
  const [cursor, setCursor] = useState<Date>(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [slotFinderOpen, setSlotFinderOpen] = useState(false);
  const [prefillStart, setPrefillStart] = useState<string | undefined>(undefined);
  const [prefillDuration, setPrefillDuration] = useState<number | undefined>(undefined);
  const [prefillTitle, setPrefillTitle] = useState<string | undefined>(undefined);
  const [prefillLocation, setPrefillLocation] = useState<string | undefined>(undefined);
  const [prefillDetail, setPrefillDetail] = useState<string | undefined>(undefined);
  const [prefillKind, setPrefillKind] = useState<CalendarEventKind | undefined>(undefined);

  const resetPrefill = () => {
    setPrefillStart(undefined);
    setPrefillDuration(undefined);
    setPrefillTitle(undefined);
    setPrefillLocation(undefined);
    setPrefillDetail(undefined);
    setPrefillKind(undefined);
  };

  const openCreateAt = (startIso: string, durationMinutes: number) => {
    resetPrefill();
    setPrefillStart(startIso);
    setPrefillDuration(durationMinutes);
    setCreateOpen(true);
  };

  const openCreateWithDraft = (draft: QuickParsedEvent) => {
    setPrefillStart(draft.startsAtIso);
    setPrefillDuration(draft.durationMinutes);
    setPrefillTitle(draft.title);
    setPrefillKind(draft.kind);
    setPrefillLocation(draft.location);
    setPrefillDetail(draft.detail);
    setCreateOpen(true);
  };

  const openEventId = searchParams.get('event');
  const drawerEvent = useMemo(
    () => events.find((e) => e.id === openEventId) ?? null,
    [events, openEventId]
  );

  const openEvent = (id: string) => {
    // Read-only overlay events don't get the editable drawer.
    if (id.startsWith('ext_')) return; // Google mirror — read-only
    if (id.startsWith('todo_')) {
      router.push('/todos');
      return;
    }
    const p = new URLSearchParams(searchParams.toString());
    p.set('event', id);
    router.replace(`/kalender?${p.toString()}`, { scroll: false });
  };
  const closeEvent = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('event');
    router.replace(p.toString() ? `/kalender?${p.toString()}` : '/kalender', { scroll: false });
  };

  const hasGoogle = useMemo(() => events.some((e) => e.source === 'google'), [events]);
  const hasTodo = useMemo(() => events.some((e) => e.source === 'todo'), [events]);

  const filtered = useMemo(() => {
    let list = events.filter((e) => layers[e.source ?? 'internal']);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endToday = new Date(startToday.getTime() + 86_400_000);
    const endWeek = new Date(startToday.getTime() + 7 * 86_400_000);

    if (smartView === 'today') {
      list = list.filter((e) => {
        const s = new Date(e.startsAt);
        return s >= startToday && s < endToday;
      });
    } else if (smartView === 'thisWeek') {
      list = list.filter((e) => {
        const s = new Date(e.startsAt);
        return s >= startToday && s < endWeek;
      });
    } else if (smartView === 'conflicts') {
      const conflictEventIds = new Set(conflicts.flatMap((c) => c.events.map((e) => e.id)));
      list = list.filter((e) => conflictEventIds.has(e.id));
    } else if (smartView === 'openChecklists') {
      list = list.filter(
        (e) => e.checklist.length > 0 && e.checklist.some((c) => !c.done)
      );
    }
    return list;
  }, [events, smartView, conflicts, layers]);

  // Today strip
  const todayStrip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const items = events.filter((e) => {
      const s = new Date(e.startsAt);
      return s >= today && s < tomorrow;
    });
    const byKind: Record<string, number> = {};
    for (const e of items) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    return { items, byKind };
  }, [events]);

  const headlineTitle =
    view === 'Jahr'
      ? 'Jahres-Übersicht'
      : view === 'Monat'
        ? cursor.toLocaleString('de-DE', { month: 'long', year: 'numeric' })
        : view === 'Woche'
          ? `KW ${getWeekNumber(cursor)} · ${cursor.toLocaleString('de-DE', { month: 'short', year: 'numeric' })}`
          : view === 'Tag'
            ? cursor.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })
            : view === 'Agenda'
              ? 'Agenda'
              : 'Resource-Ansicht';

  const navigate = (delta: number) => {
    const next = new Date(cursor);
    if (view === 'Monat') next.setMonth(next.getMonth() + delta);
    else if (view === 'Woche') next.setDate(next.getDate() + delta * 7);
    else if (view === 'Tag' || view === 'Resource') next.setDate(next.getDate() + delta);
    setCursor(next);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1720px] gap-6 px-4 pb-32 pt-28 md:px-6">
      <CalendarSidebar
        smartView={smartView}
        setSmartView={setSmartView}
        counts={counts}
        density={density}
        cursor={cursor}
        setCursor={setCursor}
      />

      <div className="min-w-0 flex-1">
        <div className="mb-5">
          <QuickAddBar onDraft={openCreateWithDraft} />
        </div>

        <Headline
          kicker="Kalender"
          title={headlineTitle}
          subtitle="Meetings, Arzttermine, Privates, Übergaben — mit Conflict-Detection bei Fahrzeug-Buchungen und optionaler Resource-Ansicht."
          meta={
            <>
              <MetaTag highlight>{counts.today} heute</MetaTag>
              <MetaDivider />
              <MetaTag>{counts.thisWeek} diese Woche</MetaTag>
              {counts.conflicts > 0 && (
                <>
                  <MetaDivider />
                  <MetaTag>{counts.conflicts} Konflikte</MetaTag>
                </>
              )}
            </>
          }
          trailing={
            <div className="flex flex-wrap items-center gap-2">
              <FilterPills options={VIEWS} value={view} onChange={setView} />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-ink-200 hover:bg-white/[0.05]"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setCursor(new Date())}
                  className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 hover:bg-white/[0.05]"
                >
                  Heute
                </button>
                <button
                  type="button"
                  onClick={() => navigate(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-ink-200 hover:bg-white/[0.05]"
                >
                  →
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSlotFinderOpen(true)}
                className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
              >
                🔍 Slot finden
              </button>
              <button
                type="button"
                onClick={() => setRecurringOpen(true)}
                className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
              >
                ↻ Recurring
              </button>
              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
              >
                Templates
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
              >
                🔗 Teilen
              </button>
              <button
                type="button"
                onClick={() => {
                  resetPrefill();
                  setCreateOpen(true);
                }}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium text-ink-50 hover:border-white/[0.18] hover:bg-white/[0.06]"
              >
                + Termin
              </button>
            </div>
          }
        />

        {/* Today strip */}
        {todayStrip.items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE_SOFT }}
            className="mt-5 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 shadow-panel"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
                Heute
              </span>
              <span className="font-mono text-[11.5px] tabular-nums text-ink-100">
                {todayStrip.items.length} Events
              </span>
              {Object.entries(todayStrip.byKind).map(([k, n]) => {
                const meta = KIND_META[k as keyof typeof KIND_META];
                return (
                  <span
                    key={k}
                    className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
                    style={{ background: `${meta.color}1f`, color: meta.color }}
                  >
                    {n} × {meta.label}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Pre-Flight Alerts */}
        {alerts.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {alerts.slice(0, 5).map((a) => (
              <button
                key={a.eventId}
                type="button"
                onClick={() => openEvent(a.eventId)}
                className="flex items-center gap-2.5 rounded-[10px] border border-[#ffd96a]/30 bg-[#ffd96a]/[0.05] px-3 py-2 text-left transition-colors hover:bg-[#ffd96a]/[0.08]"
              >
                <span className="text-[14px] text-[#ffd96a]">⚠</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-ink-50">
                    in {a.minutesUntil}min · {a.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-300">{a.detail}</p>
                </div>
                <span className="font-mono text-[10px] text-ink-300">→</span>
              </button>
            ))}
          </div>
        )}

        {/* Conflict Banner */}
        {conflicts.length > 0 && (
          <div className="mt-3 rounded-[10px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#ff8a8a]">
              ⚠ {conflicts.length} Fahrzeug{conflicts.length === 1 ? '' : 'e'} mit Buchungs-Konflikt
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {conflicts.slice(0, 3).map((c) => (
                <li key={c.vehicleId} className="text-[12px] text-ink-100">
                  ⊞ <span className="font-mono">{c.vehiclePlate}</span> · {c.events.length} überlappende Termine
                </li>
              ))}
            </ul>
          </div>
        )}

        {(hasGoogle || hasTodo) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              Ebenen
            </span>
            <LayerToggle
              label="Termine"
              color="#c084fc"
              active={layers.internal}
              onClick={() => setLayers((l) => ({ ...l, internal: !l.internal }))}
            />
            {hasGoogle && (
              <LayerToggle
                label="Google"
                color="#5E9EFF"
                active={layers.google}
                onClick={() => setLayers((l) => ({ ...l, google: !l.google }))}
              />
            )}
            {hasTodo && (
              <LayerToggle
                label="Todos"
                color="#5ee08a"
                active={layers.todo}
                onClick={() => setLayers((l) => ({ ...l, todo: !l.todo }))}
              />
            )}
          </div>
        )}

        <div className="mt-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE_SOFT }}
            >
              {view === 'Monat' && (
                <MonthView
                  cursor={cursor}
                  events={filtered}
                  onOpen={openEvent}
                  onCreateAt={openCreateAt}
                />
              )}
              {view === 'Woche' && (
                <WeekView
                  cursor={cursor}
                  events={filtered}
                  onOpen={openEvent}
                  onCreateAt={openCreateAt}
                />
              )}
              {view === 'Tag' && (
                <DayView
                  cursor={cursor}
                  events={filtered}
                  onOpen={openEvent}
                  onCreateAt={openCreateAt}
                />
              )}
              {view === 'Agenda' && <AgendaView events={filtered} onOpen={openEvent} />}
              {view === 'Resource' && (
                <ResourceView cursor={cursor} rows={resourceRows} onOpen={openEvent} />
              )}
              {view === 'Jahr' && <YearHeatmapView density={yearDensity} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right rail — up-next + standstill reminders. Hidden on smaller
          viewports where the calendar grid takes the full width. */}
      <aside className="hidden w-[320px] shrink-0 flex-col gap-4 xl:flex">
        <UpNextPanel events={events} onOpen={openEvent} />
        <StandstillRail standstills={standstills} />
      </aside>

      <CreateEventModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        customers={customers}
        vehicles={vehicles}
        contracts={contracts}
        templates={templates}
        members={members}
        currentUserId={currentUserId}
        prefilledStart={prefillStart}
        prefilledDurationMinutes={prefillDuration}
        prefilledTitle={prefillTitle}
        prefilledLocation={prefillLocation}
        prefilledDetail={prefillDetail}
        prefilledKind={prefillKind}
      />
      <RecurringModal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        customers={customers}
        vehicles={vehicles}
        contracts={contracts}
      />
      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        templates={templates}
      />
      <ShareCalendarModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        customers={customers}
      />
      <SlotFinderModal
        open={slotFinderOpen}
        onClose={() => setSlotFinderOpen(false)}
        members={members}
        currentUserId={currentUserId}
        vehicles={vehicles}
        onPick={(startIso, dur) => openCreateAt(startIso, dur)}
      />

      {drawerEvent && (
        <EventDetailDrawer
          event={drawerEvent}
          onClose={closeEvent}
          members={members}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

function LayerToggle({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
        active
          ? 'border-white/[0.12] bg-white/[0.05] text-ink-50'
          : 'border-white/[0.06] bg-transparent text-ink-300 hover:text-ink-100'
      }`}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-[3px]"
        style={{ background: active ? color : 'transparent', boxShadow: `inset 0 0 0 1px ${color}` }}
      />
      {label}
    </button>
  );
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
