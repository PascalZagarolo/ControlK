'use client';

import { useMemo, useState } from 'react';
import { Card, Carousel, type CardData } from '@/components/ui/apple-cards-carousel';
import { Sparkline } from '@/components/ui/sparkline';
import { CreateChannelModal } from '@/components/channels/create-channel-modal';
import { CreateCustomerModal } from '@/components/customers/create-customer-modal';
import { CreateContractModal } from '@/components/contracts/create-contract-modal';
import { CreateVehicleModal } from '@/components/fleet/create-vehicle-modal';
import { CreateEventModal } from '@/components/calendar/create-event-modal';
import { CreateGroupModal } from '@/components/todos/create-group-modal';
import type {
  Channel,
  Customer,
  Contract,
  Vehicle,
  CalendarEvent,
  TodoGroup,
  TodoUser,
} from '@/lib/types';

type Category = 'Alle' | 'Todos' | 'Channels' | 'Kunden' | 'Verträge' | 'Flotte' | 'Kalender';
const CATEGORIES: Category[] = [
  'Alle',
  'Todos',
  'Channels',
  'Kunden',
  'Verträge',
  'Flotte',
  'Kalender',
];

const DARK = 'linear-gradient(180deg, #16181d 0%, #0a0b0d 100%)';

function tintFor(color: string | undefined) {
  if (!color) return DARK;
  return `linear-gradient(180deg, ${color}33 0%, ${color}10 30%, #0a0b0d 100%)`;
}

export function CardsCarousel({
  channels,
  customers,
  contracts,
  vehicles,
  events,
  todoGroups,
  members,
}: {
  channels: Channel[];
  customers: Customer[];
  contracts: Contract[];
  vehicles: Vehicle[];
  events: CalendarEvent[];
  todoGroups: TodoGroup[];
  members: TodoUser[];
}) {
  const [active, setActive] = useState<Category>('Alle');
  const [createOpen, setCreateOpen] = useState<
    'Channels' | 'Kunden' | 'Verträge' | 'Flotte' | 'Kalender' | 'Todos' | null
  >(null);

  const channelCards = useMemo<CardData[]>(
    () =>
      channels.map((c) => ({
        category: 'Channel',
        title: `#${c.name}`,
        src: DARK,
        href: `/channels/${c.slug}`,
        meta: [
          `${c.members} Mitglieder`,
          ...(c.unread > 0 ? [`${c.unread} ungelesen`] : []),
        ],
        description: c.topic || 'Kein Topic gesetzt.',
      })),
    [channels]
  );

  const customerCards = useMemo<CardData[]>(
    () =>
      customers.map((c) => ({
        category: 'Kunde',
        title: c.name,
        src: DARK,
        href: `/kunden/${c.id}`,
        meta: [
          c.status === 'aktiv' ? 'Aktiv' : c.status === 'lead' ? 'Lead' : 'Inaktiv',
          ...(c.industry ? [c.industry] : []),
          ...(c.activeContracts > 0 ? [`${c.activeContracts} Verträge`] : []),
        ],
        description: c.notes || `Letzter Kontakt: ${c.lastTouchpoint}`,
      })),
    [customers]
  );

  const contractCards = useMemo<CardData[]>(
    () =>
      contracts.map((c) => ({
        category: c.status === 'vorlage' ? 'Vorlage' : 'Vertrag',
        title: c.title,
        src: DARK,
        href: `/vertraege/${c.id}`,
        meta: [
          c.status,
          ...(c.customerName ? [c.customerName] : []),
          ...(c.status !== 'vorlage' ? [c.value] : []),
        ],
        description: c.body[0]?.paragraphs[0] ?? `Erstellt von ${c.createdBy}.`,
      })),
    [contracts]
  );

  const vehicleCards = useMemo<CardData[]>(
    () =>
      vehicles.map((v) => ({
        category: 'Fahrzeug',
        title: v.model,
        src: DARK,
        href: `/flotte/${v.id}`,
        meta: [
          v.plate,
          v.status,
          v.location || '—',
          `${v.km.toLocaleString('de-DE')} km`,
        ],
        description: `Nächste Wartung: ${v.nextService}.`,
      })),
    [vehicles]
  );

  const eventCards = useMemo<CardData[]>(
    () =>
      events.map((e) => ({
        category:
          e.kind === 'handover'
            ? 'Übergabe'
            : e.kind === 'return'
              ? 'Rückgabe'
              : e.kind === 'maintenance'
                ? 'Wartung'
                : 'Termin',
        title: e.title,
        src: DARK,
        href: '/kalender',
        meta: [
          new Date(e.startsAt).toLocaleString('de-DE', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
        ],
        description: e.detail || '—',
      })),
    [events]
  );

  const groupCards = useMemo<CardData[]>(
    () =>
      todoGroups.map((g) => {
        const h = g.health;
        const meta = [
          g.openCount === 0 ? 'Alles erledigt' : `${g.openCount} offen`,
          ...(g.totalCount > 0 ? [`${g.totalCount} gesamt`] : []),
        ];
        if (h && h.throughputLast7d > 0) meta.push(`${h.throughputLast7d}/7d`);
        if (h && h.staleRatio >= 0.3 && g.openCount > 0)
          meta.push(`${Math.round(h.staleRatio * 100)}% stale`);
        const extra =
          h && (h.throughputLast7d > 0 || g.openCount > 0) ? (
            <div className="flex items-center gap-2">
              <Sparkline
                values={h.spark}
                color={g.color || '#5eb6ff'}
                width={70}
                height={18}
                title={`${h.throughputLast7d} erledigt in 7d`}
              />
              {h.meanCloseHours != null && (
                <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-white/55">
                  Ø {h.meanCloseHours < 24
                    ? `${Math.round(h.meanCloseHours)}h`
                    : `${Math.round(h.meanCloseHours / 24)}d`}
                </span>
              )}
            </div>
          ) : undefined;
        return {
          category: g.pinned ? 'Todo-Gruppe · pinned' : 'Todo-Gruppe',
          title: g.emoji ? `${g.emoji}  ${g.name}` : g.name,
          src: tintFor(g.color),
          href: `/todos/${g.slug}`,
          meta,
          description: g.description || 'Klick öffnet die Gruppe — dort legst du Todos an.',
          extra,
        };
      }),
    [todoGroups]
  );

  const byCategory = useMemo(
    () => ({
      Channels: channelCards,
      Kunden: customerCards,
      Verträge: contractCards,
      Flotte: vehicleCards,
      Kalender: eventCards,
      Todos: groupCards,
    }),
    [channelCards, customerCards, contractCards, vehicleCards, eventCards, groupCards]
  );

  type Slot =
    | { kind: 'entity'; data: CardData }
    | {
        kind: 'create';
        for: 'Channels' | 'Kunden' | 'Verträge' | 'Flotte' | 'Kalender' | 'Todos';
      };

  const slots = useMemo<Slot[]>(() => {
    if (active === 'Alle') {
      const all = [
        ...groupCards,
        ...channelCards,
        ...customerCards,
        ...contractCards,
        ...vehicleCards,
        ...eventCards,
      ];
      if (all.length === 0) {
        return (['Todos', 'Channels', 'Kunden', 'Verträge', 'Flotte', 'Kalender'] as const).map(
          (c) => ({ kind: 'create' as const, for: c })
        );
      }
      return all.map((d) => ({ kind: 'entity' as const, data: d }));
    }
    const list = byCategory[active];
    if (list.length === 0) {
      return [{ kind: 'create' as const, for: active }];
    }
    return list.map((d) => ({ kind: 'entity' as const, data: d }));
  }, [
    active,
    byCategory,
    groupCards,
    channelCards,
    customerCards,
    contractCards,
    vehicleCards,
    eventCards,
  ]);

  const items = slots.map((slot, i) =>
    slot.kind === 'entity' ? (
      <Card key={slot.data.title + i} card={slot.data} />
    ) : (
      <CreateCard
        key={`create-${slot.for}-${i}`}
        category={slot.for}
        onClick={() => setCreateOpen(slot.for)}
      />
    )
  );

  return (
    <section className="relative z-10 w-full pb-16">
      <div className="mx-auto max-w-[920px] px-6 md:px-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-6">
          <div>
            <h2 className="text-[26px] font-medium leading-[1.2] tracking-[-0.3px] text-ink-50 md:text-[36px]">
              Direkt einsteigen.
            </h2>
            <p className="mt-2 max-w-[480px] text-[13.5px] leading-[1.55] text-ink-200 md:text-[15px]">
              Was du oft anfasst, einen Klick entfernt.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((c) => {
              const isActive = c === active;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActive(c)}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium leading-none transition-colors duration-150 ${
                    isActive
                      ? 'border-white/15 bg-white/[0.08] text-ink-50'
                      : 'border-white/[0.06] bg-white/[0.02] text-ink-200 hover:border-white/10 hover:bg-white/[0.04] hover:text-ink-50'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Carousel key={active + '-' + slots.length} items={items} />

      <CreateChannelModal
        open={createOpen === 'Channels'}
        onClose={() => setCreateOpen(null)}
      />
      <CreateCustomerModal
        open={createOpen === 'Kunden'}
        onClose={() => setCreateOpen(null)}
      />
      <CreateContractModal
        open={createOpen === 'Verträge'}
        onClose={() => setCreateOpen(null)}
        customers={customers.map((c) => ({ slug: c.id, name: c.name }))}
      />
      <CreateVehicleModal
        open={createOpen === 'Flotte'}
        onClose={() => setCreateOpen(null)}
      />
      <CreateEventModal
        open={createOpen === 'Kalender'}
        onClose={() => setCreateOpen(null)}
      />
      <CreateGroupModal
        open={createOpen === 'Todos'}
        onClose={() => setCreateOpen(null)}
        members={members}
      />
    </section>
  );
}

const CREATE_LABEL: Record<
  'Channels' | 'Kunden' | 'Verträge' | 'Flotte' | 'Kalender' | 'Todos',
  { kicker: string; title: string; sub: string }
> = {
  Todos: {
    kicker: 'Todo-Gruppe',
    title: 'Erste Todo-Gruppe anlegen',
    sub: 'Container wie „uRent", „Zuhause" oder „Marketing" — drin landen deine Aufgaben.',
  },
  Channels: {
    kicker: 'Channel',
    title: 'Ersten Channel erstellen',
    sub: 'Wo dein Team gemeinsam an Themen arbeitet.',
  },
  Kunden: {
    kicker: 'Kunde',
    title: 'Ersten Kunden anlegen',
    sub: 'Lead, aktiver Account oder Bestandskunde.',
  },
  Verträge: {
    kicker: 'Vertrag',
    title: 'Ersten Vertrag erstellen',
    sub: 'Einzelvertrag oder Vorlage.',
  },
  Flotte: {
    kicker: 'Fahrzeug',
    title: 'Erstes Fahrzeug aufnehmen',
    sub: 'Sprinter, Transporter, PKW oder Kühlfahrzeug.',
  },
  Kalender: {
    kicker: 'Termin',
    title: 'Ersten Termin anlegen',
    sub: 'Übergabe, Rückgabe, internes Meeting, Wartung.',
  },
};

function CreateCard({
  category,
  onClick,
}: {
  category: 'Channels' | 'Kunden' | 'Verträge' | 'Flotte' | 'Kalender' | 'Todos';
  onClick: () => void;
}) {
  const c = CREATE_LABEL[category];
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative z-10 flex h-72 w-48 shrink-0 flex-col items-start justify-between overflow-hidden rounded-3xl border border-dashed border-white/[0.12] bg-[linear-gradient(180deg,#16181d_0%,#0a0b0d_100%)] text-left transition-colors duration-200 hover:border-white/[0.28] md:h-[28rem] md:w-64"
    >
      <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-b from-black/15 via-transparent to-black/40" />

      <div className="relative z-40 w-full p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-white/55">
          {c.kicker}
        </p>
      </div>

      <div className="relative z-40 flex w-full flex-col items-center gap-3 px-5 pb-12 pt-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.04] text-[28px] font-light leading-none text-white/80 transition-all duration-200 group-hover:scale-105 group-hover:border-white/[0.28] group-hover:bg-white/[0.08] group-hover:text-white">
          +
        </span>
      </div>

      <div className="relative z-40 w-full p-5">
        <p className="text-[15px] font-medium leading-[1.2] tracking-[-0.2px] text-white [text-wrap:balance] md:text-[17px]">
          {c.title}
        </p>
        <p className="mt-2 line-clamp-3 text-[12px] leading-[1.45] text-white/65">{c.sub}</p>
      </div>
    </button>
  );
}
