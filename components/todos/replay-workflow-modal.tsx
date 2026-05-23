'use client';

import { useMemo, useState, useTransition } from 'react';
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
} from '@/components/ui/modal';
import { replayWorkflow } from '@/lib/actions/workflows';
import type { TodoGroup, TodoUser, Workflow } from '@/lib/types';

function detectVariables(workflow: Workflow): string[] {
  const set = new Set<string>();
  for (const st of workflow.steps) {
    for (const m of st.titleTemplate.matchAll(/\{(\w+)\}/g)) set.add(m[1]);
  }
  return Array.from(set);
}

export function ReplayWorkflowModal({
  workflow,
  open,
  onClose,
  groups,
  members,
  defaultVariables,
  customerId,
  contractId,
  vehicleId,
  channelId,
}: {
  workflow: Workflow | null;
  open: boolean;
  onClose: () => void;
  groups: TodoGroup[];
  members: TodoUser[];
  defaultVariables?: Record<string, string>;
  customerId?: string;
  contractId?: string;
  vehicleId?: string;
  channelId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vars, setVars] = useState<Record<string, string>>(defaultVariables ?? {});

  // Reset vars when workflow or defaults change
  useMemo(() => {
    if (defaultVariables) setVars(defaultVariables);
  }, [workflow?.id, JSON.stringify(defaultVariables)]);

  const variables = useMemo(
    () => (workflow ? detectVariables(workflow) : []),
    [workflow]
  );

  if (!workflow) return null;

  const previewFirstStep = (() => {
    if (!workflow.steps[0]) return '';
    return workflow.steps[0].titleTemplate.replace(/\{(\w+)\}/g, (m, k) => vars[k] || m);
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Workflow ausführen"
      title={workflow.emoji ? `${workflow.emoji} ${workflow.name}` : workflow.name}
      maxWidth={560}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          start(async () => {
            const res = await replayWorkflow({
              workflowId: workflow.id,
              variables: vars,
              anchorIso: (data.get('anchorIso') as string) || undefined,
              groupId: (data.get('groupId') as string) || null,
              assigneeId: (data.get('assigneeId') as string) || null,
              customerId: customerId ?? null,
              contractId: contractId ?? null,
              vehicleId: vehicleId ?? null,
              channelId: channelId ?? null,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            setVars({});
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}

        {workflow.description && (
          <p className="text-[12.5px] leading-[1.5] text-ink-300">{workflow.description}</p>
        )}

        {variables.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              Variablen einfüllen
            </p>
            {variables.map((v) => (
              <ModalField key={v} label={v}>
                <ModalInput
                  value={vars[v] ?? ''}
                  onChange={(e) => setVars((prev) => ({ ...prev, [v]: e.target.value }))}
                  placeholder={`Wert für {${v}}`}
                />
              </ModalField>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Anker-Datum" hint="Schritte werden relativ dazu eingeplant.">
            <ModalInput
              name="anchorIso"
              type="datetime-local"
              defaultValue={new Date().toISOString().slice(0, 16)}
            />
          </ModalField>
          <ModalField label="Gruppe">
            <ModalSelect name="groupId" defaultValue="">
              <option value="">— ohne —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji ? `${g.emoji} ` : ''}
                  {g.name}
                </option>
              ))}
            </ModalSelect>
          </ModalField>
        </div>

        <ModalField label="Standard-Assignee (für alle Schritte)">
          <ModalSelect name="assigneeId" defaultValue="">
            <option value="">— niemand —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </ModalSelect>
        </ModalField>

        <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">Vorschau Schritt 1</p>
          <p className="mt-1 text-[13px] text-ink-50">{previewFirstStep || '— leer —'}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            {workflow.steps.length} Schritte werden erstellt
          </p>
        </div>

        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>{workflow.steps.length} Todos anlegen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
