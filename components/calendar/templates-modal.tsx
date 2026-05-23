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
import { KIND_GROUPS, KIND_META } from './event-color';
import {
  createEventTemplate,
  deleteEventTemplate,
} from '@/lib/actions/calendar';
import type { CalendarEventKind, CalendarTemplate } from '@/lib/types';

export function TemplatesModal({
  open,
  onClose,
  templates,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  templates: CalendarTemplate[];
  onPick?: (template: CalendarTemplate) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Templates"
      title="Event-Vorlagen verwalten"
      maxWidth={580}
    >
      <div className="flex flex-col gap-4">
        {templates.length === 0 ? (
          <p className="text-[12.5px] text-ink-300">
            Noch keine Templates. Erstell eins für wiederkehrende Workflows wie „Standard-Übergabe" mit Checkliste.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {templates.map((t) => {
              const meta = KIND_META[t.kind];
              return (
                <div
                  key={t.id}
                  className="group flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <span
                    className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
                    style={{ background: `${meta.color}1f`, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink-50">{t.name}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
                      {t.defaultDurationMinutes} min · {t.defaultChecklist.length} Schritte
                    </p>
                  </div>
                  {onPick && (
                    <button
                      type="button"
                      onClick={() => {
                        onPick(t);
                        onClose();
                      }}
                      className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-ink-200 hover:bg-white/[0.05]"
                    >
                      Verwenden
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`Template „${t.name}" löschen?`)) return;
                      start(async () => {
                        await deleteEventTemplate(t.id);
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

        {showForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const data = new FormData(e.currentTarget);
              const checklistRaw = String(data.get('defaultChecklist') ?? '');
              const checklist = checklistRaw
                .split(/\r?\n/)
                .map((line) => line.replace(/^[-•–—\s]*/, '').trim())
                .filter(Boolean);
              start(async () => {
                const res = await createEventTemplate({
                  name: String(data.get('name') ?? ''),
                  kind: (String(data.get('kind') ?? 'handover') as CalendarEventKind) || 'handover',
                  defaultDurationMinutes:
                    parseInt(String(data.get('duration') ?? '60').replace(/[^\d]/g, ''), 10) || 60,
                  defaultChecklist: checklist,
                  description: String(data.get('description') ?? '') || undefined,
                });
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setShowForm(false);
                router.refresh();
              });
            }}
            className="flex flex-col gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              Neues Template
            </p>
            {error && <ModalError>{error}</ModalError>}
            <ModalField label="Name">
              <ModalInput name="name" required placeholder="Stand-up, Arzttermin, Übergabe-Standard …" />
            </ModalField>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Art">
                <ModalSelect name="kind" defaultValue="meeting">
                  {KIND_GROUPS.map((g) => (
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
              <ModalField label="Dauer (min)">
                <ModalInput name="duration" type="number" defaultValue="60" />
              </ModalField>
            </div>
            <ModalField label="Default-Checkliste" hint="Eine Zeile pro Schritt">
              <ModalTextarea
                name="defaultChecklist"
                rows={5}
                placeholder={'– Vorbereitung\n– Agenda durchgehen\n– Follow-up notieren'}
              />
            </ModalField>
            <ModalField label="Beschreibung (optional)">
              <ModalTextarea name="description" rows={2} />
            </ModalField>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11.5px] text-ink-200 hover:bg-white/[0.05]"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-[6px] bg-white px-3 py-1.5 text-[11.5px] font-medium text-black disabled:opacity-30"
              >
                Template anlegen
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-[10px] border border-dashed border-white/[0.12] bg-white/[0.01] px-3 py-3 text-[12.5px] text-ink-300 transition-colors hover:border-white/[0.24] hover:text-ink-50"
          >
            + Template anlegen
          </button>
        )}

        <ModalActions>
          <ModalSecondary onClick={onClose}>Schließen</ModalSecondary>
        </ModalActions>
      </div>
    </Modal>
  );
}
