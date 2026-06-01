'use client';

/**
 * Flow — GRAPH view (optional visual layer, N8N-style nodes + arrows).
 *
 * SAME data as the list view: nodes = steps, edges = order (from the pure
 * resolveFlow result). Layout is computed automatically top-to-bottom from
 * step order — no manual pixel positioning for linear flows. Every node
 * action writes into the same todo model (toggle / rename / remove), and
 * appending adds a step at the end.
 *
 * This module is loaded LAZILY (dynamic import in flow-detail-client) so
 * @xyflow/react never weighs on the list view. Styled to the app: dark,
 * accent #8B7FFF, calm — not the default React Flow look.
 */
import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  addFlowStep,
  toggleFlowStep,
  removeFlowStep,
  renameFlowNode,
} from '@/lib/actions/flows';
import { toast } from '@/lib/stores/toast-store';
import type { FlowStep, FlowEdge } from '@/lib/flows/sequence';

const ACCENT = '#8B7FFF';

type StepNodeData = {
  step: FlowStep;
  busy: boolean;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
};

// Custom node — matches the app's dark/calm language, not stock React Flow.
function StepNode({ data }: NodeProps<Node<StepNodeData>>) {
  const { step, busy, onToggle, onRename, onRemove } = data;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(step.title);

  const palette =
    step.state === 'done'
      ? { border: `${ACCENT}55`, bg: 'rgba(139,127,255,0.08)', dot: ACCENT, label: '#A1A1AA' }
      : step.state === 'active'
        ? { border: ACCENT, bg: 'rgba(139,127,255,0.14)', dot: ACCENT, label: '#FAFAFA' }
        : { border: 'rgba(255,255,255,0.08)', bg: '#141417', dot: '#52525B', label: '#A1A1AA' };

  return (
    <div
      className="w-[200px] rounded-[12px] border px-3 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-sm"
      style={{ borderColor: palette.border, background: palette.bg, opacity: step.state === 'upcoming' ? 0.7 : 1 }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#52525B', width: 6, height: 6, border: 'none' }} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(step.id)}
          aria-label={step.state === 'done' ? 'Wieder öffnen' : 'Erledigt'}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] disabled:opacity-50"
          style={{ background: `${palette.dot}22`, color: palette.dot, border: step.state === 'active' ? `1px solid ${ACCENT}` : 'none' }}
        >
          {step.state === 'done' ? '✓' : step.position}
        </button>
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (title.trim() && title.trim() !== step.title) onRename(step.id, title.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setTitle(step.title);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded border border-[#2A2A30] bg-[#0A0A0C] px-1.5 py-0.5 text-[12.5px] text-[#FAFAFA] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`min-w-0 flex-1 truncate text-left text-[13px] ${step.state === 'done' ? 'line-through decoration-[#52525B]/40' : ''}`}
            style={{ color: palette.label }}
          >
            {step.title}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm('Diesen Schritt entfernen?')) onRemove(step.id);
          }}
          aria-label="Entfernen"
          className="shrink-0 text-[12px] text-[#3a3a3f] transition-colors hover:text-[#ff8a8a] disabled:opacity-50"
        >
          ×
        </button>
      </div>
      {step.state === 'active' && (
        <p className="mt-1 pl-7 font-mono text-[9px] uppercase tracking-[0.3px]" style={{ color: ACCENT }}>
          jetzt dran
        </p>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#52525B', width: 6, height: 6, border: 'none' }} />
    </div>
  );
}

const NODE_TYPES = { step: StepNode };

const NODE_W = 200;
const V_GAP = 96; // vertical spacing between stacked nodes

export default function FlowGraphView({
  flowId,
  steps,
  edges: flowEdges,
}: {
  flowId: string;
  steps: FlowStep[];
  edges: FlowEdge[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const act = useCallback(
    (fn: () => Promise<{ ok: boolean; error?: string }>) =>
      start(async () => {
        const r = await fn();
        if (!r.ok) toast(r.error ?? 'Aktion fehlgeschlagen', 'danger');
        router.refresh();
      }),
    [router]
  );

  const onToggle = useCallback((id: string) => act(() => toggleFlowStep(id)), [act]);
  const onRename = useCallback((id: string, title: string) => act(() => renameFlowNode(id, title)), [act]);
  const onRemove = useCallback((id: string) => act(() => removeFlowStep(id)), [act]);

  // Auto top-to-bottom layout straight from step order (no manual coords).
  const nodes: Node<StepNodeData>[] = useMemo(
    () =>
      steps.map((step, i) => ({
        id: step.id,
        type: 'step',
        position: { x: 0, y: i * V_GAP },
        data: { step, busy: pending, onToggle, onRename, onRemove },
        draggable: false,
        selectable: false,
        width: NODE_W,
      })),
    [steps, pending, onToggle, onRename, onRemove]
  );

  const edges: Edge[] = useMemo(
    () =>
      flowEdges.map((e) => ({
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        animated: false,
        style: { stroke: '#3a3a3f', strokeWidth: 1.5 },
      })),
    [flowEdges]
  );

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-[12px] border border-white/[0.06] bg-[#0A0A0C]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll={false}
        minZoom={0.4}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1F1F23" />
      </ReactFlow>

      {/* Append a step at the end — writes into the same model. */}
      <AppendButton flowId={flowId} onAdded={() => router.refresh()} disabled={pending} />
    </div>
  );
}

function AppendButton({ flowId, onAdded, disabled }: { flowId: string; onAdded: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    start(async () => {
      const r = await addFlowStep(flowId, t);
      if (r.ok) {
        setValue('');
        setOpen(false);
        onAdded();
      } else {
        toast(r.error ?? 'Fehler', 'danger');
      }
    });
  };

  return (
    <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
      {open ? (
        <div className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-[rgba(18,19,21,0.96)] px-2.5 py-1.5 backdrop-blur-md">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Neuer Schritt …"
            disabled={pending}
            className="w-44 bg-transparent text-[13px] text-[#FAFAFA] outline-none placeholder:text-[#52525B]"
          />
          <button type="button" onClick={submit} disabled={pending} className="text-[12px] font-medium" style={{ color: ACCENT }}>
            +
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="rounded-full border px-3 py-1.5 text-[12px] font-medium backdrop-blur-md transition-colors disabled:opacity-50"
          style={{ borderColor: `${ACCENT}40`, background: 'rgba(139,127,255,0.1)', color: ACCENT }}
        >
          + Schritt anhängen
        </button>
      )}
    </div>
  );
}
