'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/channel/avatar';
import { Sparkline } from '@/components/ui/sparkline';
import { MetaDivider } from '@/components/ui/headline';
import { FilterPills } from '@/components/ui/filter-pills';
import { CreateTodoModal } from '@/components/todos/create-todo-modal';
import { CreateEventModal } from '@/components/calendar/create-event-modal';
import { CreateContractModal } from '@/components/contracts/create-contract-modal';
import { HealthScoreRing, HealthBreakdown } from './health-score-ring';
import { ContractTimeline } from './contract-timeline';
import { FleetInUseList } from './fleet-in-use';
import { MergedActivityFeed } from './merged-activity-feed';
import { ChannelHeatmap } from './channel-heatmap';
import { OnboardingChecklist } from './onboarding-checklist';
import { TagPicker } from './tag-picker';
import { OwnerPicker } from './owner-picker';
import { InlineEditField } from './inline-edit-field';
import { CustomerNotesEditor, QuickNoteEntry } from './customer-notes-editor';
import { ShareCustomerModal } from './share-customer-modal';
import { QuoteInChannelButton } from './quote-in-channel-button';
import { WorkflowQuickReplay } from './workflow-quick-replay';
import type {
  Contract,
  Customer,
  CustomerShareLink,
  CustomerTag,
  TodoGroup,
  TodoUser,
  Workflow,
} from '@/lib/types';

const TABS = [
  'Übersicht',
  'Aktivität',
  'Kontakte',
  'Verträge',
  'Flotte',
  'Channels',
  'Notizen',
  'Insights',
] as const;
type Tab = (typeof TABS)[number];

type ChannelOpt = { id: string; slug: string; name: string };
type VehicleOpt = { id: string; externalId: string; plate: string; model: string };

function fmtEur(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

const STATUS_META = {
  aktiv: { label: 'Aktiv', color: '#5ee08a' },
  lead: { label: 'Lead', color: '#5eb6ff' },
  inaktiv: { label: 'Inaktiv', color: '#7d7d7d' },
} as const;

export function KundenDetailClient({
  customer,
  contracts,
  members,
  allTags,
  linkedChannels,
  workflows,
  todoGroups,
  customerVehicles,
  shareLinks,
}: {
  customer: Customer;
  contracts: Contract[];
  members: TodoUser[];
  allTags: CustomerTag[];
  linkedChannels: ChannelOpt[];
  workflows: Workflow[];
  todoGroups: TodoGroup[];
  customerVehicles: VehicleOpt[];
  shareLinks: CustomerShareLink[];
}) {
  useRouter(); // for client-mount stability with revalidation
  const [tab, setTab] = useState<Tab>('Übersicht');
  const [createTodoOpen, setCreateTodoOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [createContractOpen, setCreateContractOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const dbId = customer.dbId ?? '';
  const status = STATUS_META[customer.status];
  const tint = `linear-gradient(140deg, ${customer.from}26 0%, ${customer.to}10 50%, transparent 100%)`;

  const dbContractList = useMemo(
    () =>
      contracts.map((c: any) => ({
        id: c.dbId ?? c.id,
        title: c.title,
        valueCents: c.valueCents ?? 0,
      })),
    [contracts]
  );

  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: tint }}
      />

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-4 pb-32 pt-28 md:px-6">
        <header className="flex flex-col gap-5">
          <Link
            href="/kunden"
            className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.4px] text-ink-300 transition-colors hover:text-ink-50"
          >
            <span>←</span>
            <span>Alle Kunden</span>
          </Link>

          <div className="flex flex-wrap items-start gap-5">
            <Avatar
              initials={customer.initials}
              from={customer.from}
              to={customer.to}
              size={64}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.3px]"
                  style={{ background: `${status.color}1f`, color: status.color }}
                >
                  <span
                    className="inline-block h-1 w-1 rounded-full"
                    style={{ background: status.color }}
                  />
                  {status.label}
                </span>
                {dbId && (
                  <TagPicker customerId={dbId} current={customer.tags ?? []} all={allTags} />
                )}
              </div>
              <h1 className="mt-1 text-[36px] font-medium leading-[1.05] tracking-[-0.4px] text-ink-50 md:text-[42px]">
                {dbId ? (
                  <InlineEditField
                    customerId={dbId}
                    field="name"
                    value={customer.name}
                    displayClassName="hover:underline decoration-white/20"
                  />
                ) : (
                  customer.name
                )}
              </h1>
              <p className="mt-1 text-[13px] text-ink-300">
                {dbId ? (
                  <InlineEditField
                    customerId={dbId}
                    field="industry"
                    value={customer.industry}
                    placeholder="Branche hinzufügen"
                  />
                ) : (
                  customer.industry
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {customer.health && <HealthScoreRing health={customer.health} size={84} />}
              {dbId && (
                <OwnerPicker
                  customerId={dbId}
                  current={customer.owner}
                  members={members}
                />
              )}
            </div>
          </div>

          {customer.forecast && (
            <div className="grid grid-cols-2 gap-2 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-4">
              <Kpi
                label="MRC aktiv"
                value={fmtEur(customer.forecast.activeMrcCents)}
                color="#5ee08a"
                tooltip="Summe aller aktiven Verträge"
              />
              <Kpi
                label="At Risk (30d)"
                value={fmtEur(customer.forecast.atRiskCents)}
                color="#ffd96a"
                tooltip="Verträge mit Status auslaufend"
              />
              <Kpi
                label="Pipeline"
                value={fmtEur(customer.forecast.pipelineCents)}
                color="#5eb6ff"
                tooltip="Entwürfe × 50%"
              />
              <Kpi
                label="Fahrzeuge aktiv"
                value={String(customer.fleetInUse?.length ?? 0)}
                color="#c084fc"
                tooltip="Aktuell vermietete Fahrzeuge"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-300">
            {customer.renewalProbability !== undefined && (
              <span>
                Renewal:{' '}
                <span
                  className="font-medium"
                  style={{
                    color:
                      customer.renewalProbability >= 0.7
                        ? '#5ee08a'
                        : customer.renewalProbability >= 0.4
                          ? '#ffd96a'
                          : '#ff8a8a',
                  }}
                >
                  {Math.round(customer.renewalProbability * 100)}%
                </span>
              </span>
            )}
            {customer.quietDays !== undefined && customer.quietDays < 9999 && (
              <>
                <MetaDivider />
                <span>
                  Letzter Kontakt:{' '}
                  <span className={customer.quietDays > 14 ? 'text-[#ffd96a]' : ''}>
                    vor {customer.quietDays}d
                  </span>
                </span>
              </>
            )}
            {customer.damagePattern &&
              customer.damagePattern.totalDamages > 0 &&
              customer.damagePattern.deltaPercent > 0 && (
                <>
                  <MetaDivider />
                  <span className="text-[#ff8a8a]">
                    Schäden +{customer.damagePattern.deltaPercent}% vs. Avg
                  </span>
                </>
              )}
            {customer.mentions && (
              <>
                <MetaDivider />
                <span>
                  Mentions: {customer.mentions.channels} Ch · {customer.mentions.contracts} V ·{' '}
                  {customer.mentions.todos} T
                </span>
              </>
            )}
            {customer.health && (
              <span className="ml-auto">
                <Sparkline values={customer.health.spark} color={customer.from} width={80} height={18} />
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={() => setCreateTodoOpen(true)} icon="✓">
              Neues Todo
            </ActionButton>
            <ActionButton onClick={() => setCreateEventOpen(true)} icon="📅">
              Termin
            </ActionButton>
            <ActionButton onClick={() => setCreateContractOpen(true)} icon="§">
              Vertrag
            </ActionButton>
            {linkedChannels.length > 0 && (
              <Link
                href={`/channels/${linkedChannels[0].slug}`}
                className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 text-[12px] text-ink-200 transition-colors hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-ink-50"
              >
                💬 Channel
              </Link>
            )}
            {dbId && dbContractList.length > 0 && linkedChannels.length > 0 && (
              <QuoteInChannelButton
                customerId={dbId}
                contracts={dbContractList}
                channels={linkedChannels}
              />
            )}
            <ActionButton onClick={() => setShareOpen(true)} icon="🔗">
              Portal teilen
            </ActionButton>
          </div>

          {customer.contractTimeline && customer.contractTimeline.length > 0 && (
            <ContractTimeline contracts={customer.contractTimeline} />
          )}
        </header>

        <div className="flex flex-col gap-6">
          <FilterPills options={TABS} value={tab} onChange={setTab} />

          {tab === 'Übersicht' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="flex flex-col gap-6">
                {dbId && customer.onboardingProgress !== undefined && (
                  <OnboardingChecklist
                    customerId={dbId}
                    progress={customer.onboardingProgress}
                  />
                )}

                <Section title="Aktuell vermietet">
                  <FleetInUseList items={customer.fleetInUse ?? []} />
                </Section>

                <Section title="Aktive Verträge">
                  <ActiveContracts contracts={contracts} />
                </Section>

                <Section title="Letzte Aktivität">
                  <MergedActivityFeed
                    entries={(customer.mergedActivity ?? []).slice(0, 10)}
                    compact
                  />
                  <div className="mt-3">
                    {dbId && <QuickNoteEntry customerId={dbId} />}
                  </div>
                </Section>
              </div>

              <aside className="flex flex-col gap-6">
                {customer.health && (
                  <Section title="Health Breakdown">
                    <HealthBreakdown health={customer.health} />
                  </Section>
                )}

                {dbId && workflows.length > 0 && (
                  <WorkflowQuickReplay
                    workflows={workflows}
                    groups={todoGroups}
                    members={members}
                    customerName={customer.name}
                    customerId={dbId}
                  />
                )}

                {customer.channelHeatmap && (
                  <ChannelHeatmap grid={customer.channelHeatmap} />
                )}

                {linkedChannels.length > 0 && (
                  <Section title="Verknüpfte Channels">
                    <div className="flex flex-col gap-1">
                      {linkedChannels.map((c) => (
                        <Link
                          key={c.id}
                          href={`/channels/${c.slug}`}
                          className="flex items-center gap-2 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[12.5px] text-ink-100 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
                        >
                          <span className="font-mono text-[11px] text-ink-300">#</span>
                          <span className="flex-1 truncate">{c.name}</span>
                          <span className="font-mono text-[10px] text-ink-300">→</span>
                        </Link>
                      ))}
                    </div>
                  </Section>
                )}
              </aside>
            </div>
          )}

          {tab === 'Aktivität' && (
            <MergedActivityFeed entries={customer.mergedActivity ?? []} />
          )}

          {tab === 'Kontakte' && <ContactsTab contacts={customer.contacts} />}

          {tab === 'Verträge' && <ContractsTab contracts={contracts} />}

          {tab === 'Flotte' && (
            <FleetTab vehicles={customerVehicles} fleetInUse={customer.fleetInUse ?? []} />
          )}

          {tab === 'Channels' && (
            <ChannelsTab channels={linkedChannels} heatmap={customer.channelHeatmap} />
          )}

          {tab === 'Notizen' && dbId && (
            <CustomerNotesEditor customerId={dbId} notes={customer.notes} />
          )}

          {tab === 'Insights' && <InsightsTab customer={customer} contracts={contracts} />}
        </div>
      </div>

      <CreateTodoModal
        open={createTodoOpen}
        onClose={() => setCreateTodoOpen(false)}
        members={members}
        customers={[{ dbId: customer.dbId ?? '', slug: customer.id, name: customer.name }]}
        contracts={contracts.map((c: any) => ({
          dbId: c.dbId ?? c.id,
          externalId: c.id,
          title: c.title,
        }))}
        vehicles={customerVehicles.map((v) => ({
          dbId: v.id,
          externalId: v.externalId ?? v.id,
          label: `${v.plate} · ${v.model}`,
        }))}
        channels={linkedChannels.map((c) => ({ dbId: c.id, slug: c.slug, name: c.name }))}
        groups={todoGroups}
        defaults={{ customerId: customer.dbId }}
      />

      <CreateEventModal
        open={createEventOpen}
        onClose={() => setCreateEventOpen(false)}
      />

      <CreateContractModal
        open={createContractOpen}
        onClose={() => setCreateContractOpen(false)}
        customers={[{ slug: customer.id, name: customer.name }]}
      />

      {dbId && (
        <ShareCustomerModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          customerId={dbId}
          customerName={customer.name}
          existingLinks={shareLinks}
        />
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  color: string;
  tooltip?: string;
}) {
  return (
    <div title={tooltip} className="flex flex-col gap-1 rounded-[10px] bg-white/[0.02] px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">{label}</span>
      <span className="font-mono text-[18px] tabular-nums leading-none" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  icon,
  children,
  onClick,
}: {
  icon: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 text-[12px] text-ink-200 transition-colors hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-ink-50"
    >
      <span>{icon}</span>
      <span>{children}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ActiveContracts({ contracts }: { contracts: Contract[] }) {
  const active = contracts.filter((c) => c.status === 'aktiv' || c.status === 'auslaufend');
  if (active.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-4 text-center text-[12px] text-ink-300">
        Keine aktiven Verträge.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {active.map((c) => {
        const daysLeft = c.endsAt
          ? Math.ceil((new Date(c.endsAt).getTime() - Date.now()) / 86_400_000)
          : null;
        return (
          <Link
            key={c.id}
            href={`/vertraege/${c.id}`}
            className="group flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
          >
            <span className="font-mono text-[12px] text-ink-300">§</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink-50">{c.title}</span>
              <span className="mt-0.5 block text-[11px] text-ink-300">
                {c.value}
                {daysLeft != null && daysLeft >= 0 && (
                  <>
                    {' · '}
                    <span className={daysLeft <= 14 ? 'text-[#ffd96a]' : ''}>
                      {daysLeft === 0 ? 'läuft heute' : `${daysLeft}d Restlaufzeit`}
                    </span>
                  </>
                )}
              </span>
            </span>
            <span className="font-mono text-[10px] text-ink-300 group-hover:text-ink-50">→</span>
          </Link>
        );
      })}
    </div>
  );
}

function ContactsTab({ contacts }: { contacts: Customer['contacts'] }) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-8 text-center text-[12px] text-ink-300">
        Noch keine Kontakte hinterlegt.
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {contacts.map((c, i) => (
        <div
          key={c.id ?? i}
          className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3"
        >
          <p className="text-[13.5px] font-medium text-ink-50">{c.name}</p>
          {c.role && <p className="mt-0.5 text-[11.5px] text-ink-300">{c.role}</p>}
          <div className="mt-2 flex flex-col gap-0.5 text-[12px] text-ink-200">
            {c.email && (
              <a href={`mailto:${c.email}`} className="hover:text-ink-50">
                ✉ {c.email}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="hover:text-ink-50">
                ☎ {c.phone}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ContractsTab({ contracts }: { contracts: Contract[] }) {
  if (contracts.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-8 text-center text-[12px] text-ink-300">
        Noch keine Verträge.
      </div>
    );
  }
  const sorted = contracts.slice().sort((a, b) => {
    const order = ['aktiv', 'auslaufend', 'entwurf', 'vorlage', 'storniert'];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });
  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((c) => (
        <Link
          key={c.id}
          href={`/vertraege/${c.id}`}
          className="group flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.3px]"
            style={{
              color:
                c.status === 'aktiv'
                  ? '#5ee08a'
                  : c.status === 'auslaufend'
                    ? '#ffd96a'
                    : c.status === 'storniert'
                      ? '#ff8a8a'
                      : '#9c9c9d',
            }}
          >
            {c.status}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-50">
            {c.title}
          </span>
          <span className="font-mono text-[12px] tabular-nums text-ink-200">{c.value}</span>
          {c.endsAt && (
            <span className="font-mono text-[10px] text-ink-300">
              bis {new Date(c.endsAt).toLocaleDateString('de-DE')}
            </span>
          )}
          <span className="font-mono text-[10px] text-ink-300 group-hover:text-ink-50">→</span>
        </Link>
      ))}
    </div>
  );
}

function FleetTab({
  vehicles,
  fleetInUse,
}: {
  vehicles: VehicleOpt[];
  fleetInUse: Customer['fleetInUse'];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Aktuell vermietet">
        <FleetInUseList items={fleetInUse ?? []} />
      </Section>
      <Section title="Alle vergangenen / aktuellen Fahrzeuge dieses Kunden">
        {vehicles.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-6 text-center text-[12px] text-ink-300">
            Keine historisch verknüpften Fahrzeuge.
          </div>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {vehicles.map((v) => (
              <Link
                key={v.id}
                href={`/flotte/${v.id}`}
                className="group flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
              >
                <span className="font-mono text-[12px] text-ink-300">⊞</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink-50">
                    {v.plate}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-300">{v.model}</span>
                </span>
                <span className="font-mono text-[10px] text-ink-300 group-hover:text-ink-50">→</span>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function ChannelsTab({
  channels,
  heatmap,
}: {
  channels: ChannelOpt[];
  heatmap?: number[][];
}) {
  if (channels.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-8 text-center text-[12px] text-ink-300">
        Keine Channels verknüpft.
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-1.5">
        {channels.map((c) => (
          <Link
            key={c.id}
            href={`/channels/${c.slug}`}
            className="group flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
          >
            <span className="font-mono text-[14px] text-ink-300">#</span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-50">
              {c.name}
            </span>
            <span className="font-mono text-[10px] text-ink-300 group-hover:text-ink-50">→</span>
          </Link>
        ))}
      </div>
      {heatmap && <ChannelHeatmap grid={heatmap} />}
    </div>
  );
}

function InsightsTab({
  customer,
  contracts,
}: {
  customer: Customer;
  contracts: Contract[];
}) {
  const buckets = useMemo(() => {
    const now = new Date();
    const months: { label: string; cents: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      let sum = 0;
      for (const c of contracts) {
        if (!c.startsAt || !(c.status === 'aktiv' || c.status === 'auslaufend' || c.status === 'storniert')) continue;
        const sa = new Date(c.startsAt);
        const ea = c.endsAt ? new Date(c.endsAt) : new Date(8640000000000000);
        if (sa <= next && ea >= m) {
          const cents =
            Number((c as any).valueCents) ||
            parseInt(c.value.replace(/[^0-9]/g, '') || '0') * 100;
          sum += cents;
        }
      }
      months.push({
        label: m.toLocaleString('de-DE', { month: 'short' }),
        cents: sum,
      });
    }
    return months;
  }, [contracts]);

  const max = Math.max(1, ...buckets.map((b) => b.cents));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Revenue · 12 Monate">
        <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex h-32 items-end gap-1.5">
            {buckets.map((b, i) => {
              const h = max > 0 ? (b.cents / max) * 100 : 0;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-[2px] bg-[#5eb6ff]/40"
                    style={{ height: `${Math.max(2, h)}%` }}
                    title={`${b.label}: €${(b.cents / 100).toLocaleString('de-DE')}`}
                  />
                  <span className="font-mono text-[9px] uppercase text-ink-300">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {customer.damagePattern && customer.damagePattern.totalDamages > 0 && (
        <Section title="Schadens-Muster">
          <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[13px] text-ink-100">
              {customer.damagePattern.totalDamages} dokumentierte Schäden bei diesem Kunden.
            </p>
            <p className="mt-1 text-[12px] text-ink-300">
              Flotten-Durchschnitt: {customer.damagePattern.fleetAvg.toFixed(1)} pro Kunde
            </p>
            {customer.damagePattern.deltaPercent !== 0 && (
              <p
                className="mt-2 font-mono text-[14px] tabular-nums"
                style={{
                  color:
                    customer.damagePattern.deltaPercent > 50
                      ? '#ff8a8a'
                      : customer.damagePattern.deltaPercent > 0
                        ? '#ffd96a'
                        : '#5ee08a',
                }}
              >
                {customer.damagePattern.deltaPercent > 0 ? '+' : ''}
                {customer.damagePattern.deltaPercent}% vs. Durchschnitt
              </p>
            )}
          </div>
        </Section>
      )}

      <Section title="Verteilung Vertragsstatus">
        <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
          {(['aktiv', 'auslaufend', 'entwurf', 'storniert'] as const).map((st) => {
            const n = contracts.filter((c) => c.status === st).length;
            const pct = contracts.length > 0 ? (n / contracts.length) * 100 : 0;
            return (
              <div key={st} className="flex items-center gap-3 py-1.5">
                <span className="w-20 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                  {st}
                </span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${pct}%`,
                      background:
                        st === 'aktiv'
                          ? '#5ee08a'
                          : st === 'auslaufend'
                            ? '#ffd96a'
                            : st === 'storniert'
                              ? '#ff8a8a'
                              : '#9c9c9d',
                    }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[11px] tabular-nums text-ink-200">
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
