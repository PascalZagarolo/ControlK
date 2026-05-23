'use client';

import { useState } from 'react';
import { ReplayWorkflowModal } from '@/components/todos/replay-workflow-modal';
import type { TodoGroup, TodoUser, Workflow } from '@/lib/types';

export function WorkflowQuickReplay({
  workflows,
  groups,
  members,
  customerName,
  customerId,
}: {
  workflows: Workflow[];
  groups: TodoGroup[];
  members: TodoUser[];
  customerName: string;
  customerId: string;
}) {
  const [target, setTarget] = useState<Workflow | null>(null);
  if (workflows.length === 0) return null;
  return (
    <>
      <div className="flex flex-col gap-1.5 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Workflow ausführen
          </span>
          <span className="font-mono text-[10px] text-ink-300">{workflows.length} verfügbar</span>
        </div>
        <p className="text-[11.5px] leading-[1.45] text-ink-300">
          Spawnt einen vorbereiteten Set von Todos für {customerName}.
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {workflows.map((wf) => (
            <button
              key={wf.id}
              type="button"
              onClick={() => setTarget(wf)}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-ink-50"
            >
              {wf.emoji && <span>{wf.emoji}</span>}
              <span>{wf.name}</span>
              <span className="font-mono text-[10px] text-ink-300">{wf.steps.length}</span>
            </button>
          ))}
        </div>
      </div>
      <ReplayWorkflowModal
        workflow={target}
        open={!!target}
        onClose={() => setTarget(null)}
        groups={groups}
        members={members}
        defaultVariables={{ kunde: customerName }}
        customerId={customerId}
      />
    </>
  );
}
