'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Modal,
  ModalActions,
  ModalError,
  ModalField,
  ModalInput,
  ModalPrimary,
  ModalSecondary,
  ModalSelect,
} from '@/components/ui/modal';
import {
  addMaintenance,
  deleteMaintenance,
  markMaintenanceDone,
} from '@/lib/actions/vehicles';
import type {
  ServiceForecast,
  VehicleMaintenanceEntry,
  VehicleMaintenanceKind,
} from '@/lib/types';

const KIND_META: Record<VehicleMaintenanceKind, { icon: string; label: string }> = {
  service: { icon: '🔧', label: 'Service' },
  inspection: { icon: '✓', label: 'TÜV/HU' },
  reifenwechsel: { icon: '◯', label: 'Reifen' },
  cleaning: { icon: '✨', label: 'Reinigung' },
  other: { icon: '·', label: 'Sonstiges' },
};

export function MaintenancePanel({
  vehicleId,
  currentKm,
  maintenance,
  serviceForecast,
}: {
  vehicleId: string;
  currentKm: number;
  maintenance: VehicleMaintenanceEntry[];
  serviceForecast?: ServiceForecast;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Wartung & Service
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-ink-200 hover:border-white/[0.18] hover:bg-white/[0.05]"
        >
          + Plan
        </button>
      </div>

      {serviceForecast && serviceForecast.status !== 'fine' && (
        <div
          className="flex items-start gap-2 rounded-[10px] border p-2.5 text-[12px]"
          style={{
            borderColor: serviceForecast.status === 'overdue' ? '#ff8a8a44' : '#ffd96a44',
            background: serviceForecast.status === 'overdue' ? '#ff8a8a0d' : '#ffd96a0a',
          }}
        >
          <span style={{ color: serviceForecast.status === 'overdue' ? '#ff8a8a' : '#ffd96a' }}>
            {serviceForecast.status === 'overdue' ? '🔴' : '⚠'}
          </span>
          <div className="flex-1">
            <p className="font-medium leading-tight text-ink-50">
              {serviceForecast.reason ?? 'Service-Prognose'}
            </p>
            {serviceForecast.kmToNext != null && (
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                {serviceForecast.kmToNext > 0
                  ? `noch ${serviceForecast.kmToNext.toLocaleString('de-DE')} km`
                  : `${Math.abs(serviceForecast.kmToNext).toLocaleString('de-DE')} km überfällig`}
              </p>
            )}
          </div>
        </div>
      )}

      {maintenance.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-white/[0.08] bg-white/[0.01] py-4 text-center text-[12px] text-ink-300">
          Noch kein Wartungs-Plan.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {maintenance.map((m) => {
            const meta = KIND_META[m.kind];
            return (
              <div
                key={m.id}
                className={`group flex items-center gap-2.5 rounded-[10px] border bg-white/[0.02] px-3 py-2 ${
                  m.overdue ? 'border-[#ff8a8a]/30' : 'border-white/[0.06]'
                }`}
              >
                <span className="text-[14px]">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink-50">{m.title}</p>
                  <p className="mt-0.5 text-[10.5px] text-ink-300">
                    {m.nextDueAt
                      ? `fällig ${new Date(m.nextDueAt).toLocaleDateString('de-DE')}`
                      : m.intervalKm
                        ? `alle ${m.intervalKm.toLocaleString('de-DE')} km`
                        : 'kein Intervall'}
                    {m.overdue && <span className="ml-2 text-[#ff8a8a]">· überfällig</span>}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await markMaintenanceDone({ maintenanceId: m.id, doneKm: currentKm });
                      router.refresh();
                    })
                  }
                  title="Als erledigt markieren"
                  className="rounded-[4px] border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11px] text-ink-200 hover:border-[#5ee08a]/30 hover:text-[#5ee08a]"
                >
                  ✓ done
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm('Plan löschen?')) return;
                    start(async () => {
                      await deleteMaintenance(m.id);
                      router.refresh();
                    });
                  }}
                  className="opacity-0 transition-opacity hover:text-[#ff8a8a] group-hover:opacity-100"
                >
                  <span className="font-mono text-[11px] text-ink-300">×</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <AddMaintenanceModal open={open} onClose={() => setOpen(false)} vehicleId={vehicleId} />
    </div>
  );
}

function AddMaintenanceModal({
  open,
  onClose,
  vehicleId,
}: {
  open: boolean;
  onClose: () => void;
  vehicleId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} kicker="Wartung" title="Wartungs-Plan hinzufügen" maxWidth={500}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          start(async () => {
            const res = await addMaintenance({
              vehicleId,
              title: String(data.get('title') ?? ''),
              kind: (String(data.get('kind') ?? 'service') as VehicleMaintenanceKind) || 'service',
              intervalKm:
                parseInt(String(data.get('intervalKm') ?? '').replace(/[^\d]/g, ''), 10) || undefined,
              intervalDays:
                parseInt(String(data.get('intervalDays') ?? '').replace(/[^\d]/g, ''), 10) ||
                undefined,
              lastDoneAt: String(data.get('lastDoneAt') ?? '') || undefined,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        <ModalField label="Was">
          <ModalInput name="title" required placeholder="Service alle 30.000 km" />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Art">
            <ModalSelect name="kind" defaultValue="service">
              <option value="service">Service</option>
              <option value="inspection">TÜV / HU</option>
              <option value="reifenwechsel">Reifenwechsel</option>
              <option value="cleaning">Reinigung</option>
              <option value="other">Sonstiges</option>
            </ModalSelect>
          </ModalField>
          <ModalField label="Letztes Mal">
            <ModalInput name="lastDoneAt" type="date" />
          </ModalField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Intervall (km)">
            <ModalInput name="intervalKm" type="number" placeholder="30000" />
          </ModalField>
          <ModalField label="Intervall (Tage)">
            <ModalInput name="intervalDays" type="number" placeholder="365" />
          </ModalField>
        </div>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Plan anlegen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
