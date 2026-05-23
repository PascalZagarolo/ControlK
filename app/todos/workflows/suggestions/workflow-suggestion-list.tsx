'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkflow } from '@/lib/actions/workflows';
import type { WorkflowSuggestion } from '@/lib/db/queries/workflow-detection';

export function WorkflowSuggestionList({
  suggestions,
}: {
  suggestions: WorkflowSuggestion[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [created, setCreated] = useState<Record<string, string>>({}); // key → slug

  return (
    <div className="flex flex-col gap-3">
      {suggestions
        .filter((s) => !dismissed[s.key])
        .map((s) => (
          <div
            key={s.key}
            className="flex flex-col gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#5eb6ff]/[0.12] text-[18px]">
                ↺
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium leading-tight text-ink-50">
                  {s.name}
                </p>
                <p className="mt-1 text-[12px] leading-[1.5] text-ink-300">
                  {s.occurrences}× erkannt · {s.steps.length} Schritte
                </p>
              </div>
              {created[s.key] ? (
                <span className="rounded-full bg-[#5ee08a]/[0.12] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-[#5ee08a]">
                  ✓ Gespeichert
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDismissed((d) => ({ ...d, [s.key]: true }))}
                    className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-100"
                  >
                    Ignorieren
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      start(async () => {
                        const res = await createWorkflow({
                          name: s.name.replace(/^Workflow:\s*/, '').replace(/…$/, ''),
                          description: `Auto-detected aus ${s.occurrences} Wiederholungen.`,
                          steps: s.steps.map((step) => ({
                            titleTemplate: step.titleTemplate,
                            dueOffsetMinutes: step.dueOffsetMinutes,
                          })),
                        });
                        if (res.ok) {
                          setCreated((c) => ({ ...c, [s.key]: res.slug }));
                          router.refresh();
                        }
                      });
                    }}
                    className="rounded-full bg-white px-3 py-1 text-[11.5px] font-medium text-black hover:bg-white/90 disabled:opacity-50"
                  >
                    {pending ? '…' : 'Als Workflow speichern'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
                Erkannte Runs
              </p>
              <div className="flex flex-col gap-1.5">
                {s.runs.slice(0, 3).map((r, i) => (
                  <div
                    key={i}
                    className="rounded-[8px] border border-white/[0.04] bg-white/[0.01] px-3 py-2"
                  >
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
                      {new Date(r.anchorAt).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: 'short',
                      })}
                      {' · '}
                      {r.customerName ?? r.vehiclePlate ?? '—'}
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1 text-[12px] text-ink-200">
                      {r.todoTitles.slice(0, 5).map((t, j) => (
                        <li key={j} className="flex items-center gap-2">
                          <span className="text-ink-300">·</span>
                          <span className="truncate">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <details className="mt-1">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300 hover:text-ink-100">
                Vorschau Template-Steps
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {s.steps.map((st, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-[6px] bg-white/[0.02] px-2.5 py-1.5 text-[12px] text-ink-100"
                  >
                    <span className="font-mono text-[10px] text-ink-300">{i + 1}.</span>
                    <span className="flex-1">{st.titleTemplate}</span>
                    <span className="font-mono text-[10px] text-ink-300">
                      +{Math.round(st.dueOffsetMinutes / 60)}h
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ))}
    </div>
  );
}
