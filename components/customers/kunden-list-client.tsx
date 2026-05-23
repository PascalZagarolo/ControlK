'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Headline, MetaTag, MetaDivider } from '@/components/ui/headline';
import { FilterPills } from '@/components/ui/filter-pills';
import { EmptyCreateCard } from '@/components/ui/empty-create-card';
import { CreateCustomerModal } from './create-customer-modal';
import { CustomerCard } from './customer-card';
import { CustomerTable } from './customer-table';
import { CustomerFunnelView } from './customer-funnel-view';
import { CustomerSidebar } from './customer-sidebar';
import { CustomerBulkBar } from './customer-bulk-bar';
import type { Customer, CustomerTag, TodoUser } from '@/lib/types';

const VIEWS = ['Karten', 'Tabelle', 'Funnel'] as const;
type View = (typeof VIEWS)[number];
const SORTS = ['Name', 'MRC', 'Health', 'Letzter Kontakt'] as const;
type Sort = (typeof SORTS)[number];

type SmartView =
  | 'all'
  | 'mine'
  | 'active'
  | 'lead'
  | 'inactive'
  | 'risk'
  | 'quiet'
  | 'expiring'
  | 'onboarding';

export function KundenListClient({
  customers,
  members,
  tags,
  currentUserId,
  counts,
}: {
  customers: Customer[];
  members: TodoUser[];
  tags: CustomerTag[];
  currentUserId: string;
  counts: {
    all: number;
    mine: number;
    active: number;
    lead: number;
    inactive: number;
    risk: number;
    quiet: number;
    expiring: number;
    onboarding: number;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<View>('Karten');
  const [smartView, setSmartView] = useState<SmartView>('all');
  const [activeTagSlug, setActiveTagSlug] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('Name');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const sv = searchParams.get('view') as SmartView | null;
    if (sv && ['all', 'mine', 'active', 'lead', 'inactive', 'risk', 'quiet', 'expiring', 'onboarding'].includes(sv)) {
      setSmartView(sv);
    }
  }, [searchParams]);

  const visible = useMemo(() => {
    let list = customers;
    // Smart view filter
    if (smartView === 'mine') list = list.filter((c) => c.owner?.id === currentUserId);
    else if (smartView === 'active') list = list.filter((c) => c.status === 'aktiv');
    else if (smartView === 'lead') list = list.filter((c) => c.status === 'lead');
    else if (smartView === 'inactive') list = list.filter((c) => c.status === 'inaktiv');
    else if (smartView === 'risk' || smartView === 'quiet') {
      list = list.filter(
        (c) => c.status === 'aktiv' && (c.quietDays ?? 0) >= 14 && (c.quietDays ?? 9999) < 9999
      );
    } else if (smartView === 'expiring') {
      list = list.filter(
        (c) =>
          (c.forecast?.atRiskCents ?? 0) > 0
      );
    } else if (smartView === 'onboarding') {
      list = list.filter((c) => c.status === 'lead');
    }
    // Tag filter
    if (activeTagSlug) list = list.filter((c) => c.tags?.some((t) => t.slug === activeTagSlug));
    // Search
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q) ||
          c.contacts.some((p) => p.name.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
      );
    }
    // Sort
    const sorted = list.slice();
    if (sort === 'Name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    else if (sort === 'MRC')
      sorted.sort((a, b) => (b.forecast?.activeMrcCents ?? 0) - (a.forecast?.activeMrcCents ?? 0));
    else if (sort === 'Health')
      sorted.sort((a, b) => (b.health?.score ?? 0) - (a.health?.score ?? 0));
    else if (sort === 'Letzter Kontakt')
      sorted.sort((a, b) => (a.quietDays ?? 9999) - (b.quietDays ?? 9999));
    return sorted;
  }, [customers, smartView, activeTagSlug, query, sort, currentUserId]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (visible.every((c) => selected.has(c.dbId ?? c.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((c) => c.dbId ?? c.id)));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1340px] gap-6 px-4 pb-32 pt-28 md:px-6">
      <CustomerSidebar
        smartView={smartView}
        setSmartView={(v) => {
          setSmartView(v);
          const params = new URLSearchParams(searchParams.toString());
          if (v === 'all') params.delete('view');
          else params.set('view', v);
          router.replace(`/kunden${params.toString() ? '?' + params.toString() : ''}`, {
            scroll: false,
          });
        }}
        counts={counts}
        tags={tags}
        activeTagSlug={activeTagSlug}
        setActiveTagSlug={setActiveTagSlug}
      />

      <div className="min-w-0 flex-1">
        <Headline
          kicker="Kunden"
          title={
            smartView === 'all'
              ? 'Alle Kunden.'
              : smartView === 'mine'
                ? 'Mein Portfolio.'
                : smartView === 'risk' || smartView === 'quiet'
                  ? 'Kunden, die sich melden sollten.'
                  : smartView === 'expiring'
                    ? 'Verträge laufen aus.'
                    : 'Kunden.'
          }
          subtitle="Leads, aktive Accounts und alles dazwischen — mit Live-Fleet, Health-Score und Pipeline-Forecast."
          meta={
            <>
              <MetaTag highlight>{counts.active} aktiv</MetaTag>
              <MetaDivider />
              <MetaTag>{counts.lead} Leads</MetaTag>
              {counts.quiet > 0 && (
                <>
                  <MetaDivider />
                  <MetaTag>{counts.quiet} stumm</MetaTag>
                </>
              )}
              {counts.expiring > 0 && (
                <>
                  <MetaDivider />
                  <MetaTag>{counts.expiring} expiring</MetaTag>
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
                + Neuer Kunde
              </button>
            </div>
          }
        />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach Name, Branche, Kontakt …"
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
          {customers.length === 0 ? (
            <EmptyCreateCard
              title="Ersten Kunden anlegen"
              subtitle="Leads, aktive Accounts, Bestandskunden — alles an einem Ort."
              onClick={() => setCreateOpen(true)}
            />
          ) : visible.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
              Nichts gefunden — anderen Filter oder Suchbegriff probieren.
            </div>
          ) : view === 'Karten' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((c) => (
                <CustomerCard
                  key={c.dbId ?? c.id}
                  customer={c}
                  selected={selected.has(c.dbId ?? c.id)}
                  onToggleSelect={() => toggleSelect(c.dbId ?? c.id)}
                />
              ))}
            </div>
          ) : view === 'Tabelle' ? (
            <CustomerTable
              customers={visible}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
            />
          ) : (
            <CustomerFunnelView customers={visible} />
          )}
        </div>

        <CustomerBulkBar
          selectedIds={Array.from(selected)}
          onClear={() => setSelected(new Set())}
          members={members}
          tags={tags}
        />
      </div>

      <CreateCustomerModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
