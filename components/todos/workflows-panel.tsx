'use client';

import { useState, useTransition } from 'react';
import { ReplayWorkflowModal } from './replay-workflow-modal';
import { deleteWorkflow } from '@/lib/actions/workflows';
import type { TodoGroup, TodoUser, Workflow } from '@/lib/types';

export function WorkflowsPanel({
  workflows,
  groups,
  members,
  onCaptureRequest,
}: {
  workflows: Workflow[];
  groups: TodoGroup[];
  members: TodoUser[];
  onCaptureRequest: () => void;
}) {
  const [replayTarget, setReplayTarget] = useState<Workflow | null>(null);
  const [, start] = useTransition();

  return (
    <div className="mt-3 flex flex-col">
      <div className="flex items-center justify-between pl-2 pr-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Workflows
        </span>
        <button
          type="button"
          onClick={onCaptureRequest}
          aria-label="Workflow aus letzten Todos aufnehmen"
          title="Workflow aus letzten Todos aufnehmen"
          className="flex h-5 w-5 items-center justify-center rounded-[4px] text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
        >
          ⏺
        </button>
      </div>

      <div className="flex flex-col">
        {workflows.length === 0 && (
          <p className="px-2 py-2 text-[11.5px] leading-[1.5] text-ink-300">
            Noch keine Workflows. Klick ⏺ um einen aus deinen letzten Todos aufzunehmen.
          </p>
        )}
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className="group flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px] leading-tight text-ink-200 hover:bg-white/[0.04]"
          >
            <button
              type="button"
              onClick={() => setReplayTarget(wf)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              {wf.emoji ? (
                <span className="text-[13px] leading-none">{wf.emoji}</span>
              ) : (
                <span className="font-mono text-[11px] text-ink-300">▶</span>
              )}
              <span className="min-w-0 flex-1 truncate">{wf.name}</span>
              <span className="font-mono text-[10.5px] text-ink-300">{wf.steps.length}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm(`Workflow „${wf.name}" löschen?`)) return;
                start(async () => {
                  await deleteWorkflow(wf.id);
                });
              }}
              className="opacity-0 transition-opacity hover:text-[#ff8a8a] group-hover:opacity-100"
              aria-label="Löschen"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <ReplayWorkflowModal
        workflow={replayTarget}
        open={!!replayTarget}
        onClose={() => setReplayTarget(null)}
        groups={groups}
        members={members}
      />
    </div>
  );
}
