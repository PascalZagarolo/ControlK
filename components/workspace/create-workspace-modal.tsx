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
import { createWorkspace } from '@/lib/actions/workspace';
import { WORKSPACE_TEMPLATES } from '@/lib/workspace-templates';

const EMOJI_PRESETS = ['🏢', '🏡', '🚐', '🎯', '🚀', '🧠', '🎓', '✨', '◯'];

export function CreateWorkspaceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [template, setTemplate] = useState<string>('solo-freelancer');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState<string>('');

  const tpl = WORKSPACE_TEMPLATES.find((t) => t.key === template);

  const reset = () => {
    setStep(1);
    setTemplate('solo-freelancer');
    setName('');
    setDescription('');
    setEmoji('');
    setError(null);
  };

  const closeAndReset = () => {
    onClose();
    setTimeout(reset, 200);
  };

  return (
    <Modal
      open={open}
      onClose={closeAndReset}
      kicker={`Schritt ${step} / 2`}
      title={step === 1 ? 'Template wählen' : 'Workspace-Details'}
      maxWidth={640}
    >
      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-ink-300">
            Wähle ein Template — wir seeden direkt die passenden Todo-Gruppen, Channels und Calendar-Templates.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {WORKSPACE_TEMPLATES.map((t) => {
              const active = template === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTemplate(t.key)}
                  className={`flex flex-col gap-1.5 rounded-[12px] border p-3 text-left transition-colors ${
                    active
                      ? 'border-[#5eb6ff]/40 bg-[#5eb6ff]/[0.05]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[18px]"
                      style={{
                        background: `${t.fromColor}1f`,
                      }}
                    >
                      {t.icon}
                    </span>
                    <span className="text-[13px] font-medium text-ink-50">{t.name}</span>
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                    {t.tagline}
                  </p>
                  <p className="text-[11.5px] leading-[1.45] text-ink-300">{t.description}</p>
                </button>
              );
            })}
          </div>
          <ModalActions>
            <ModalSecondary onClick={closeAndReset}>Abbrechen</ModalSecondary>
            <button
              type="button"
              onClick={() => {
                setStep(2);
                if (tpl?.icon) setEmoji(tpl.icon);
              }}
              className="rounded-[8px] bg-white px-4 py-2 text-[13px] font-medium leading-none text-black hover:bg-white/90"
            >
              Weiter →
            </button>
          </ModalActions>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await createWorkspace({
                name,
                template,
                iconEmoji: emoji || tpl?.icon,
                description: description.trim() || undefined,
                fromColor: tpl?.fromColor,
                toColor: tpl?.toColor,
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              closeAndReset();
              router.push('/');
              router.refresh();
            });
          }}
          className="flex flex-col gap-4"
        >
          {error && <ModalError>{error}</ModalError>}

          {tpl && (
            <div className="flex items-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-ink-300">
              <span>{tpl.icon}</span>
              <span>
                Template: <span className="text-ink-100">{tpl.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-auto font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 hover:text-ink-50"
              >
                Ändern
              </button>
            </div>
          )}

          <ModalField label="Workspace-Name" hint="z.B. Müller-Vermietung, Familie Schmidt, MyCo">
            <ModalInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="Mein Workspace"
              maxLength={60}
            />
          </ModalField>

          <ModalField label="Beschreibung (optional)" hint="Eine Zeile, was hier passiert.">
            <ModalTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="Worum gehts in diesem Workspace?"
            />
          </ModalField>

          <ModalField label="Icon (Emoji)">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setEmoji('')}
                className={`flex h-8 w-8 items-center justify-center rounded-[8px] border text-[14px] transition-colors ${
                  emoji === ''
                    ? 'border-white/[0.20] bg-white/[0.06] text-ink-200'
                    : 'border-white/[0.06] bg-white/[0.02] text-ink-300 hover:border-white/[0.14]'
                }`}
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

          <ModalActions>
            <ModalSecondary onClick={() => setStep(1)}>← Zurück</ModalSecondary>
            <ModalPrimary pending={pending}>Workspace anlegen</ModalPrimary>
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}
