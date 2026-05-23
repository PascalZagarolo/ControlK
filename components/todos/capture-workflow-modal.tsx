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
  ModalTextarea,
} from '@/components/ui/modal';
import { captureWorkflowFromTodos } from '@/lib/actions/workflows';
import type { Todo } from '@/lib/types';

const EMOJI_PRESETS = ['📋', '🚀', '🔁', '📦', '🛠️', '🤝', '📞', '✏️'];

export function CaptureWorkflowModal({
  open,
  onClose,
  candidates,
}: {
  open: boolean;
  onClose: () => void;
  candidates: Todo[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.slice(0, Math.min(candidates.length, 6)).map((c) => c.id))
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Workflow aufnehmen"
      title="Aus diesen Todos ein wiederverwendbares Template machen"
      maxWidth={620}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!name.trim()) {
            setError('Name erforderlich.');
            return;
          }
          if (selected.size === 0) {
            setError('Mindestens ein Todo auswählen.');
            return;
          }
          start(async () => {
            const res = await captureWorkflowFromTodos({
              todoIds: Array.from(selected),
              name: name.trim(),
              emoji: emoji || undefined,
              description: description.trim() || undefined,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            setName('');
            setEmoji('');
            setDescription('');
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <ModalField label="Workflow-Name" hint="z.B. Neukunde Onboarding, Übergabe-Routine">
            <ModalInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="Onboarding"
              maxLength={60}
            />
          </ModalField>
          <ModalField label="Emoji">
            <div className="flex flex-wrap gap-1">
              {['', ...EMOJI_PRESETS].map((e) => (
                <button
                  key={e || 'none'}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`flex h-7 w-7 items-center justify-center rounded-[6px] border text-[14px] transition-colors ${
                    emoji === e
                      ? 'border-white/[0.20] bg-white/[0.06]'
                      : 'border-white/[0.06] hover:border-white/[0.14]'
                  }`}
                >
                  {e || '∅'}
                </button>
              ))}
            </div>
          </ModalField>
        </div>

        <ModalField label="Beschreibung (optional)">
          <ModalTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Wann wird das ausgeführt?"
            maxLength={280}
          />
        </ModalField>

        <div className="flex flex-col gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Welche Todos werden zum Template? · {selected.size} / {candidates.length}
          </p>
          <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto rounded-[10px] border border-white/[0.06] bg-white/[0.01] p-1.5">
            {candidates.map((t) => {
              const checked = selected.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={`flex items-start gap-2.5 rounded-[6px] px-2 py-1.5 text-left transition-colors ${
                    checked ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border ${
                      checked ? 'border-[#5eb6ff] bg-[#5eb6ff]/15' : 'border-white/[0.18]'
                    }`}
                  >
                    {checked && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#5eb6ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-ink-50">{t.title}</span>
                    {(t.links.customer || t.links.contract || t.links.vehicle) && (
                      <span className="mt-0.5 block text-[10.5px] text-ink-300">
                        {[
                          t.links.customer?.name && `→ {kunde}=${t.links.customer.name}`,
                          t.links.contract?.title && `→ {vertrag}=${t.links.contract.title}`,
                          t.links.vehicle?.plate && `→ {fahrzeug}=${t.links.vehicle.plate}`,
                        ]
                          .filter(Boolean)
                          .join('  ')}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] leading-[1.45] text-ink-300">
            Kunden, Verträge und Fahrzeuge in den Titles werden automatisch durch Platzhalter wie{' '}
            <code className="rounded bg-white/[0.06] px-1 text-ink-200">{'{kunde}'}</code>{' '}
            ersetzt. Beim Replay füllst du die Werte ein und alle Schritte werden gleichzeitig erstellt.
          </p>
        </div>

        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Workflow speichern</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
