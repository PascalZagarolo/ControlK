'use client';

/**
 * Flow — FLOW-CHART view (visual layer, node-arrow metaphor).
 *
 * SAME data as the list view: nodes = steps, edges = dependencies (from the
 * pure resolveFlow result). Horizontal LEFT→RIGHT auto-layout from step order
 * — no manual pixel positioning, no free canvas. Node = compact: title + one
 * locked-caps status label (ERLEDIGT/AKTIV/WARTET). Status colours + the
 * solid/dashed edge styling come from the CENTRAL token map
 * (lib/flows/status), shared with the list view + morning plan. Every node
 * action writes the same todo model (toggle / rename / remove); appending
 * adds a step at the end.
 *
 * Loaded LAZILY (dynamic import in flow-detail-client) so @xyflow/react never
 * weighs on the list view. Styled to the app (neutral dark grey canvas, sand/
 * gold accent for the single active step) — not the default React Flow look.
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
import { FLOW_STATUS, FLOW_EDGE, FLOW_CANVAS_BG, FLOW_DOT_COLOR } from '@/lib/flows/status';
import type { FlowStep, FlowEdge } from '@/lib/flows/sequence';
import type { FlowStepCommitment } from '@/lib/db/queries/flows';

const GOLD = FLOW_STATUS.active.color; // sand/gold, central token

type StepNodeData = {
  step: FlowStep;
  commitment?: FlowStepCommitment;
  busy: boolean;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRemove: (id: string) => void;
};

// Custom node — matches the app's dark/calm language via central tokens.
function StepNode({ data }: NodeProps<Node<StepNodeData>>) {
  const { step, commitment, busy, onToggle, onRename, onRemove } = data;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(step.title);
  const tok = FLOW_STATUS[step.state];

  return (
    <div
      className="w-[210px] rounded-[12px] border px-3 py-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      style={{ borderColor: tok.border, background: tok.bg, opacity: tok.opacity }}
    >
      {/* Horizontal flow → handles on left (target) + right (source). */}
      <Handle type="target" position={Position.Left} style={{ background: '#6a6b6c', width: 6, height: 6, border: 'none' }} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(step.id)}
          aria-label={step.state === 'done' ? 'Wieder öffnen' : 'Erledigt'}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] disabled:opacity-50"
          style={{ background: `${tok.color}22`, color: tok.color, border: step.state === 'active' ? `1px solid ${tok.color}` : 'none' }}
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
            className="min-w-0 flex-1 rounded border border-[#2f3031] bg-[#0c0d0f] px-1.5 py-0.5 text-[12.5px] text-[#FAFAFA] outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`min-w-0 flex-1 truncate text-left text-[13px] ${step.state === 'done' ? 'line-through decoration-[#6a6b6c]/40 text-[#9c9c9d]' : 'text-[#FAFAFA]'}`}
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
          className="shrink-0 text-[12px] text-[#434345] transition-colors hover:text-[#ff8a8a] disabled:opacity-50"
        >
          ×
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 pl-7">
        <span className="font-mono text-[9px] uppercase tracking-[0.4px]" style={{ color: tok.color }}>
          {tok.label}
        </span>
      </div>
      {/* Wedge-hook indicator. */}
      {commitment && (
        <p className="mt-1 truncate pl-7 text-[10px]" style={{ color: GOLD }} title={commitment.label}>
          ↳ {commitment.label}
        </p>
      )}
      <Handle type="source" position={Position.Right} style={{ background: '#6a6b6c', width: 6, height: 6, border: 'none' }} />
    </div>
  );
}

const NODE_TYPES = { step: StepNode };

const NODE_W = 210;
const H_GAP = 110; // horizontal spacing between nodes (node width + gutter)

export default function FlowGraphView({
  flowId,
  steps,
  edges: flowEdges,
  commitments = {},
}: {
  flowId: string;
  steps: FlowStep[];
  edges: FlowEdge[];
  commitments?: Record<string, FlowStepCommitment>;
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

  // Auto LEFT→RIGHT layout straight from step order (no manual coords).
  const nodes: Node<StepNodeData>[] = useMemo(
    () =>
      steps.map((step, i) => ({
        id: step.id,
        type: 'step',
        position: { x: i * (NODE_W + H_GAP), y: 0 },
        data: { step, commitment: commitments[step.id], busy: pending, onToggle, onRename, onRemove },
        draggable: false,
        selectable: false,
        width: NODE_W,
      })),
    [steps, commitments, pending, onToggle, onRename, onRemove]
  );

  // Solid for the walked path (traversed), dashed+dim for upcoming.
  const edges: Edge[] = useMemo(
    () =>
      flowEdges.map((e) => {
        const tok = e.traversed ? FLOW_EDGE.traversed : FLOW_EDGE.upcoming;
        return {
          id: `${e.from}-${e.to}`,
          source: e.from,
          target: e.to,
          animated: false,
          style: { stroke: tok.stroke, strokeWidth: tok.width, strokeDasharray: tok.dash },
        };
      }),
    [flowEdges]
  );

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-[12px] border border-white/[0.06]" style={{ background: FLOW_CANVAS_BG }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll={false}
        minZoom={0.4}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={FLOW_DOT_COLOR} />
      </ReactFlow>

      {/* Inline "Schritt anhängen" — writes into the same model. */}
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
        <div className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-[rgba(12,13,15,0.96)] px-2.5 py-1.5 backdrop-blur-md">
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
            className="w-44 bg-transparent text-[13px] text-[#FAFAFA] outline-none placeholder:text-[#6a6b6c]"
          />
          <button type="button" onClick={submit} disabled={pending} className="text-[12px] font-medium" style={{ color: GOLD }}>
            +
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="rounded-full border px-3 py-1.5 text-[12px] font-medium backdrop-blur-md transition-colors disabled:opacity-50"
          style={{ borderColor: `${GOLD}40`, background: 'rgba(232,184,109,0.1)', color: GOLD }}
        >
          + Schritt anhängen
        </button>
      )}
    </div>
  );
}
