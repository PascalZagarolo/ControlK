'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateContractBody } from '@/lib/actions/contracts';
import { VoiceCaptureButton } from '@/components/todos/voice-capture-button';

type Section = { heading: string; paragraphs: string[] };

export function ContractBodyEditor({
  contractId,
  body,
  readOnly,
}: {
  contractId: string;
  body: Section[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Section[]>(body);
  const [dirty, setDirty] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const initialRef = useRef(JSON.stringify(body));

  useEffect(() => {
    setDraft(body);
    initialRef.current = JSON.stringify(body);
    setDirty(false);
  }, [body]);

  const setSection = (idx: number, patch: Partial<Section>) => {
    setDraft((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
    setDirty(true);
  };

  const addSection = () => {
    setDraft((prev) => [...prev, { heading: 'Neue Sektion', paragraphs: [''] }]);
    setDirty(true);
  };

  const removeSection = (idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const moveSection = (from: number, to: number) => {
    if (from === to || to < 0 || to >= draft.length) return;
    setDraft((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDirty(true);
  };

  const save = () => {
    start(async () => {
      const cleaned = draft.map((s) => ({
        heading: s.heading.trim(),
        paragraphs: s.paragraphs.map((p) => p.trim()).filter(Boolean),
      })).filter((s) => s.heading || s.paragraphs.length > 0);
      const res = await updateContractBody({ contractId, body: cleaned });
      if (res.ok) {
        initialRef.current = JSON.stringify(cleaned);
        setDirty(false);
        router.refresh();
      }
    });
  };

  const discard = () => {
    setDraft(JSON.parse(initialRef.current));
    setDirty(false);
  };

  if (readOnly) {
    return (
      <div className="flex flex-col gap-6">
        {body.length === 0 ? (
          <p className="text-[12.5px] text-ink-300">— Kein Vertragstext —</p>
        ) : (
          body.map((s, i) => (
            <section key={i}>
              <h3 className="mb-2 text-[15px] font-medium tracking-[-0.2px] text-ink-50">
                {s.heading}
              </h3>
              <div className="flex flex-col gap-2 text-[13.5px] leading-[1.6] text-ink-200">
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Vertrags-Text · {draft.length} Sektion{draft.length === 1 ? '' : 'en'}
        </span>
        {dirty && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={pending}
              className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[11.5px] text-ink-200 hover:bg-white/[0.05]"
            >
              Verwerfen
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-full bg-white px-3 py-1 text-[11.5px] font-medium text-black disabled:opacity-30"
            >
              {pending ? 'Speichere …' : 'Speichern + Snapshot'}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {draft.map((section, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDraggingIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingIdx != null) moveSection(draggingIdx, i);
              setDraggingIdx(null);
            }}
            onDragEnd={() => setDraggingIdx(null)}
            className={`group flex flex-col gap-2 rounded-[12px] border bg-white/[0.02] p-3 transition-all ${
              draggingIdx === i ? 'border-[#5eb6ff]/40 opacity-50' : 'border-white/[0.06]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="cursor-move font-mono text-[11px] text-ink-300 hover:text-ink-50"
                title="Drag zum Verschieben"
              >
                ⋮⋮
              </span>
              <input
                value={section.heading}
                onChange={(e) => setSection(i, { heading: e.target.value })}
                placeholder="Sektions-Überschrift"
                className="flex-1 rounded-[6px] border border-transparent bg-transparent px-2 py-1 text-[14px] font-medium text-ink-50 outline-none hover:border-white/[0.10] focus:border-white/[0.20] focus:bg-white/[0.03]"
              />
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => moveSection(i, i - 1)}
                  disabled={i === 0}
                  className="rounded-[4px] px-1.5 py-0.5 text-[11px] text-ink-300 hover:text-ink-50 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(i, i + 1)}
                  disabled={i === draft.length - 1}
                  className="rounded-[4px] px-1.5 py-0.5 text-[11px] text-ink-300 hover:text-ink-50 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm('Sektion löschen?')) return;
                    removeSection(i);
                  }}
                  className="rounded-[4px] px-1.5 py-0.5 text-[11px] text-ink-300 hover:text-[#ff8a8a]"
                >
                  ×
                </button>
              </div>
            </div>
            <textarea
              value={section.paragraphs.join('\n\n')}
              onChange={(e) =>
                setSection(i, {
                  paragraphs: e.target.value.split(/\n\n+/),
                })
              }
              placeholder="Absätze, durch Leerzeile getrennt …"
              rows={Math.max(3, section.paragraphs.reduce((acc, p) => acc + (p.split('\n').length || 1), 0))}
              className="resize-y rounded-[6px] border border-white/[0.06] bg-white/[0.01] px-3 py-2 text-[13px] leading-[1.6] text-ink-100 outline-none focus:border-white/[0.18] focus:bg-white/[0.03]"
            />
          </div>
        ))}

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={addSection}
            className="rounded-[10px] border border-dashed border-white/[0.12] bg-white/[0.01] px-4 py-2 text-[12.5px] text-ink-300 transition-colors hover:border-white/[0.24] hover:text-ink-50"
          >
            + Sektion hinzufügen
          </button>
          <VoiceCaptureButton
            onTranscript={(t) => {
              setDraft((prev) => [
                ...prev,
                { heading: 'Diktat', paragraphs: [t] },
              ]);
              setDirty(true);
            }}
          />
        </div>
      </div>
    </div>
  );
}
