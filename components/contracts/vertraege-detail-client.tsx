'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/channel/avatar';
import { FilterPills } from '@/components/ui/filter-pills';
import { MetaDivider } from '@/components/ui/headline';
import { StatusPill, STATUS_META } from './status-pill';
import { ContractInlineEdit } from './contract-inline-edit';
import { ContractBodyEditor } from './contract-body-editor';
import { MarginCalculator } from './margin-calculator';
import { ContractVersions } from './contract-versions';
import { ContractShareModal } from './contract-share-modal';
import { RenewContractModal } from './renew-contract-modal';
import { ContractQuoteButton } from './contract-quote-button';
import { deleteContract, setContractOwner, setContractVehicle } from '@/lib/actions/contracts';
import type {
  Contract,
  ContractShareLinkRecord,
  ContractStatus,
  TodoUser,
} from '@/lib/types';

const TABS = ['Vertragstext', 'Kennzahlen', 'Versionen', 'Unterschriften', 'Notizen'] as const;
type Tab = (typeof TABS)[number];

type Channel = { id: string; slug: string; name: string };
type Vehicle = { id: string; externalId?: string; plate: string; model: string };

function fmtEur(cents?: number) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function VertraegeDetailClient({
  contract,
  members,
  vehicles,
  channels,
  shareLinks,
}: {
  contract: Contract;
  members: TodoUser[];
  vehicles: Vehicle[];
  channels: Channel[];
  shareLinks: ContractShareLinkRecord[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Vertragstext');
  const [shareOpen, setShareOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);

  const status = STATUS_META[contract.status];
  const dbId = contract.dbId ?? '';
  const tint = `linear-gradient(140deg, ${status.color}22 0%, ${status.color}08 50%, transparent 100%)`;

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
            href="/vertraege"
            className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.4px] text-ink-300 hover:text-ink-50"
          >
            ← Alle Verträge
          </Link>

          <div className="flex flex-wrap items-start gap-5">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-[12px] text-[28px]"
              style={{ background: `${status.color}1f`, color: status.color }}
            >
              §
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={contract.status} />
                {contract.renewalOfTitle && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                    · Verlängerung von „{contract.renewalOfTitle}"
                  </span>
                )}
                {contract.acceptedAt && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[#5ee08a]/[0.15] px-2 font-mono text-[10px] uppercase tracking-[0.3px] text-[#5ee08a]">
                    ✓ Unterschrieben
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-[34px] font-medium leading-[1.05] tracking-[-0.4px] text-ink-50 md:text-[40px]">
                {dbId ? (
                  <ContractInlineEdit contractId={dbId} field="title" value={contract.title} />
                ) : (
                  contract.title
                )}
              </h1>
              {contract.customerName && (
                <p className="mt-1 text-[13px] text-ink-300">
                  <Link
                    href={`/kunden/${contract.customerId}`}
                    className="hover:text-ink-50 hover:underline"
                  >
                    ◉ {contract.customerName}
                  </Link>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {dbId && (
                <OwnerPicker contractId={dbId} current={contract.owner} members={members} />
              )}
              {dbId && (
                <VehiclePicker contractId={dbId} current={contract} vehicles={vehicles} />
              )}
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-2 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-4">
            <Kpi label="Wert" value={contract.value} color={status.color} />
            <Kpi
              label="Netto-Marge"
              value={fmtEur(contract.margin?.netCents)}
              color={
                (contract.margin?.netCents ?? 0) > 0
                  ? '#5ee08a'
                  : (contract.margin?.netCents ?? 0) < 0
                    ? '#ff8a8a'
                    : '#9c9c9d'
              }
            />
            <Kpi
              label="Restlaufzeit"
              value={
                contract.daysToEnd != null && contract.daysToEnd >= 0
                  ? `${contract.daysToEnd}d`
                  : contract.daysToEnd != null && contract.daysToEnd < 0
                    ? `${Math.abs(contract.daysToEnd)}d über`
                    : '—'
              }
              color={
                contract.daysToEnd != null && contract.daysToEnd <= 14 && contract.daysToEnd >= 0
                  ? '#ffd96a'
                  : '#5eb6ff'
              }
            />
            <Kpi
              label="Laufzeit"
              value={contract.daysActive != null ? `${contract.daysActive}d` : '—'}
              color="#c084fc"
            />
          </div>

          {/* Sub-info */}
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-300">
            {contract.startsAt && (
              <span>
                Start:{' '}
                {dbId ? (
                  <ContractInlineEdit
                    contractId={dbId}
                    field="startsAt"
                    value={contract.startsAt.slice(0, 10)}
                    inputType="date"
                  />
                ) : (
                  new Date(contract.startsAt).toLocaleDateString('de-DE')
                )}
              </span>
            )}
            <MetaDivider />
            {contract.endsAt && (
              <>
                <span>
                  Ende:{' '}
                  {dbId ? (
                    <ContractInlineEdit
                      contractId={dbId}
                      field="endsAt"
                      value={contract.endsAt.slice(0, 10)}
                      inputType="date"
                    />
                  ) : (
                    new Date(contract.endsAt).toLocaleDateString('de-DE')
                  )}
                </span>
                <MetaDivider />
              </>
            )}
            <span>Erstellt: {new Date(contract.createdAt).toLocaleDateString('de-DE')}</span>
            <MetaDivider />
            <span>von {contract.createdBy}</span>
          </div>

          {/* Renewal nudge */}
          {contract.daysToEnd != null &&
            contract.daysToEnd >= 0 &&
            contract.daysToEnd <= 30 &&
            (contract.status === 'aktiv' || contract.status === 'auslaufend') && (
              <div className="flex items-center gap-3 rounded-[10px] border border-[#ffd96a]/30 bg-[#ffd96a]/[0.06] px-3 py-2.5">
                <span className="text-[14px] text-[#ffd96a]">⚠</span>
                <div className="flex-1 text-[12.5px] text-ink-100">
                  Vertrag läuft in {contract.daysToEnd}d aus
                </div>
                <button
                  type="button"
                  onClick={() => setRenewOpen(true)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11.5px] text-ink-100 hover:bg-white/[0.10]"
                >
                  Jetzt verlängern
                </button>
              </div>
            )}

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            {dbId && (contract.status === 'aktiv' || contract.status === 'auslaufend') && (
              <ActionButton onClick={() => setRenewOpen(true)} icon="↻">
                Verlängern
              </ActionButton>
            )}
            {dbId && (
              <ContractQuoteButton contractId={dbId} channels={channels} />
            )}
            <ActionButton onClick={() => setShareOpen(true)} icon="🔗">
              Teilen
            </ActionButton>
            <ActionButton
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              icon="🖨"
            >
              Drucken
            </ActionButton>
            {dbId && (
              <button
                type="button"
                onClick={() => {
                  if (!confirm('Vertrag löschen?')) return;
                  router.push('/vertraege');
                  void deleteContract(dbId).then(() => router.refresh());
                }}
                className="ml-auto rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] text-ink-300 transition-colors hover:border-[#ff8a8a]/30 hover:bg-[#ff8a8a]/10 hover:text-[#ff8a8a]"
              >
                Löschen
              </button>
            )}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
            <FilterPills options={TABS} value={tab} onChange={setTab} />

            {tab === 'Vertragstext' && dbId && (
              <ContractBodyEditor contractId={dbId} body={contract.body} />
            )}

            {tab === 'Kennzahlen' && dbId && <MarginCalculator contract={contract} />}

            {tab === 'Versionen' && (
              <ContractVersions
                revisions={contract.revisions ?? []}
                currentBody={contract.body}
                currentTitle={contract.title}
              />
            )}

            {tab === 'Unterschriften' && (
              <SignaturesPanel signatures={contract.signatures ?? []} contract={contract} />
            )}

            {tab === 'Notizen' && dbId && (
              <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
                <ContractInlineEdit
                  contractId={dbId}
                  field="notes"
                  value={contract.notes ?? ''}
                  multiline
                  placeholder="Interne Notizen zum Vertrag — nicht im Public-Share sichtbar."
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6">
            <Section title="Verknüpfungen">
              <div className="flex flex-col gap-1.5">
                {contract.customerName && contract.customerId && (
                  <LinkRow
                    href={`/kunden/${contract.customerId}`}
                    icon="◉"
                    label="Kunde"
                    value={contract.customerName}
                  />
                )}
                {contract.vehiclePlate && contract.vehicleExternalId && (
                  <LinkRow
                    href={`/flotte/${contract.vehicleExternalId}`}
                    icon="⊞"
                    label="Fahrzeug"
                    value={`${contract.vehiclePlate}${contract.vehicleModel ? ' · ' + contract.vehicleModel : ''}`}
                  />
                )}
              </div>
            </Section>

            {dbId && <MarginCalculator contract={contract} />}

            <Section title="Versionen">
              <ContractVersions
                revisions={(contract.revisions ?? []).slice(0, 3)}
                currentBody={contract.body}
                currentTitle={contract.title}
              />
            </Section>
          </aside>
        </div>
      </div>

      {dbId && (
        <>
          <ContractShareModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            contractId={dbId}
            contractTitle={contract.title}
            existingLinks={shareLinks}
          />
          <RenewContractModal
            open={renewOpen}
            onClose={() => setRenewOpen(false)}
            contractId={dbId}
            contractTitle={contract.title}
            originalEndIso={contract.endsAt}
          />
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] bg-white/[0.02] px-3 py-2.5">
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
      className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 text-[12px] text-ink-200 hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-ink-50"
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

function LinkRow({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-white/[0.04] font-mono text-[12px] text-ink-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          {label}
        </span>
        <span className="block truncate text-[13px] text-ink-50">{value}</span>
      </span>
      <span className="font-mono text-[11px] text-ink-300 group-hover:text-ink-50">→</span>
    </Link>
  );
}

function SignaturesPanel({
  signatures,
  contract,
}: {
  signatures: NonNullable<Contract['signatures']>;
  contract: Contract;
}) {
  return (
    <div className="flex flex-col gap-4">
      {contract.acceptedAt ? (
        <div className="rounded-[12px] border border-[#5ee08a]/25 bg-[#5ee08a]/[0.05] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#5ee08a]">
            ✓ Vertrag akzeptiert
          </p>
          <p className="mt-1 text-[14px] font-medium text-ink-50">
            {contract.acceptedByName ?? 'Unbekannt'}
          </p>
          {contract.acceptedByEmail && (
            <p className="text-[11.5px] text-ink-300">{contract.acceptedByEmail}</p>
          )}
          <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
            {new Date(contract.acceptedAt).toLocaleString('de-DE')}
          </p>
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-6 text-center text-[12px] text-ink-300">
          Noch keine Unterschrift. Teilen-Link mit „Unterschrift erlauben" senden.
        </div>
      )}

      {signatures.length > 0 && (
        <div>
          <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Signatur-History · {signatures.length}
          </h4>
          <div className="flex flex-col gap-1.5">
            {signatures.map((sig) => (
              <div
                key={sig.id}
                className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2"
              >
                <p className="text-[12.5px] text-ink-50">{sig.signerName}</p>
                {sig.signerEmail && (
                  <p className="mt-0.5 text-[11px] text-ink-300">{sig.signerEmail}</p>
                )}
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                  {new Date(sig.signedAt).toLocaleString('de-DE')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OwnerPicker({
  contractId,
  current,
  members,
}: {
  contractId: string;
  current?: TodoUser;
  members: TodoUser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11.5px] text-ink-200 hover:border-white/[0.14] hover:bg-white/[0.04]"
      >
        {current ? (
          <>
            <Avatar initials={current.initials} from={current.from} to={current.to} size={18} />
            <span>{current.name}</span>
          </>
        ) : (
          <span className="text-ink-300">Owner</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-[220px] rounded-[10px] border border-white/[0.08] bg-[#16181d] p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void setContractOwner({ contractId, ownerId: null }).then(() => router.refresh());
              }}
              className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink-300 hover:bg-white/[0.04]"
            >
              ∅ Niemand
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  void setContractOwner({ contractId, ownerId: m.id }).then(() => router.refresh());
                }}
                className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] hover:bg-white/[0.04] ${
                  current?.id === m.id ? 'bg-white/[0.04] text-ink-50' : 'text-ink-100'
                }`}
              >
                <Avatar initials={m.initials} from={m.from} to={m.to} size={20} />
                <span className="flex-1 truncate">{m.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function VehiclePicker({
  contractId,
  current,
  vehicles,
}: {
  contractId: string;
  current: Contract;
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11.5px] text-ink-200 hover:border-white/[0.14] hover:bg-white/[0.04]"
      >
        <span className="font-mono text-[12px] text-ink-300">⊞</span>
        {current.vehiclePlate ? (
          <span className="font-mono">{current.vehiclePlate}</span>
        ) : (
          <span className="text-ink-300">Fahrzeug</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 max-h-[280px] w-[240px] overflow-y-auto rounded-[10px] border border-white/[0.08] bg-[#16181d] p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void setContractVehicle({ contractId, vehicleId: null }).then(() => router.refresh());
              }}
              className="flex w-full rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink-300 hover:bg-white/[0.04]"
            >
              ∅ Keines
            </button>
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  void setContractVehicle({ contractId, vehicleId: v.id }).then(() =>
                    router.refresh()
                  );
                }}
                className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] hover:bg-white/[0.04] ${
                  current.vehicleId === v.id ? 'bg-white/[0.04] text-ink-50' : 'text-ink-100'
                }`}
              >
                <span className="font-mono text-[11.5px]">{v.plate}</span>
                <span className="text-[10.5px] text-ink-300">· {v.model}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
