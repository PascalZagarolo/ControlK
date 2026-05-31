'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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
import { createCalendarEvent } from '@/lib/actions/calendar';
import { Avatar } from '@/components/channel/avatar';
import { KIND_GROUPS, KIND_META } from './event-color';
import type { CalendarEventKind, CalendarTemplate, TodoUser } from '@/lib/types';

function defaultStart(prefilledIso?: string): string {
  if (prefilledIso) return prefilledIso.slice(0, 16);
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 30));
  d.setSeconds(0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Customer = { id: string; name: string };
type Vehicle = { id: string; plate: string; model: string };
type Contract = { id: string; title: string; customerId?: string };

const RENTAL_KINDS: CalendarEventKind[] = ['handover', 'return', 'maintenance'];

export function CreateEventModal({
  open,
  onClose,
  customers = [],
  vehicles = [],
  contracts = [],
  templates = [],
  members = [],
  currentUserId,
  rentalPack = false,
  prefilledStart,
  prefilledDurationMinutes,
  prefilledKind,
  prefilledCustomerId,
  prefilledVehicleId,
  prefilledTitle,
  prefilledLocation,
  prefilledDetail,
}: {
  open: boolean;
  onClose: () => void;
  customers?: Customer[];
  vehicles?: Vehicle[];
  contracts?: Contract[];
  templates?: CalendarTemplate[];
  members?: TodoUser[];
  currentUserId?: string;
  rentalPack?: boolean;
  prefilledStart?: string;
  prefilledDurationMinutes?: number;
  prefilledKind?: CalendarEventKind;
  prefilledCustomerId?: string;
  prefilledVehicleId?: string;
  prefilledTitle?: string;
  prefilledLocation?: string;
  prefilledDetail?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [allowConflict, setAllowConflict] = useState(false);
  const [templateId, setTemplateId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [detail, setDetail] = useState('');
  const [kind, setKind] = useState<CalendarEventKind>(prefilledKind ?? 'meeting');
  const [duration, setDuration] = useState(prefilledDurationMinutes ?? 60);
  const [checklist, setChecklist] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    currentUserId ? [currentUserId] : []
  );

  const kindGroups = rentalPack ? KIND_GROUPS : KIND_GROUPS.filter((g) => g.key !== 'rental');

  useEffect(() => {
    if (open) {
      const wanted = prefilledKind ?? 'meeting';
      setKind(!rentalPack && RENTAL_KINDS.includes(wanted) ? 'meeting' : wanted);
      setDuration(prefilledDurationMinutes ?? 60);
      setAttendeeIds(currentUserId ? [currentUserId] : []);
      setTitle(prefilledTitle ?? '');
      setLocation(prefilledLocation ?? '');
      setDetail(prefilledDetail ?? '');
    } else {
      setError(null);
      setConflict(null);
      setAllowConflict(false);
      setTemplateId('');
      setTitle('');
      setLocation('');
      setDetail('');
      setChecklist('');
    }
  }, [
    open,
    prefilledKind,
    prefilledDurationMinutes,
    currentUserId,
    prefilledTitle,
    prefilledLocation,
    prefilledDetail,
    rentalPack,
  ]);

  const toggleAttendee = (id: string) => {
    if (id === currentUserId) return; // creator is always included
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (!title) setTitle(tpl.name);
    setKind(tpl.kind);
    setDuration(tpl.defaultDurationMinutes);
    setChecklist(tpl.defaultChecklist.map((c) => c.label).join('\n'));
  };

  return (
    <Modal open={open} onClose={onClose} kicker="Neuer Termin" title="Termin anlegen" maxWidth={560}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setConflict(null);
          const data = new FormData(e.currentTarget);
          const startsAt = String(data.get('startsAt') ?? '');
          const checklistRaw = String(data.get('checklist') ?? '');
          const checklistArr = checklistRaw
            .split(/\r?\n/)
            .map((line) => line.replace(/^[-•–—\s]*/, '').trim())
            .filter(Boolean)
            .map((label) => ({ label }));
          start(async () => {
            const res = await createCalendarEvent({
              title: String(data.get('title') ?? ''),
              kind,
              startsAtIso: startsAt,
              durationMinutes: duration,
              detail: String(data.get('detail') ?? '') || undefined,
              location: String(data.get('location') ?? '') || undefined,
              linkedCustomerId: String(data.get('linkedCustomerId') ?? '') || null,
              linkedVehicleId: String(data.get('linkedVehicleId') ?? '') || null,
              linkedContractId: String(data.get('linkedContractId') ?? '') || null,
              checklist: checklistArr,
              allowConflict,
              attendeeIds,
            });
            if (!res.ok) {
              if (res.error.toLowerCase().includes('konflikt') || res.error.toLowerCase().includes('gebucht')) {
                setConflict(res.error);
              } else {
                setError(res.error);
              }
              return;
            }
            onClose();
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}

        {templates.length > 0 && (
          <ModalField label="Aus Template (optional)">
            <ModalSelect value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">— kein Template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </ModalSelect>
          </ModalField>
        )}

        <ModalField label="Titel">
          <ModalInput
            name="title"
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting, Arzttermin, Übergabe …"
          />
        </ModalField>

        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Art">
            <ModalSelect
              value={kind}
              onChange={(e) => setKind(e.target.value as CalendarEventKind)}
            >
              {kindGroups.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  {g.kinds.map((k) => (
                    <option key={k} value={k}>
                      {KIND_META[k].icon} {KIND_META[k].label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </ModalSelect>
          </ModalField>
          <ModalField label="Dauer (Min.)">
            <ModalInput
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
              min={5}
              step={5}
            />
          </ModalField>
        </div>

        <ModalField label="Startzeit">
          <ModalInput
            name="startsAt"
            type="datetime-local"
            defaultValue={defaultStart(prefilledStart)}
            required
          />
        </ModalField>

        <ModalField label="Ort (optional)">
          <ModalInput
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Adresse, Raum, Online-Link…"
          />
        </ModalField>

        {members.length > 0 && (
          <ModalField label="Teilnehmer" hint="Workspace-Mitglieder zu diesem Termin hinzufügen.">
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const selected = attendeeIds.includes(m.id);
                const isSelf = m.id === currentUserId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAttendee(m.id)}
                    disabled={isSelf}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12px] transition-colors ${
                      selected
                        ? 'bg-white/[0.08] text-ink-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]'
                        : 'bg-white/[0.02] text-ink-300 hover:bg-white/[0.05] hover:text-ink-100'
                    } ${isSelf ? 'cursor-default' : ''}`}
                    title={isSelf ? `${m.name} (du — immer dabei)` : m.name}
                  >
                    <Avatar initials={m.initials} from={m.from} to={m.to} size={20} />
                    <span className="max-w-[120px] truncate">
                      {m.name}
                      {isSelf ? ' (du)' : ''}
                    </span>
                    {selected && !isSelf && <span className="text-ink-300">×</span>}
                  </button>
                );
              })}
            </div>
          </ModalField>
        )}

        {rentalPack && (
        <details className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3" open={!!(prefilledCustomerId || prefilledVehicleId)}>
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Verknüpfungen (uRent — optional)
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <ModalField label="Kunde">
              <ModalSelect name="linkedCustomerId" defaultValue={prefilledCustomerId ?? ''}>
                <option value="">— keiner —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
            <ModalField label="Fahrzeug" hint="Bei Fahrzeug-Bindung läuft Konflikt-Check automatisch.">
              <ModalSelect name="linkedVehicleId" defaultValue={prefilledVehicleId ?? ''}>
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
        )}

        <ModalField label="Checkliste (optional)" hint="Eine Zeile pro Schritt, optional mit – am Anfang">
          <ModalTextarea
            name="checklist"
            rows={4}
            value={checklist}
            onChange={(e) => setChecklist(e.target.value)}
            placeholder={'– Vorbereitung\n– Agenda durchgehen\n– Follow-up notieren'}
          />
        </ModalField>

        <ModalField label="Notiz (optional)">
          <ModalTextarea
            name="detail"
            rows={2}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Worum geht's? Hintergrund, Links, Vorbereitung …"
          />
        </ModalField>

        {conflict && (
          <div className="rounded-[10px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#ff8a8a]">
              ⚠ Buchungs-Konflikt
            </p>
            <p className="mt-1 text-[12.5px] text-ink-100">{conflict}</p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11.5px] text-ink-200">
              <input
                type="checkbox"
                checked={allowConflict}
                onChange={(e) => setAllowConflict(e.target.checked)}
              />
              Trotzdem anlegen
            </label>
          </div>
        )}

        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Termin anlegen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
