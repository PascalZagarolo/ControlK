'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkline } from '@/components/ui/sparkline';
import { FilterPills } from '@/components/ui/filter-pills';
import { MetaDivider } from '@/components/ui/headline';
import { UtilizationHeatmap } from './utilization-heatmap';
import { VehicleHealthRing, VehicleHealthBreakdown } from './vehicle-health-ring';
import { VehicleTagPicker } from './vehicle-tag-picker';
import { VehicleOwnerPicker } from './vehicle-owner-picker';
import { VehicleInlineEdit } from './vehicle-inline-edit';
import { DamageGallery } from './damage-gallery';
import { PricingCalculator } from './pricing-calculator';
import { MaintenancePanel } from './maintenance-panel';
import { BookingStripe } from './booking-stripe';
import { ShareVehicleModal } from './share-vehicle-modal';
import { QrCodeButton } from './qr-code-button';
import { VoiceCaptureButton } from '@/components/todos/voice-capture-button';
import { CreateEventModal } from '@/components/calendar/create-event-modal';
import type { Vehicle, VehicleShareLink, VehicleTag, TodoUser } from '@/lib/types';

type CustomerOpt = { id: string; name: string };

const TABS = [
  'Übersicht',
  'Buchungen',
  'Schäden',
  'Wartung',
  'Kunden',
  'Insights',
  'Pricing',
  'Notizen',
] as const;
type Tab = (typeof TABS)[number];

const STATUS_META: Record<string, { label: string; color: string }> = {
  frei: { label: 'Frei', color: '#5ee08a' },
  vermietet: { label: 'Vermietet', color: '#5eb6ff' },
  wartung: { label: 'Wartung', color: '#ffd96a' },
  reserviert: { label: 'Reserviert', color: '#c084fc' },
};

const KIND_LABEL: Record<string, string> = {
  sprinter: 'Sprinter',
  transporter: 'Transporter',
  pkw: 'PKW',
  kuehlfahrzeug: 'Kühlfahrzeug',
};

function fmtEur(cents?: number) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export function FlotteDetailClient({
  vehicle,
  members,
  allTags,
  customers,
  shareLinks: _shareLinks,
}: {
  vehicle: Vehicle;
  members: TodoUser[];
  allTags: VehicleTag[];
  customers: CustomerOpt[];
  shareLinks: VehicleShareLink[];
}) {
  const [tab, setTab] = useState<Tab>('Übersicht');
  const [shareOpen, setShareOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);

  const status = STATUS_META[vehicle.status];
  const dbId = vehicle.dbId ?? '';
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
            href="/flotte"
            className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.4px] text-ink-300 hover:text-ink-50"
          >
            ← Alle Fahrzeuge
          </Link>

          <div className="flex flex-wrap items-start gap-5">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-[12px] text-[28px]"
              style={{ background: `${status.color}1f`, color: status.color }}
            >
              ⊞
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.3px]"
                  style={{ background: `${status.color}1f`, color: status.color }}
                >
                  <span className="inline-block h-1 w-1 rounded-full" style={{ background: status.color }} />
                  {status.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                  {KIND_LABEL[vehicle.kind] ?? vehicle.kind}
                </span>
                {dbId && (
                  <VehicleTagPicker vehicleId={dbId} current={vehicle.tags ?? []} all={allTags} />
                )}
              </div>
              <h1 className="mt-1 font-mono text-[36px] font-medium leading-[1.05] tracking-[-0.4px] text-ink-50 md:text-[44px]">
                {dbId ? (
                  <VehicleInlineEdit vehicleId={dbId} field="plate" value={vehicle.plate} />
                ) : (
                  vehicle.plate
                )}
              </h1>
              <p className="mt-1 text-[14px] text-ink-200">
                {dbId ? (
                  <VehicleInlineEdit
                    vehicleId={dbId}
                    field="model"
                    value={vehicle.model}
                    placeholder="Modell setzen"
                  />
                ) : (
                  vehicle.model
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {vehicle.health && <VehicleHealthRing health={vehicle.health} size={84} />}
              {dbId && <VehicleOwnerPicker vehicleId={dbId} current={vehicle.owner} members={members} />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-4">
            <Kpi
              label="Auslastung 90d"
              value={`${Math.round((vehicle.utilization?.pct90d ?? 0) * 100)}%`}
              color="#5eb6ff"
            />
            <Kpi label="Einnahmen 12M" value={fmtEur(vehicle.income?.totalCents)} color="#5ee08a" />
            <Kpi
              label="Marge netto"
              value={fmtEur(vehicle.income?.netMarginCents)}
              color={(vehicle.income?.netMarginCents ?? 0) >= 0 ? '#5ee08a' : '#ff8a8a'}
            />
            <Kpi label="KM-Stand" value={vehicle.km.toLocaleString('de-DE')} color="#ffd96a" />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-300">
            <span>
              Standort:{' '}
              {dbId ? (
                <VehicleInlineEdit
                  vehicleId={dbId}
                  field="location"
                  value={vehicle.location}
                  placeholder="Standort setzen"
                />
              ) : (
                vehicle.location || '—'
              )}
            </span>
            <MetaDivider />
            <span>Letzte HU: {vehicle.lastInspection || '—'}</span>
            <MetaDivider />
            <span>Nächster Service: {vehicle.nextService || '—'}</span>
            {vehicle.damagePattern && vehicle.damagePattern.totalDamages > 0 && (
              <>
                <MetaDivider />
                <span
                  style={{
                    color:
                      vehicle.damagePattern.deltaPercent > 50
                        ? '#ff8a8a'
                        : vehicle.damagePattern.deltaPercent > 0
                          ? '#ffd96a'
                          : '#5ee08a',
                  }}
                >
                  Schäden: {vehicle.damagePattern.totalDamages}
                  {vehicle.damagePattern.deltaPercent !== 0 &&
                    ` (${vehicle.damagePattern.deltaPercent > 0 ? '+' : ''}${vehicle.damagePattern.deltaPercent}% vs Avg)`}
                </span>
              </>
            )}
            {vehicle.utilization && (
              <span className="ml-auto">
                <Sparkline values={vehicle.utilization.spark} color={status.color} width={80} height={18} />
              </span>
            )}
          </div>

          {vehicle.conflicts && vehicle.conflicts.length > 0 && (
            <div className="rounded-[10px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#ff8a8a]">
                ⚠ {vehicle.conflicts.length} Buchungs-Konflikt
                {vehicle.conflicts.length === 1 ? '' : 'e'}
              </p>
              <ul className="mt-1.5 flex flex-col gap-1 text-[12px] text-ink-100">
                {vehicle.conflicts.slice(0, 3).map((c, i) => (
                  <li key={i}>
                    {new Date(c.date).toLocaleDateString('de-DE')} —{' '}
                    {c.bookingA.contractTitle ?? c.bookingA.customerName ?? '?'} überlappt mit{' '}
                    {c.bookingB.contractTitle ?? c.bookingB.customerName ?? '?'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={() => setCreateEventOpen(true)} icon="📅">
              Buchung anlegen
            </ActionButton>
            {dbId && (
              <QrCodeButton vehiclePlate={vehicle.plate} vehicleExternalId={vehicle.id} />
            )}
            <ActionButton onClick={() => setShareOpen(true)} icon="🔗">
              Public Page
            </ActionButton>
          </div>
        </header>

        <div className="flex flex-col gap-6">
          <FilterPills options={TABS} value={tab} onChange={setTab} />

          {tab === 'Übersicht' && (
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="flex flex-col gap-6">
                {vehicle.utilization && (
                  <UtilizationHeatmap
                    daily={vehicle.utilization.daily}
                    pct30d={vehicle.utilization.pct30d}
                    pct90d={vehicle.utilization.pct90d}
                  />
                )}

                <BookingStripe bookings={vehicle.bookings} />

                {vehicle.health && (
                  <Section title="Health Breakdown">
                    <VehicleHealthBreakdown health={vehicle.health} />
                  </Section>
                )}
              </div>

              <aside className="flex flex-col gap-6">
                {dbId && vehicle.pricing && (
                  <PricingCalculator vehicleId={dbId} pricing={vehicle.pricing} />
                )}

                {vehicle.frequentRenters.length > 0 && (
                  <Section title="Häufigste Mieter">
                    <div className="flex flex-col gap-1.5">
                      {vehicle.frequentRenters.map((r) => (
                        <div
                          key={r.customerName}
                          className="flex items-center justify-between gap-2 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px]"
                        >
                          <span className="truncate text-ink-100">{r.customerName}</span>
                          <span className="font-mono text-[10.5px] text-ink-300">
                            {r.bookings} Bookings
                          </span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {dbId && (
                  <MaintenancePanel
                    vehicleId={dbId}
                    currentKm={vehicle.km}
                    maintenance={vehicle.upcomingMaintenance}
                    serviceForecast={vehicle.serviceForecast}
                  />
                )}
              </aside>
            </div>
          )}

          {tab === 'Buchungen' && <BookingsTab vehicle={vehicle} />}

          {tab === 'Schäden' && dbId && (
            <DamageGallery
              vehicleId={dbId}
              damages={vehicle.damageHistory}
              customers={customers}
            />
          )}

          {tab === 'Wartung' && dbId && (
            <MaintenancePanel
              vehicleId={dbId}
              currentKm={vehicle.km}
              maintenance={vehicle.upcomingMaintenance}
              serviceForecast={vehicle.serviceForecast}
            />
          )}

          {tab === 'Kunden' && <CustomersTab renters={vehicle.frequentRenters} />}

          {tab === 'Insights' && <InsightsTab vehicle={vehicle} />}

          {tab === 'Pricing' && dbId && vehicle.pricing && (
            <div className="grid gap-6 lg:grid-cols-2">
              <PricingCalculator vehicleId={dbId} pricing={vehicle.pricing} />
              <PricingExtras vehicleId={dbId} vehicle={vehicle} />
            </div>
          )}

          {tab === 'Notizen' && dbId && (
            <VehicleNotesEditor vehicleId={dbId} notes={vehicle.notes ?? ''} />
          )}
        </div>
      </div>

      {dbId && (
        <ShareVehicleModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          vehicleId={dbId}
          vehicleLabel={`${vehicle.plate} · ${vehicle.model}`}
        />
      )}

      <CreateEventModal open={createEventOpen} onClose={() => setCreateEventOpen(false)} />
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

function BookingsTab({ vehicle }: { vehicle: Vehicle }) {
  return (
    <div className="flex flex-col gap-5">
      <BookingStripe bookings={vehicle.bookings} />
      {vehicle.utilization && (
        <UtilizationHeatmap
          daily={vehicle.utilization.daily}
          pct30d={vehicle.utilization.pct30d}
          pct90d={vehicle.utilization.pct90d}
        />
      )}
    </div>
  );
}

function CustomersTab({
  renters,
}: {
  renters: { customerId?: string; customerName: string; bookings: number }[];
}) {
  if (renters.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-8 text-center text-[12px] text-ink-300">
        Noch keine Mieter dieses Fahrzeugs.
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {renters.map((r) => (
        <Link
          key={r.customerName}
          href={r.customerId ? `/kunden/${r.customerId}` : '#'}
          className="group flex items-center justify-between gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink-50">{r.customerName}</p>
            <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
              {r.bookings} Buchungen
            </p>
          </div>
          <span className="font-mono text-[11px] text-ink-300 group-hover:text-ink-50">→</span>
        </Link>
      ))}
    </div>
  );
}

function InsightsTab({ vehicle }: { vehicle: Vehicle }) {
  const buckets = vehicle.income?.buckets ?? [];
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
                    className="w-full rounded-[2px] bg-[#5ee08a]/40"
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

      {vehicle.damagePattern && vehicle.damagePattern.totalDamages > 0 && (
        <Section title="Schadens-Muster">
          <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[13px] text-ink-100">
              {vehicle.damagePattern.totalDamages} dokumentierte Schäden ·{' '}
              {fmtEur(vehicle.damagePattern.totalCostCents)} Gesamtkosten
            </p>
            <p className="mt-1 text-[11.5px] text-ink-300">
              {vehicle.damagePattern.ratePerYear.toFixed(1)} Schäden/Jahr · Flotte ⌀{' '}
              {vehicle.damagePattern.fleetAvgRate.toFixed(1)}
            </p>
            {vehicle.damagePattern.deltaPercent !== 0 && (
              <p
                className="mt-2 font-mono text-[14px] tabular-nums"
                style={{
                  color:
                    vehicle.damagePattern.deltaPercent > 50
                      ? '#ff8a8a'
                      : vehicle.damagePattern.deltaPercent > 0
                        ? '#ffd96a'
                        : '#5ee08a',
                }}
              >
                {vehicle.damagePattern.deltaPercent > 0 ? '+' : ''}
                {vehicle.damagePattern.deltaPercent}% vs. Flotten-Schnitt
              </p>
            )}
            {vehicle.damagePattern.topOffenders.length > 0 && (
              <div className="mt-3 border-t border-white/[0.06] pt-3">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
                  Top-Verursacher
                </p>
                <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-ink-100">
                  {vehicle.damagePattern.topOffenders.map((o) => (
                    <li key={o.customerName} className="flex justify-between">
                      <span>{o.customerName}</span>
                      <span className="font-mono text-ink-300">{o.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function PricingExtras({ vehicleId, vehicle }: { vehicleId: string; vehicle: Vehicle }) {
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        Wirtschaftliche Kennzahlen
      </span>
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <PricingField
          vehicleId={vehicleId}
          field="acquisitionCents"
          label="Anschaffung (Cents)"
          value={vehicle.pricing?.acquisitionCents}
          placeholder="3500000"
        />
        <PricingField
          vehicleId={vehicleId}
          field="monthlyFixedCostsCents"
          label="Fixkosten / Monat (Cents)"
          value={vehicle.pricing?.monthlyFixedCostsCents}
          placeholder="80000"
        />
        <PricingField
          vehicleId={vehicleId}
          field="serviceIntervalKm"
          label="Service-Intervall (km)"
          placeholder="30000"
        />
        <PricingField
          vehicleId={vehicleId}
          field="serviceIntervalDays"
          label="Service-Intervall (Tage)"
          placeholder="365"
        />
      </div>
    </div>
  );
}

function PricingField({
  vehicleId,
  field,
  label,
  value,
  placeholder,
}: {
  vehicleId: string;
  field:
    | 'acquisitionCents'
    | 'monthlyFixedCostsCents'
    | 'serviceIntervalKm'
    | 'serviceIntervalDays';
  label: string;
  value?: number;
  placeholder?: string;
}) {
  return (
    <div className="rounded-[8px] bg-white/[0.02] px-2.5 py-2">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">{label}</p>
      <p className="mt-0.5 font-mono text-[14px] tabular-nums text-ink-50">
        <VehicleInlineEdit
          vehicleId={vehicleId}
          field={field}
          value={value != null ? String(value) : ''}
          placeholder={placeholder}
          inputType="number"
        />
      </p>
    </div>
  );
}

function VehicleNotesEditor({ vehicleId, notes }: { vehicleId: string; notes: string }) {
  const [draft, setDraft] = useState(notes);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Notizen
        </span>
        <VoiceCaptureButton onTranscript={(t) => setDraft((prev) => (prev ? prev + '\n' : '') + t)} />
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          if (draft.trim() === notes.trim()) return;
          const { updateVehicleField } = await import('@/lib/actions/vehicles');
          await updateVehicleField({ vehicleId, field: 'notes', value: draft });
          if (typeof window !== 'undefined') location.reload();
        }}
        rows={8}
        placeholder="Notizen — Pricing, Besonderheiten, Vermerke…"
        className="resize-y rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[13px] leading-[1.55] text-ink-50 outline-none focus:border-white/[0.18]"
      />
      <p className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
        Auto-Save beim Blur
      </p>
    </div>
  );
}
