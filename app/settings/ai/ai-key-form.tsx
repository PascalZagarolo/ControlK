'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { clearOpenAIKey, setOpenAIKey } from '@/lib/actions/user-settings';

export function AIKeyForm({
  hasKey,
  preferredModel,
  canSave,
}: {
  hasKey: boolean;
  preferredModel: string | null;
  canSave: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [key, setKey] = useState('');
  const [model, setModel] = useState(preferredModel ?? 'gpt-4o-mini');
  const [feedback, setFeedback] = useState<
    { kind: 'ok' | 'err'; message: string } | null
  >(null);

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-5">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        {hasKey ? 'Key ersetzen' : 'Key hinterlegen'}
      </span>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFeedback(null);
          start(async () => {
            const res = await setOpenAIKey(key, model);
            if (res.ok) {
              setFeedback({ kind: 'ok', message: 'Key gespeichert + gegen OpenAI getestet.' });
              setKey('');
              router.refresh();
            } else {
              setFeedback({ kind: 'err', message: res.error });
            }
          });
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            OpenAI API-Key
          </span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={hasKey ? '(belegt — Eingabe ersetzt)' : 'sk-…'}
            autoComplete="off"
            spellCheck={false}
            disabled={!canSave || pending}
            required
            className="rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[12.5px] text-ink-50 outline-none placeholder:text-ink-300 focus:border-white/[0.18] focus:bg-white/[0.04] disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            Bevorzugtes Modell
          </span>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            spellCheck={false}
            disabled={!canSave || pending}
            className="rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-[12.5px] text-ink-50 outline-none placeholder:text-ink-300 focus:border-white/[0.18] focus:bg-white/[0.04] disabled:opacity-50"
          />
        </label>

        {feedback && (
          <p
            className={`rounded-[8px] border px-3 py-2 text-[12px] ${
              feedback.kind === 'ok'
                ? 'border-[#5ee08a]/30 bg-[#5ee08a]/[0.06] text-[#5ee08a]'
                : 'border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.06] text-[#ff8a8a]'
            }`}
          >
            {feedback.message}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!canSave || pending || key.length === 0}
            className="rounded-full bg-white px-4 py-2 text-[12.5px] font-medium leading-none text-black hover:bg-white/90 disabled:opacity-50"
          >
            {pending ? 'Prüfe + speichere …' : hasKey ? 'Key ersetzen' : 'Key speichern'}
          </button>
          {hasKey && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm('Gespeicherten OpenAI-Key löschen?')) return;
                start(async () => {
                  await clearOpenAIKey();
                  setFeedback({ kind: 'ok', message: 'Key gelöscht.' });
                  router.refresh();
                });
              }}
              className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11.5px] text-ink-300 hover:bg-[#ff8a8a]/[0.10] hover:text-[#ff8a8a] disabled:opacity-50"
            >
              Löschen
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
