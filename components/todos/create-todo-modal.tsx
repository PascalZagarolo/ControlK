'use client';

import { useRef, useState, useTransition } from 'react';
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
import { createTodoFromForm } from '@/lib/actions/todos';
import { VoiceCaptureButton } from './voice-capture-button';
import type { TodoGroup, TodoUser } from '@/lib/types';

type Customer = { slug: string; name: string; dbId: string };
type Contract = { externalId: string; title: string; dbId: string };
type Vehicle = { externalId: string; label: string; dbId: string };
type Channel = { slug: string; name: string; dbId: string };

export function CreateTodoModal({
  open,
  onClose,
  members,
  customers,
  contracts,
  vehicles,
  channels,
  groups,
  defaults,
  defaultGroupId,
}: {
  open: boolean;
  onClose: () => void;
  members: TodoUser[];
  customers: Customer[];
  contracts: Contract[];
  vehicles: Vehicle[];
  channels: Channel[];
  groups?: TodoGroup[];
  defaults?: {
    customerId?: string;
    contractId?: string;
    vehicleId?: string;
    channelId?: string;
  };
  defaultGroupId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState('none');

  return (
    <Modal open={open} onClose={onClose} kicker="Neues Todo" title="Todo erstellen" maxWidth={620}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          // Combine date + optional time. Without time → default to 09:00 local.
          if (dueDate) {
            const time = dueTime || '09:00';
            data.set('dueAt', `${dueDate}T${time}`);
          } else {
            data.set('dueAt', '');
          }
          start(async () => {
            const res = await createTodoFromForm(data);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            setDueDate('');
            setDueTime('');
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}

        <ModalField label="Titel" hint="Du kannst auch dem Mikro diktieren — funktioniert in Chrome/Edge.">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <ModalInput
                name="title"
                ref={titleRef}
                required
                autoFocus
                placeholder="Was ist zu tun?"
              />
            </div>
            <VoiceCaptureButton
              onTranscript={(text) => {
                if (titleRef.current) {
                  const next = (titleRef.current.value ? titleRef.current.value + ' ' : '') + text;
                  titleRef.current.value = next.trim();
                  titleRef.current.focus();
                }
              }}
            />
          </div>
        </ModalField>

        <ModalField label="Beschreibung (optional)">
          <ModalTextarea name="description" rows={2} placeholder="Kontext, Hintergrund …" />
        </ModalField>

        <div className="grid grid-cols-2 gap-3">
          <ModalField
            label="Fällig (optional)"
            hint={dueDate ? 'Uhrzeit optional — leer = 09:00' : 'Datum + Uhrzeit beide optional'}
          >
            <div className="flex items-center gap-2">
              <ModalInput
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1"
              />
              <ModalInput
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate}
                aria-label="Uhrzeit"
                style={{ maxWidth: 120 }}
              />
              {(dueDate || dueTime) && (
                <button
                  type="button"
                  onClick={() => {
                    setDueDate('');
                    setDueTime('');
                  }}
                  title="Löschen"
                  className="text-[11px] text-ink-300 hover:text-ink-50"
                >
                  ×
                </button>
              )}
            </div>
          </ModalField>
          <ModalField label="Priorität">
            <ModalSelect name="priority" defaultValue="mittel">
              <option value="niedrig">Niedrig</option>
              <option value="mittel">Mittel</option>
              <option value="hoch">Hoch</option>
              <option value="urgent">Urgent</option>
            </ModalSelect>
          </ModalField>
        </div>

        {dueDate && (
          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Wiederholen" hint="Erzeugt mehrere Todos mit verschobenem Fälligkeitsdatum.">
              <ModalSelect
                name="recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
              >
                <option value="none">Einmalig</option>
                <option value="daily">Täglich</option>
                <option value="weekly">Wöchentlich</option>
                <option value="monthly">Monatlich</option>
              </ModalSelect>
            </ModalField>
            {recurrence !== 'none' && (
              <ModalField label="Anzahl" hint="Wie viele Vorkommen (max. 60).">
                <ModalInput name="recurrenceCount" type="number" defaultValue={4} min={2} max={60} />
              </ModalField>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Zugewiesen an">
            <ModalSelect name="assigneeId" defaultValue="">
              <option value="">— Niemand —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </ModalSelect>
          </ModalField>
          <ModalField label="Gruppe">
            <ModalSelect name="groupId" defaultValue={defaultGroupId ?? ''}>
              <option value="">— Ohne Gruppe —</option>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji ? `${g.emoji} ` : ''}
                  {g.name}
                </option>
              ))}
            </ModalSelect>
          </ModalField>
        </div>

        <ModalField label="Sichtbarkeit">
          <ModalSelect name="visibility" defaultValue="team">
            <option value="private">🔒 Privat (nur ich)</option>
            <option value="team">👥 Team</option>
            <option value="account">🎯 Account</option>
          </ModalSelect>
        </ModalField>

        <details className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Verknüpfungen
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <ModalField label="Kunde">
              <ModalSelect name="customerId" defaultValue={defaults?.customerId ?? ''}>
                <option value="">— Kein Kunde —</option>
                {customers.map((c) => (
                  <option key={c.dbId} value={c.dbId}>
                    {c.name}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
            <ModalField label="Vertrag">
              <ModalSelect name="contractId" defaultValue={defaults?.contractId ?? ''}>
                <option value="">— Kein Vertrag —</option>
                {contracts.map((c) => (
                  <option key={c.dbId} value={c.dbId}>
                    {c.title}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
            <ModalField label="Fahrzeug">
              <ModalSelect name="vehicleId" defaultValue={defaults?.vehicleId ?? ''}>
                <option value="">— Kein Fahrzeug —</option>
                {vehicles.map((v) => (
                  <option key={v.dbId} value={v.dbId}>
                    {v.label}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
            <ModalField label="Channel">
              <ModalSelect name="channelId" defaultValue={defaults?.channelId ?? ''}>
                <option value="">— Kein Channel —</option>
                {channels.map((c) => (
                  <option key={c.dbId} value={c.dbId}>
                    #{c.name}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
          </div>
        </details>

        <ModalField label="Sub-Tasks (optional)" hint="Eine pro Zeile, optional mit – am Anfang">
          <ModalTextarea name="subtasks" rows={3} placeholder={'– Erste Aufgabe\n– Zweite Aufgabe'} />
        </ModalField>

        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Todo erstellen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
