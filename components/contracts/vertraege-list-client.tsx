'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Headline, MetaTag, MetaDivider } from '@/components/ui/headline';
import { FilterPills } from '@/components/ui/filter-pills';
import { EmptyCreateCard } from '@/components/ui/empty-create-card';
import { CreateContractModal } from './create-contract-modal';
import { ContractCard } from './contract-card';
import { ContractTable } from './contract-table';
import { ContractFunnel } from './contract-funnel';
import { ContractTimelineStripe } from './contract-timeline-stripe';
import { RevenueStackChart } from './revenue-stack-chart';
import { ContractsSidebar, type ContractSmartView } from './contracts-sidebar';
import { ContractsBulkBar } from './contracts-bulk-bar';
import type {
  Contract,
  ContractRevenueBucket,
  TodoUser,
} from '@/lib/types';

const VIEWS = ['Karten', 'Tabelle', 'Funnel', 'Timeline'] as const;
type View = (typeof VIEWS)[number];
const SORTS = ['Erstellt', 'Wert', 'Restlaufzeit', 'Marge'] as const;
type Sort = (typeof SORTS)[number];

export function VertraegeListClient({
  contracts,
  customers,
  members,
  counts,
  revenueStack,
  currentUserId,
}: {
  contracts: Contract[];
  customers: { slug: string; name: string }[];
  members: TodoUser[];
  counts: {
    all: number;
    aktiv: number;
    auslaufend: number;
    entwurf: number;
    storniert: number;
    vorlagen: number;
    mine: number;
    expiring30: number;
    expiring14: number;
    highValue: number;
    pipelineCents: number;
  };
  revenueStack: ContractRevenueBucket[];
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>('Karten');
  const [smartView, setSmartView] = useState<ContractSmartView>('all');
  const [sort, setSort] = useState<Sort>('Erstellt');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const sv = searchParams.get('view') as ContractSmartView | null;
    if (
      sv &&
      [
        'all',
        'mine',
        'aktiv',
        'auslaufend',
        'expiring30',
        'expiring14',
        'entwurf',
        'storniert',
        'vorlagen',
        'highValue',
      ].includes(sv)
    ) {
      setSmartView(sv);
    }
  }, [searchParams]);

  const visible = useMemo(() => {
    let list = contracts;
    if (smartView === 'mine') list = list.filter((c) => c.owner?.id === currentUserId);
    else if (smartView === 'aktiv') list = list.filter((c) => c.status === 'aktiv');
    else if (smartView === 'auslaufend') list = list.filter((c) => c.status === 'auslaufend');
    else if (smartView === 'entwurf') list = list.filter((c) => c.status === 'entwurf');
    else if (smartView === 'storniert') list = list.filter((c) => c.status === 'storniert');
    else if (smartView === 'vorlagen') list = list.filter((c) => c.status === 'vorlage');
    else if (smartView === 'expiring30') {
      list = list.filter(
        (c) =>
          c.daysToEnd != null &&
          c.daysToEnd >= 0 &&
          c.daysToEnd <= 30 &&
          (c.status === 'aktiv' || c.status === 'auslaufend')
      );
    } else if (smartView === 'expiring14') {
      list = list.filter(
        (c) =>
          c.daysToEnd != null &&
          c.daysToEnd >= 0 &&
          c.daysToEnd <= 14 &&
          (c.status === 'aktiv' || c.status === 'auslaufend')
      );
    } else if (smartView === 'highValue') {
      list = list.filter((c) => (c.valueCents ?? 0) >= 500_000);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.customerName?.toLowerCase().includes(q) ||
          c.vehiclePlate?.toLowerCase().includes(q)
      );
    }

    const sorted = list.slice();
    if (sort === 'Erstellt')
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sort === 'Wert') sorted.sort((a, b) => (b.valueCents ?? 0) - (a.valueCents ?? 0));
    else if (sort === 'Restlaufzeit')
      sorted.sort((a, b) => (a.daysToEnd ?? 9999) - (b.daysToEnd ?? 9999));
    else if (sort === 'Marge')
      sorted.sort((a, b) => (b.margin?.netCents ?? 0) - (a.margin?.netCents ?? 0));
    return sorted;
  }, [contracts, smartView, query, sort, currentUserId]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => {
    if (visible.every((c) => selected.has(c.dbId ?? c.id))) setSelected(new Set());
    else setSelected(new Set(visible.map((c) => c.dbId ?? c.id)));
  };

  const showRenewalCockpit = smartView === 'expiring14' || smartView === 'expiring30';

  return (
    <div className="mx-auto flex w-full max-w-[1340px] gap-6 px-4 pb-32 pt-28 md:px-6">
      <ContractsSidebar
        smartView={smartView}
        setSmartView={(v) => {
          setSmartView(v);
          const params = new URLSearchParams(searchParams.toString());
          if (v === 'all') params.delete('view');
          else params.set('view', v);
          router.replace(`/vertraege${params.toString() ? '?' + params.toString() : ''}`, {
            scroll: false,
          });
        }}
        counts={counts}
      />

      <div className="min-w-0 flex-1">
        <Headline
          kicker="Verträge"
          title={
            smartView === 'all'
              ? 'Alle Verträge.'
              : smartView === 'mine'
                ? 'Mein Portfolio.'
                : smartView === 'expiring14'
                  ? 'Renewal-Cockpit · 14 Tage'
                  : smartView === 'expiring30'
                    ? 'Verträge laufen aus · 30 Tage'
                    : smartView === 'highValue'
                      ? 'High-Value Verträge'
                      : 'Verträge.'
          }
          subtitle="Pipeline, Renewals, Margen — alles in einer Ansicht. Auto-Spawn von Übergaben in den Kalender."
          meta={
            <>
              <MetaTag highlight>{counts.aktiv} aktiv</MetaTag>
              {counts.expiring30 > 0 && (
                <>
                  <MetaDivider />
                  <MetaTag>{counts.expiring30} laufen aus</MetaTag>
                </>
              )}
              {counts.pipelineCents > 0 && (
                <>
                  <MetaDivider />
                  <MetaTag>
                    €{(counts.pipelineCents / 100).toLocaleString('de-DE')} Pipeline
                  </MetaTag>
                </>
              )}
            </>
          }
          trailing={
            <div className="flex flex-wrap items-center gap-2">
              <FilterPills options={VIEWS} value={view} onChange={setView} />
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium leading-none text-ink-50 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
              >
                + Neuer Vertrag
              </button>
            </div>
          }
        />

        {/* Revenue stack chart — only on main view */}
        {smartView === 'all' && contracts.length > 0 && (
          <div className="mt-6">
            <RevenueStackChart buckets={revenueStack} />
          </div>
        )}

        {/* Renewal cockpit banner */}
        {showRenewalCockpit && visible.length > 0 && (
          <div className="mt-5 rounded-[10px] border border-[#ffd96a]/30 bg-[#ffd96a]/[0.06] px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#ffd96a]">
              ⚠ Renewal-Cockpit · {visible.length} Verträge
            </p>
            <p className="mt-1 text-[12.5px] text-ink-100">
              Click den Vertrag → „Verlängern" → neues Datum → Auto-Spawn der Übergabe/Rückgabe im Kalender.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Titel, Kunde, Fahrzeug …"
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
          {contracts.length === 0 ? (
            <EmptyCreateCard
              title="Ersten Vertrag erstellen"
              subtitle="Einzelvertrag oder Vorlage. Auto-Spawn von Übergabe + Rückgabe ins Kalender."
              onClick={() => setCreateOpen(true)}
            />
          ) : visible.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
              Nichts gefunden — anderen Filter oder Suchbegriff probieren.
            </div>
          ) : view === 'Karten' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((c) => (
                <ContractCard
                  key={c.dbId ?? c.id}
                  contract={c}
                  selected={selected.has(c.dbId ?? c.id)}
                  onToggleSelect={() => toggleSelect(c.dbId ?? c.id)}
                />
              ))}
            </div>
          ) : view === 'Tabelle' ? (
            <ContractTable
              contracts={visible}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
            />
          ) : view === 'Funnel' ? (
            <ContractFunnel contracts={visible} />
          ) : (
            <ContractTimelineStripe contracts={visible} />
          )}
        </div>

        <ContractsBulkBar
          selectedIds={Array.from(selected)}
          onClear={() => setSelected(new Set())}
          members={members}
        />
      </div>

      <CreateContractModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        customers={customers}
      />
    </div>
  );
}
