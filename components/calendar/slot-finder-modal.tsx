'use client';

/**
 * Smart slot finder — pick a duration, optionally some people and/or a
 * vehicle, and a window; we surface conflict-free slots within working hours.
 * Generic enough for a solo user ("when am I free for 90 min this week?") and
 * for teams (overlap of several calendars). Picking a slot hands the start +
 * duration up so the create modal opens pre-filled.
 */
import { useState, useTransition } from 'react';
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
import { Avatar } from '@/components/channel/avatar';
import { findFreeSlots, type FreeSlot } from '@/lib/actions/calendar';
import type { TodoUser } from '@/lib/types';

type Vehicle = { id: string; plate: string; model: string };

export function SlotFinderModal({
  open,
  onClose,
  members = [],
  currentUserId,
  vehicles = [],
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  members?: TodoUser[];
  currentUserId?: string;
  vehicles?: Vehicle[];
  onPick: (startIso: string, durationMinutes: number) => void;
}) {
  const [pending, start] = useTransition();
  const [duration, setDuration] = useState(60);
  const [days, setDays] = useState(7);
  const [workStart, setWorkStart] = useState(8);
  const [workEnd, setWorkEnd] = useState(18);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState<string>('');
  const [slots, setSlots] = useState<FreeSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const others = members.filter((m) => m.id !== currentUserId);

  const search = () => {
    setError(null);
    setSlots(null);
    const from = new Date();
    const to = new Date(Date.now() + days * 86_400_000);
    start(async () => {
      const res = await findFreeSlots({
        durationMinutes: duration,
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
        attendeeIds,
        vehicleId: vehicleId || null,
        workStartHour: workStart,
        workEndHour: workEnd,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSlots(res.slots);
    });
  };

  const toggle = (id: string) =>
    setAttendeeIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal open={open} onClose={onClose} kicker="Freien Slot finden" title="Wann passt's?" maxWidth={560}>
      <div className="flex flex-col gap-4">
        {error && <ModalError>{error}</ModalError>}

        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Dauer (Min.)">
            <ModalInput
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
              min={15}
              step={15}
            />
          </ModalField>
          <ModalField label="Zeitraum (Tage)">
            <ModalInput
              type="number"
              value={days}
              onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 7))}
              min={1}
              max={60}
            />
          </ModalField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Arbeitszeit ab">
            <ModalInput
              type="number"
              value={workStart}
              onChange={(e) => setWorkStart(parseInt(e.target.value) || 8)}
              min={0}
              max={23}
            />
          </ModalField>
          <ModalField label="bis">
            <ModalInput
              type="number"
              value={workEnd}
              onChange={(e) => setWorkEnd(parseInt(e.target.value) || 18)}
              min={1}
              max={24}
            />
          </ModalField>
        </div>

        {others.length > 0 && (
          <ModalField label="Mit (optional)" hint="Findet Zeiten, in denen auch diese Personen frei sind.">
            <div className="flex flex-wrap gap-1.5">
              {others.map((m) => {
                const sel = attendeeIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12px] transition-colors ${
                      sel
                        ? 'bg-white/[0.08] text-ink-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]'
                        : 'bg-white/[0.02] text-ink-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <Avatar initials={m.initials} from={m.from} to={m.to} size={18} />
                    <span className="max-w-[120px] truncate">{m.name}</span>
                  </button>
                );
              })}
            </div>
          </ModalField>
        )}

        {vehicles.length > 0 && (
          <ModalField label="Fahrzeug (optional)" hint="Schließt Zeiten aus, in denen das Fahrzeug gebucht ist.">
            <ModalSelect value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">— egal —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.model}
                </option>
              ))}
            </ModalSelect>
          </ModalField>
        )}

        {slots && (
          <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-2">
            {slots.length === 0 ? (
              <p className="px-2 py-3 text-center text-[12.5px] text-ink-300">
                Kein freier Slot im Zeitraum — Zeitraum vergrößern oder Dauer reduzieren.
              </p>
            ) : (
              <ul className="flex max-h-[260px] flex-col gap-1 overflow-y-auto">
                {slots.map((sl) => {
                  const d = new Date(sl.startIso);
                  return (
                    <li key={sl.startIso}>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onPick(sl.startIso, duration);
                        }}
                        className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-[13px] transition-colors hover:bg-white/[0.05]"
                      >
                        <span className="text-ink-50">
                          {d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}
                          {' · '}
                          {d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="font-mono text-[11px] text-[#5E9EFF]">übernehmen →</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <ModalActions>
          <ModalSecondary onClick={onClose}>Schließen</ModalSecondary>
          <ModalPrimary type="button" pending={pending} onClick={search}>
            {slots ? 'Erneut suchen' : 'Slots finden'}
          </ModalPrimary>
        </ModalActions>
      </div>
    </Modal>
  );
}
