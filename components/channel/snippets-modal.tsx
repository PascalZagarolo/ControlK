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
import {
  createChannelSnippet,
  deleteChannelSnippet,
} from '@/lib/actions/channels';
import type { ChannelSnippet } from '@/lib/types';

export function SnippetsModal({
  open,
  onClose,
  snippets,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  snippets: ChannelSnippet[];
  onPick?: (snippet: ChannelSnippet) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Snippets"
      title="Saved Replies"
      maxWidth={560}
    >
      <div className="flex flex-col gap-4">
        {snippets.length === 0 ? (
          <p className="text-[12.5px] text-ink-300">
            Noch keine Snippets. Speicher häufige Antworten als Template — `/snippet name` im Composer fügt sie ein.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {snippets.map((s) => (
              <div
                key={s.id}
                className="group flex items-start gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                    /{s.slug}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-ink-50">{s.title}</p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-[12px] leading-[1.5] text-ink-300">
                    {s.body}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {onPick && (
                    <button
                      type="button"
                      onClick={() => {
                        onPick(s);
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
                      if (!confirm(`Snippet „${s.title}" löschen?`)) return;
                      start(async () => {
                        await deleteChannelSnippet(s.id);
                        router.refresh();
                      });
                    }}
                    className="opacity-0 transition-opacity hover:text-[#ff8a8a] group-hover:opacity-100"
                  >
                    <span className="font-mono text-[11px] text-ink-300">×</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const fd = new FormData(e.currentTarget);
              start(async () => {
                const res = await createChannelSnippet({
                  title: String(fd.get('title') ?? ''),
                  body: String(fd.get('body') ?? ''),
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
              Neues Snippet
            </p>
            {error && <ModalError>{error}</ModalError>}
            <ModalField label="Titel" hint="Wird als Slash-Befehl verwendet">
              <ModalInput name="title" required placeholder="Onboarding-Welcome" />
            </ModalField>
            <ModalField label="Antwort" hint="Variable wie {kunde} werden später ersetzt">
              <ModalTextarea
                name="body"
                rows={5}
                required
                placeholder={'Hi {kunde},\n\nwillkommen bei uRent! …'}
              />
            </ModalField>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11.5px] text-ink-200"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-[6px] bg-white px-3 py-1.5 text-[11.5px] font-medium text-black disabled:opacity-30"
              >
                Anlegen
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-[10px] border border-dashed border-white/[0.12] bg-white/[0.01] py-3 text-[12.5px] text-ink-300 hover:border-white/[0.24] hover:text-ink-50"
          >
            + Snippet anlegen
          </button>
        )}

        <ModalActions>
          <ModalSecondary onClick={onClose}>Schließen</ModalSecondary>
        </ModalActions>
      </div>
    </Modal>
  );
}
