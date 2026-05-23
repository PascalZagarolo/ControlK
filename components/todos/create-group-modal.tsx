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
import { createTodoGroup } from '@/lib/actions/todo-groups';
import type { TodoUser } from '@/lib/types';

const EMOJI_PRESETS = ['📋', '🚀', '🎯', '💼', '🏠', '⚙️', '✏️', '📦', '🛠️', '💡', '🎨', '🔧'];
const COLOR_PRESETS = [
  { key: 'blue', hex: '#5eb6ff' },
  { key: 'green', hex: '#5ee08a' },
  { key: 'yellow', hex: '#ffd96a' },
  { key: 'red', hex: '#ff8a8a' },
  { key: 'purple', hex: '#c084fc' },
  { key: 'pink', hex: '#f472b6' },
  { key: 'orange', hex: '#ffb45e' },
  { key: 'neutral', hex: '#9c9c9d' },
];

export function CreateGroupModal({
  open,
  onClose,
  members,
}: {
  open: boolean;
  onClose: () => void;
  members?: TodoUser[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState<string>('');
  const [color, setColor] = useState<string>('');

  return (
    <Modal open={open} onClose={onClose} kicker="Neue Gruppe" title="Todo-Gruppe anlegen" maxWidth={560}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          data.set('name', name);
          data.set('description', description);
          if (emoji) data.set('emoji', emoji);
          if (color) data.set('color', color);
          start(async () => {
            const res = await createTodoGroup(data);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            setName('');
            setDescription('');
            setEmoji('');
            setColor('');
            router.push(`/todos/${res.slug}`);
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}

        <ModalField label="Name" hint="z.B. uRent, Zuhause, Marketing Q3">
          <ModalInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="Gruppen-Name"
            maxLength={60}
          />
        </ModalField>

        <ModalField label="Beschreibung (optional)" hint="Eine Zeile, was hier reingehört.">
          <ModalTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="z.B. Alles rund um den uRent-Job"
            maxLength={280}
          />
        </ModalField>

        <ModalField label="Emoji">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setEmoji('')}
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] border text-[14px] transition-colors ${
                emoji === ''
                  ? 'border-white/[0.20] bg-white/[0.06] text-ink-200'
                  : 'border-white/[0.06] bg-white/[0.02] text-ink-300 hover:border-white/[0.14]'
              }`}
              aria-label="Kein Emoji"
            >
              ∅
            </button>
            {EMOJI_PRESETS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`flex h-8 w-8 items-center justify-center rounded-[8px] border text-[16px] transition-colors ${
                  emoji === e
                    ? 'border-white/[0.20] bg-white/[0.06]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </ModalField>

        <ModalField label="Farbe">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setColor('')}
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                color === '' ? 'border-white/40' : 'border-white/[0.06] hover:border-white/[0.18]'
              }`}
              aria-label="Keine Farbe"
            >
              <span className="block h-4 w-4 rounded-full bg-white/[0.10]" />
            </button>
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setColor(c.hex)}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                  color === c.hex ? 'border-white/60' : 'border-white/[0.06] hover:border-white/[0.18]'
                }`}
                aria-label={c.key}
              >
                <span className="block h-4 w-4 rounded-full" style={{ background: c.hex }} />
              </button>
            ))}
          </div>
        </ModalField>

        <details className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Defaults für neue Todos in dieser Gruppe
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <ModalField
              label="Standard-Assignee"
              hint="Wird automatisch gesetzt, wenn du in dieser Gruppe ein Todo anlegst."
            >
              <ModalSelect name="defaultAssigneeId" defaultValue="">
                <option value="">— Keiner —</option>
                {(members ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Standard-Priorität">
                <ModalSelect name="defaultPriority" defaultValue="">
                  <option value="">— Mittel —</option>
                  <option value="niedrig">Niedrig</option>
                  <option value="mittel">Mittel</option>
                  <option value="hoch">Hoch</option>
                  <option value="urgent">Urgent</option>
                </ModalSelect>
              </ModalField>
              <ModalField label="Standard-Sichtbarkeit">
                <ModalSelect name="defaultVisibility" defaultValue="">
                  <option value="">— Team —</option>
                  <option value="private">🔒 Privat</option>
                  <option value="team">👥 Team</option>
                  <option value="account">🎯 Account</option>
                </ModalSelect>
              </ModalField>
            </div>
          </div>
        </details>

        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Gruppe anlegen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
