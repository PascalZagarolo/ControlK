'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Headline, MetaTag, MetaDivider } from '@/components/ui/headline';
import { FilterPills } from '@/components/ui/filter-pills';
import { EmptyCreateCard } from '@/components/ui/empty-create-card';
import { CreateVehicleModal } from './create-vehicle-modal';
import { VehicleCard } from './vehicle-card';
import { VehicleTable } from './vehicle-table';
import { FleetCalendarMaster } from './fleet-calendar-master';
import { FleetSidebar, type FleetSmartView } from './fleet-sidebar';
import { FleetBulkBar } from './fleet-bulk-bar';
import { BulkImportModal } from './bulk-import-modal';
import { ShareVehicleModal } from './share-vehicle-modal';
import type { Vehicle, VehicleKind, VehicleTag, TodoUser } from '@/lib/types';

const VIEWS = ['Garage', 'Tabelle', 'Master-Kalender'] as const;
type View = (typeof VIEWS)[number];
const SORTS = ['Kennzeichen', 'KM', 'Auslastung', 'Einnahmen', 'Health'] as const;
type Sort = (typeof SORTS)[number];

export function FlotteListClient({
  vehicles,
  members,
  tags,
  currentUserId,
  counts,
}: {
  vehicles: Vehicle[];
  members: TodoUser[];
  tags: VehicleTag[];
  currentUserId: string;
  counts: {
    all: number;
    frei: number;
    vermietet: number;
    wartung: number;
    reserviert: number;
    mine: number;
    serviceDue: number;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>('Garage');
  const [smartView, setSmartView] = useState<FleetSmartView>('all');
  const [activeTagSlug, setActiveTagSlug] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<VehicleKind | null>(null);
  const [sort, setSort] = useState<Sort>('Kennzeichen');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [catalogShareOpen, setCatalogShareOpen] = useState(false);

  useEffect(() => {
    const sv = searchParams.get('view') as FleetSmartView | null;
    if (
      sv &&
      [
        'all',
        'mine',
        'frei',
        'vermietet',
        'wartung',
        'reserviert',
        'serviceDue',
        'topPerformer',
        'damageHotspot',
      ].includes(sv)
    ) {
      setSmartView(sv);
    }
  }, [searchParams]);

  const visible = useMemo(() => {
    let list = vehicles;
    // Smart-view
    if (smartView === 'mine') list = list.filter((v) => v.owner?.id === currentUserId);
    else if (smartView === 'frei') list = list.filter((v) => v.status === 'frei');
    else if (smartView === 'vermietet') list = list.filter((v) => v.status === 'vermietet');
    else if (smartView === 'wartung') list = list.filter((v) => v.status === 'wartung');
    else if (smartView === 'reserviert') list = list.filter((v) => v.status === 'reserviert');
    else if (smartView === 'serviceDue')
      list = list.filter(
        (v) =>
          v.serviceForecast?.status === 'soon' || v.serviceForecast?.status === 'overdue'
      );
    else if (smartView === 'topPerformer')
      list = list
        .slice()
        .filter((v) => (v.income?.totalCents ?? 0) > 0)
        .sort((a, b) => (b.income?.totalCents ?? 0) - (a.income?.totalCents ?? 0))
        .slice(0, 10);
    else if (smartView === 'damageHotspot')
      list = list.filter((v) => (v.damageHistory?.length ?? 0) > 0);

    if (activeKind) list = list.filter((v) => v.kind === activeKind);
    if (activeTagSlug) list = list.filter((v) => v.tags?.some((t) => t.slug === activeTagSlug));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (v) =>
          v.plate.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.location.toLowerCase().includes(q)
      );
    }

    const sorted = list.slice();
    if (sort === 'Kennzeichen') sorted.sort((a, b) => a.plate.localeCompare(b.plate, 'de'));
    else if (sort === 'KM') sorted.sort((a, b) => b.km - a.km);
    else if (sort === 'Auslastung')
      sorted.sort((a, b) => (b.utilization?.pct90d ?? 0) - (a.utilization?.pct90d ?? 0));
    else if (sort === 'Einnahmen')
      sorted.sort((a, b) => (b.income?.totalCents ?? 0) - (a.income?.totalCents ?? 0));
    else if (sort === 'Health') sorted.sort((a, b) => (b.health?.score ?? 0) - (a.health?.score ?? 0));
    return sorted;
  }, [vehicles, smartView, activeKind, activeTagSlug, query, sort, currentUserId]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (visible.every((v) => selected.has(v.dbId ?? v.id))) setSelected(new Set());
    else setSelected(new Set(visible.map((v) => v.dbId ?? v.id)));
  };

  const totalIncome = vehicles.reduce((acc, v) => acc + (v.income?.totalCents ?? 0), 0);
  const avgUtil =
    vehicles.length > 0
      ? vehicles.reduce((acc, v) => acc + (v.utilization?.pct90d ?? 0), 0) / vehicles.length
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1340px] gap-6 px-4 pb-32 pt-28 md:px-6">
      <FleetSidebar
        smartView={smartView}
        setSmartView={(v) => {
          setSmartView(v);
          const params = new URLSearchParams(searchParams.toString());
          if (v === 'all') params.delete('view');
          else params.set('view', v);
          router.replace(`/flotte${params.toString() ? '?' + params.toString() : ''}`, {
            scroll: false,
          });
        }}
        counts={counts}
        tags={tags}
        activeTagSlug={activeTagSlug}
        setActiveTagSlug={setActiveTagSlug}
        activeKind={activeKind}
        setActiveKind={setActiveKind}
      />

      <div className="min-w-0 flex-1">
        <Headline
          kicker="Flotte"
          title={
            smartView === 'all'
              ? 'Alle Fahrzeuge.'
              : smartView === 'mine'
                ? 'Mein Portfolio.'
                : smartView === 'serviceDue'
                  ? 'Service-Termine.'
                  : smartView === 'topPerformer'
                    ? 'Top-Performer.'
                    : 'Flotte.'
          }
          subtitle="Sprinter, Transporter, PKW, Kühlfahrzeuge — mit Live-Auslastung, Einnahmen, Health-Score und Wartung."
          meta={
            <>
              <MetaTag highlight>
                {Math.round(avgUtil * 100)}% Ø Auslastung
              </MetaTag>
              <MetaDivider />
              <MetaTag>{counts.frei} frei</MetaTag>
              <MetaDivider />
              <MetaTag>€{(totalIncome / 100).toLocaleString('de-DE')} 12M</MetaTag>
              {counts.serviceDue > 0 && (
                <>
                  <MetaDivider />
                  <MetaTag>{counts.serviceDue} Service fällig</MetaTag>
                </>
              )}
            </>
          }
          trailing={
            <div className="flex flex-wrap items-center gap-2">
              <FilterPills options={VIEWS} value={view} onChange={setView} />
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 transition-colors hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-ink-50"
              >
                CSV-Import
              </button>
              <button
                type="button"
                onClick={() => setCatalogShareOpen(true)}
                className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 transition-colors hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-ink-50"
              >
                🔗 Catalog
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium leading-none text-ink-50 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
              >
                + Neues Fahrzeug
              </button>
            </div>
          }
        />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Kennzeichen, Modell, Standort …"
            className="min-w-[220px] flex-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 text-[12.5px] text-ink-50 outline-none placeholder:text-ink-300 focus:border-white/[0.18]"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            Sortieren
          </span>
          <FilterPills options={SORTS} value={sort} onChange={setSort} />
          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
            {visible.length} sichtbar
          </span>
        </div>

        <div className="mt-6">
          {vehicles.length === 0 ? (
            <EmptyCreateCard
              title="Erstes Fahrzeug aufnehmen"
              subtitle="Sprinter, Transporter, PKW oder Kühlfahrzeug — Auslastung, Einnahmen, Wartung automatisch."
              onClick={() => setCreateOpen(true)}
            />
          ) : visible.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
              Nichts gefunden — anderen Filter oder Suchbegriff probieren.
            </div>
          ) : view === 'Garage' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((v) => (
                <VehicleCard
                  key={v.dbId ?? v.id}
                  vehicle={v}
                  selected={selected.has(v.dbId ?? v.id)}
                  onToggleSelect={() => toggleSelect(v.dbId ?? v.id)}
                />
              ))}
            </div>
          ) : view === 'Tabelle' ? (
            <VehicleTable
              vehicles={visible}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
            />
          ) : (
            <FleetCalendarMaster vehicles={visible} />
          )}
        </div>

        <FleetBulkBar
          selectedIds={Array.from(selected)}
          onClear={() => setSelected(new Set())}
          members={members}
          tags={tags}
        />
      </div>

      <CreateVehicleModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ShareVehicleModal
        open={catalogShareOpen}
        onClose={() => setCatalogShareOpen(false)}
        isCatalog
      />
    </div>
  );
}
