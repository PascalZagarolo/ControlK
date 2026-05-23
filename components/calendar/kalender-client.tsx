'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { KIND_META } from './event-color';
import type {
  CalendarEvent,
  CalendarConflict,
  CalendarPreFlightAlert,
  CalendarTemplate,
  DayDensityCell,
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
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>('Woche');
  const [smartView, setSmartView] = useState<CalendarSmartView>('all');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [prefillStart, setPrefillStart] = useState<string | undefined>(undefined);

  const openEventId = searchParams.get('event');
  const drawerEvent = useMemo(
    () => events.find((e) => e.id === openEventId) ?? null,
    [events, openEventId]
  );

  const openEvent = (id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('event', id);
    router.replace(`/kalender?${p.toString()}`, { scroll: false });
  };
  const closeEvent = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('event');
    router.replace(p.toString() ? `/kalender?${p.toString()}` : '/kalender', { scroll: false });
  };

  const filtered = useMemo(() => {
    let list = events;
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
  }, [events, smartView, conflicts]);

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
    <div className="mx-auto flex w-full max-w-[1340px] gap-6 px-4 pb-32 pt-28 md:px-6">
      <CalendarSidebar
        smartView={smartView}
        setSmartView={setSmartView}
        counts={counts}
        density={density}
        cursor={cursor}
        setCursor={setCursor}
      />

      <div className="min-w-0 flex-1">
        <Headline
          kicker="Kalender"
          title={headlineTitle}
          subtitle="Übergaben, Rückgaben, Wartung — mit Conflict-Detection und Fahrzeug-Resource-View."
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
                  setPrefillStart(undefined);
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
          <div className="mt-5 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
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
          </div>
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

        <div className="mt-6">
          {view === 'Monat' && (
            <MonthView cursor={cursor} events={filtered} onOpen={openEvent} />
          )}
          {view === 'Woche' && (
            <WeekView cursor={cursor} events={filtered} onOpen={openEvent} />
          )}
          {view === 'Tag' && (
            <DayView cursor={cursor} events={filtered} onOpen={openEvent} />
          )}
          {view === 'Agenda' && <AgendaView events={filtered} onOpen={openEvent} />}
          {view === 'Resource' && (
            <ResourceView cursor={cursor} rows={resourceRows} onOpen={openEvent} />
          )}
          {view === 'Jahr' && <YearHeatmapView density={yearDensity} />}
        </div>
      </div>

      <CreateEventModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        customers={customers}
        vehicles={vehicles}
        contracts={contracts}
        templates={templates}
        prefilledStart={prefillStart}
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

      {drawerEvent && <EventDetailDrawer event={drawerEvent} onClose={closeEvent} />}
    </div>
  );
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
