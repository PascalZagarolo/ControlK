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
  ModalTextarea,
} from '@/components/ui/modal';
import { createRecurringSeries } from '@/lib/actions/calendar';
import type { CalendarEventKind } from '@/lib/types';

type Customer = { id: string; name: string };
type Vehicle = { id: string; plate: string; model: string };
type Contract = { id: string; title: string };

export function RecurringModal({
  open,
  onClose,
  customers,
  vehicles,
  contracts,
}: {
  open: boolean;
  onClose: () => void;
  customers: Customer[];
  vehicles: Vehicle[];
  contracts: Contract[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Recurring"
      title="Wiederkehrende Termine"
      maxWidth={560}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          start(async () => {
            const res = await createRecurringSeries({
              title: String(data.get('title') ?? ''),
              kind: (String(data.get('kind') ?? 'internal') as CalendarEventKind) || 'internal',
              firstStartIso: String(data.get('firstStart') ?? ''),
              durationMinutes:
                parseInt(String(data.get('durationMin') ?? '60').replace(/[^\d]/g, ''), 10) || 60,
              rule: String(data.get('rule') ?? 'weekly') as any,
              occurrences:
                parseInt(String(data.get('occurrences') ?? '10').replace(/[^\d]/g, ''), 10) || 10,
              detail: String(data.get('detail') ?? '') || undefined,
              location: String(data.get('location') ?? '') || undefined,
              linkedCustomerId: String(data.get('linkedCustomerId') ?? '') || null,
              linkedVehicleId: String(data.get('linkedVehicleId') ?? '') || null,
              linkedContractId: String(data.get('linkedContractId') ?? '') || null,
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
        <ModalField label="Titel">
          <ModalInput name="title" required placeholder="Reinigungs-Slot, Wartungs-Termin …" />
        </ModalField>

        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Art">
            <ModalSelect name="kind" defaultValue="internal">
              <option value="handover">Übergabe</option>
              <option value="return">Rückgabe</option>
              <option value="maintenance">Wartung</option>
              <option value="internal">Intern</option>
            </ModalSelect>
          </ModalField>
          <ModalField label="Dauer (Minuten)">
            <ModalInput name="durationMin" type="number" defaultValue="60" />
          </ModalField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Erster Start">
            <ModalInput name="firstStart" type="datetime-local" required />
          </ModalField>
          <ModalField label="Wiederholung">
            <ModalSelect name="rule" defaultValue="weekly">
              <option value="daily">Täglich</option>
              <option value="weekdays">Werktage (Mo–Fr)</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
            </ModalSelect>
          </ModalField>
        </div>

        <ModalField label="Anzahl Wiederholungen" hint="Maximal 200">
          <ModalInput name="occurrences" type="number" defaultValue="10" min={1} max={200} />
        </ModalField>

        <ModalField label="Notiz (optional)">
          <ModalTextarea name="detail" rows={2} placeholder="Hintergrund …" />
        </ModalField>

        <ModalField label="Ort (optional)">
          <ModalInput name="location" placeholder="Werkstatt, Garage 2…" />
        </ModalField>

        <details className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Verknüpfungen (optional)
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <ModalField label="Kunde">
              <ModalSelect name="linkedCustomerId" defaultValue="">
                <option value="">— keiner —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
            <ModalField label="Fahrzeug">
              <ModalSelect name="linkedVehicleId" defaultValue="">
                <option value="">— keines —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate} · {v.model}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
            <ModalField label="Vertrag">
              <ModalSelect name="linkedContractId" defaultValue="">
                <option value="">— keiner —</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
          </div>
        </details>

        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Serie anlegen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
