'use client';

/**
 * Flow detail — holds the Liste ⇄ Flow-Chart toggle over ONE data source.
 *
 * The list view is always available (the default base). The flow-chart view
 * is loaded lazily via next/dynamic, so @xyflow/react only enters the bundle
 * when the user actually switches to it — the list never pays for it. Both
 * views render the SAME resolved steps/edges + the same wedge-hook commitment
 * indicators, so an edit in one shows immediately in the other.
 */
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { FlowListView } from './flow-list-view';
import { FLOW_CANVAS_BG } from '@/lib/flows/status';
import type { FlowStep, FlowEdge } from '@/lib/flows/sequence';
import type { FlowStepCommitment } from '@/lib/db/queries/flows';

// Lazy chart — code-split + client-only (React Flow needs the DOM).
const FlowGraphView = dynamic(() => import('./flow-graph-view'), {
  ssr: false,
  loading: () => (
    <div
      className="grid h-[460px] w-full place-items-center rounded-[12px] border border-white/[0.06] text-[13px] text-[#6a6b6c]"
      style={{ background: FLOW_CANVAS_BG }}
    >
      Flow-Chart wird geladen …
    </div>
  ),
});

type View = 'liste' | 'flow-chart';

export function FlowDetailClient({
  flow,
}: {
  flow: {
    id: string;
    title: string;
    description: string | null;
    steps: FlowStep[];
    edges: FlowEdge[];
    commitments: Record<string, FlowStepCommitment>;
    doneCount: number;
    totalCount: number;
    complete: boolean;
  };
}) {
  const [view, setView] = useState<View>('liste');

  const activeTitle = flow.steps.find((s) => s.state === 'active')?.title ?? null;

  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#FAFAFA]">
      <div className="mx-auto w-full max-w-[920px] px-6 pt-[88px] pb-24">
        <nav className="flex items-center gap-2 text-[13px] text-[#6a6b6c]">
          <Link href="/todos" className="inline-flex items-center gap-1.5 transition-colors hover:text-[#9c9c9d]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Todos
          </Link>
          <span aria-hidden className="text-[#434345]">·</span>
          <span className="text-[#FAFAFA]">Flow</span>
        </nav>

        <header className="mt-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-medium leading-tight text-[#FAFAFA]">{flow.title}</h1>
            <p className="mt-1 text-[13px] text-[#9c9c9d]">
              {flow.totalCount === 0
                ? 'Noch keine Schritte'
                : flow.complete
                  ? `Abgeschlossen · ${flow.totalCount} Schritte`
                  : activeTitle
                    ? `Jetzt dran: ${activeTitle} · ${flow.doneCount}/${flow.totalCount} erledigt`
                    : `${flow.doneCount}/${flow.totalCount} Schritte erledigt`}
            </p>
          </div>

          {/* View-Toggle Liste ⇄ Flow-Chart — underlined active tab, locked
              labels, in the app's restrained nav style. */}
          <div className="flex shrink-0 items-center gap-4" role="tablist" aria-label="Ansicht">
            {(['liste', 'flow-chart'] as View[]).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(v)}
                  className={`pb-1 font-mono text-[11px] uppercase tracking-[0.4px] transition-colors duration-150 ${
                    active
                      ? 'border-b border-[#E8B86D] text-[#FAFAFA]'
                      : 'border-b border-transparent text-[#6a6b6c] hover:text-[#9c9c9d]'
                  }`}
                >
                  {v === 'liste' ? 'Liste' : 'Flow-Chart'}
                </button>
              );
            })}
          </div>
        </header>

        {flow.description && (
          <p className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.6] text-[#9c9c9d]">{flow.description}</p>
        )}

        <div className="mt-8">
          {view === 'liste' ? (
            <FlowListView flowId={flow.id} steps={flow.steps} commitments={flow.commitments} />
          ) : (
            <FlowGraphView flowId={flow.id} steps={flow.steps} edges={flow.edges} commitments={flow.commitments} />
          )}
        </div>
      </div>
    </main>
  );
}
