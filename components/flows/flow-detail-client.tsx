'use client';

/**
 * Flow detail — holds the Liste ⇄ Graph toggle over ONE data source.
 *
 * The list view is always available (the mandatory base). The graph view is
 * loaded lazily via next/dynamic, so @xyflow/react only enters the bundle
 * when the user actually switches to the graph — the list never pays for it.
 */
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { FlowListView } from './flow-list-view';
import type { FlowStep, FlowEdge } from '@/lib/flows/sequence';

// Lazy graph — code-split + client-only (React Flow needs the DOM).
const FlowGraphView = dynamic(() => import('./flow-graph-view'), {
  ssr: false,
  loading: () => (
    <div className="grid h-[460px] w-full place-items-center rounded-[12px] border border-white/[0.06] bg-[#0A0A0C] text-[13px] text-[#52525B]">
      Graph wird geladen …
    </div>
  ),
});

type View = 'liste' | 'graph';

export function FlowDetailClient({
  flow,
}: {
  flow: {
    id: string;
    title: string;
    description: string | null;
    steps: FlowStep[];
    edges: FlowEdge[];
    doneCount: number;
    totalCount: number;
    complete: boolean;
  };
}) {
  const [view, setView] = useState<View>('liste');

  return (
    <main className="min-h-screen bg-[#0A0A0C] text-[#FAFAFA]">
      <div className="mx-auto w-full max-w-[760px] px-6 pt-[88px] pb-24">
        <nav className="flex items-center gap-2 text-[13px] text-[#52525B]">
          <Link href="/todos" className="inline-flex items-center gap-1.5 transition-colors hover:text-[#A1A1AA]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Todos
          </Link>
          <span aria-hidden className="text-[#3a3a3f]">·</span>
          <span className="text-[#FAFAFA]">Flow</span>
        </nav>

        <header className="mt-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-medium leading-tight text-[#FAFAFA]">{flow.title}</h1>
            <p className="mt-1 text-[13px] text-[#A1A1AA]">
              {flow.totalCount === 0
                ? 'Noch keine Schritte'
                : flow.complete
                  ? `Abgeschlossen · ${flow.totalCount} Schritte`
                  : `${flow.doneCount}/${flow.totalCount} Schritte erledigt`}
            </p>
          </div>

          {/* View-Toggle Liste ⇄ Graph */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-[#1F1F23] bg-white/[0.015] p-0.5">
            {(['liste', 'graph'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded px-2.5 py-1 text-[12px] capitalize transition-colors duration-150 ${
                  view === v ? 'bg-white/[0.06] text-[#FAFAFA]' : 'text-[#52525B] hover:text-[#A1A1AA]'
                }`}
                aria-pressed={view === v}
              >
                {v === 'liste' ? 'Liste' : 'Graph'}
              </button>
            ))}
          </div>
        </header>

        {flow.description && (
          <p className="mt-3 whitespace-pre-wrap text-[13px] leading-[1.6] text-[#A1A1AA]">{flow.description}</p>
        )}

        <div className="mt-8">
          {view === 'liste' ? (
            <FlowListView flowId={flow.id} steps={flow.steps} />
          ) : (
            <FlowGraphView flowId={flow.id} steps={flow.steps} edges={flow.edges} />
          )}
        </div>
      </div>
    </main>
  );
}
