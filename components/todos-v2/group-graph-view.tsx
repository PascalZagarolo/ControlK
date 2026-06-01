'use client';

/**
 * Todo-GRUPPE — grafische Ansicht (lazy), als COMPOSABLE Canvas.
 *
 * Statt automatisch alle Gruppen-Todos hinzudumpen (sah beliebig aus), ist
 * die Grafik ein bewusst zusammengestellter Canvas: sie startet LEER, per
 * „+ Todo hinzufügen" wählt man bestehende Todos der Gruppe aus, die dann als
 * Knoten erscheinen. Welche Todos auf dem Canvas liegen, ist eine reine
 * Ansichts-Präferenz → lokal pro Gruppe in localStorage gespeichert (kein
 * Schema, keine Vermischung mit echten Flows). Das Abhaken eines Knotens
 * schreibt über das bestehende setTodoStatus in die DB (beide Ansichten sync).
 *
 * Lazy geladen (next/dynamic im Gruppen-Client), damit @xyflow/react die
 * Standard-Listenansicht nicht beschwert.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { setTodoStatus } from '@/lib/actions/todos';
import { toast } from '@/lib/stores/toast-store';
import { FLOW_STATUS, FLOW_CANVAS_BG, FLOW_DOT_COLOR } from '@/lib/flows/status';
import type { TodoStatus, TodoPriority } from '@/lib/types';

export type GraphTodo = {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueAt: string | null;
};

const isDone = (s: TodoStatus) => s === 'erledigt' || s === 'abgebrochen';
const storageKey = (groupId: string) => `ctrlk:group-graph:${groupId}`;

// ── Node ─────────────────────────────────────────────────────────────

type NodeData = {
  todo: GraphTodo;
  busy: boolean;
  onToggle: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
};

function TodoNode({ data }: NodeProps<Node<NodeData>>) {
  const { todo, busy, onToggle, onRemove } = data;
  const done = isDone(todo.status);
  const tok = done ? FLOW_STATUS.done : FLOW_STATUS.waiting; // neutral grey, kein Gold
  const labelColor = done ? FLOW_STATUS.done.color : '#9c9c9d';

  return (
    <div
      className="group/node w-[220px] rounded-[12px] border px-3.5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
      style={{ borderColor: tok.border, background: tok.bg, opacity: done ? 0.85 : 1 }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#6a6b6c', width: 6, height: 6, border: 'none' }} />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(todo.id, done)}
          aria-label={done ? 'Wieder öffnen' : 'Erledigt'}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] disabled:opacity-50"
          style={{ background: `${labelColor}22`, color: labelColor }}
        >
          {done ? '✓' : '○'}
        </button>
        <span className={`min-w-0 flex-1 truncate text-[13px] ${done ? 'text-[#9c9c9d] line-through decoration-[#6a6b6c]/40' : 'text-[#FAFAFA]'}`}>
          {todo.title}
        </span>
        <button
          type="button"
          onClick={() => onRemove(todo.id)}
          aria-label="Vom Canvas entfernen (löscht das Todo nicht)"
          title="Vom Canvas entfernen"
          className="shrink-0 text-[13px] text-[#434345] opacity-0 transition-opacity hover:text-[#ff8a8a] group-hover/node:opacity-100"
        >
          ×
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2 pl-7">
        <span className="font-mono text-[9px] uppercase tracking-[0.4px]" style={{ color: labelColor }}>
          {done ? 'ERLEDIGT' : 'OFFEN'}
        </span>
        {todo.dueAt && !done && <DueChip iso={todo.dueAt} />}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#6a6b6c', width: 6, height: 6, border: 'none' }} />
    </div>
  );
}

function DueChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  const days = Math.floor((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  let label = d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  let color = '#52525B';
  if (days < 0) { label = 'überfällig'; color = '#ff8a8a'; }
  else if (days === 0) { label = 'heute'; color = '#E8B86D'; }
  else if (days === 1) label = 'morgen';
  return <span className="font-mono text-[9px]" style={{ color }}>{label}</span>;
}

const NODE_TYPES = { todo: TodoNode };
const NODE_W = 220;
const H_GAP = 80;
const V_GAP = 96;
const PER_ROW = 3;

// ── Canvas ───────────────────────────────────────────────────────────

export default function GroupGraphView({ groupId, todos }: { groupId: string; todos: GraphTodo[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(false);

  // Which todos are on the canvas — persisted locally per group. Hydrated
  // after mount (localStorage is client-only) to avoid SSR mismatch.
  const [onCanvas, setOnCanvas] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(groupId));
      if (raw) setOnCanvas(JSON.parse(raw) as string[]);
    } catch {
      /* ignore corrupt/blocked storage */
    }
    setHydrated(true);
  }, [groupId]);

  const persist = useCallback(
    (next: string[]) => {
      setOnCanvas(next);
      try {
        localStorage.setItem(storageKey(groupId), JSON.stringify(next));
      } catch {
        /* storage blocked → canvas still works for the session */
      }
    },
    [groupId]
  );

  const byId = useMemo(() => new Map(todos.map((t) => [t.id, t])), [todos]);
  // Drop ids that no longer exist (deleted todos) so the canvas stays valid.
  const canvasTodos = useMemo(
    () => onCanvas.map((id) => byId.get(id)).filter((t): t is GraphTodo => !!t),
    [onCanvas, byId]
  );
  const available = useMemo(() => todos.filter((t) => !onCanvas.includes(t.id)), [todos, onCanvas]);

  const add = (id: string) => persist([...onCanvas, id]);
  const addMany = (ids: string[]) => persist([...onCanvas, ...ids.filter((id) => !onCanvas.includes(id))]);
  const remove = useCallback((id: string) => persist(onCanvas.filter((x) => x !== id)), [onCanvas, persist]);

  const onToggle = useCallback(
    (id: string, done: boolean) =>
      start(async () => {
        const r = await setTodoStatus(id, done ? 'offen' : 'erledigt');
        if (!r.ok) toast(r.error ?? 'Aktion fehlgeschlagen', 'danger');
        router.refresh();
      }),
    [router]
  );

  const nodes: Node<NodeData>[] = useMemo(
    () =>
      canvasTodos.map((todo, i) => ({
        id: todo.id,
        type: 'todo',
        position: { x: (i % PER_ROW) * (NODE_W + H_GAP), y: Math.floor(i / PER_ROW) * V_GAP },
        data: { todo, busy: pending, onToggle, onRemove: remove },
        draggable: true, // user may nudge nodes; auto positions are the seed
        selectable: false,
        width: NODE_W,
      })),
    [canvasTodos, pending, onToggle, remove]
  );
  const edges: Edge[] = useMemo(() => [], []);

  return (
    <div
      className="relative h-[68vh] min-h-[480px] w-full overflow-hidden rounded-[14px] border border-white/[0.06]"
      style={{ background: FLOW_CANVAS_BG }}
    >
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="rounded-full border px-3 py-1.5 text-[12px] font-medium backdrop-blur-md transition-colors"
          style={{ borderColor: '#E8B86D40', background: 'rgba(232,184,109,0.10)', color: '#E8B86D' }}
        >
          + Todo hinzufügen
        </button>
        {canvasTodos.length > 0 && (
          <span className="font-mono text-[10px] text-[#52525B]">
            {canvasTodos.length} auf dem Canvas · lokal gespeichert
          </span>
        )}
      </div>

      {/* Empty state — the canvas starts blank until you add todos. */}
      {hydrated && canvasTodos.length === 0 && !picking && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center">
          <span aria-hidden className="text-[26px] opacity-50">◇</span>
          <p className="text-[14px] font-medium text-[#A1A1AA]">Leerer Canvas.</p>
          <p className="max-w-[320px] text-[12.5px] leading-[1.6] text-[#52525B]">
            Füge bestehende Todos dieser Gruppe als Knoten hinzu — oben links
            „+ Todo hinzufügen".
          </p>
        </div>
      )}

      {picking && (
        <TodoPicker available={available} onPick={add} onPickAll={addMany} onClose={() => setPicking(false)} />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll={false}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color={FLOW_DOT_COLOR} />
        <Controls showInteractive={false} className="!border-white/[0.08] !bg-[#0c0d0f]" />
      </ReactFlow>
    </div>
  );
}

// ── Picker ───────────────────────────────────────────────────────────

function TodoPicker({
  available,
  onPick,
  onPickAll,
  onClose,
}: {
  available: GraphTodo[];
  onPick: (id: string) => void;
  onPickAll: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // `Node` here must be the DOM Node, not @xyflow's Node type.
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const filtered = q ? available.filter((t) => t.title.toLowerCase().includes(q)) : available;

  return (
    <div
      ref={ref}
      className="absolute left-3 top-14 z-30 flex max-h-[60%] w-[320px] flex-col rounded-[12px] border border-white/[0.1] bg-[rgba(12,13,15,0.98)] shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] p-2.5">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Todo der Gruppe suchen …"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[#FAFAFA] outline-none placeholder:text-[#52525B]"
        />
        <button type="button" onClick={onClose} aria-label="Schließen" className="shrink-0 text-[13px] text-[#52525B] hover:text-[#A1A1AA]">
          ×
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-[12px] text-[#52525B]">
            {available.length === 0 ? 'Alle Todos sind schon auf dem Canvas.' : 'Kein Treffer.'}
          </p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onPick(t.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink-100 transition-colors hover:bg-white/[0.05]"
                >
                  <span aria-hidden className="text-[#E8B86D]">+</span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  {isDone(t.status) && <span className="shrink-0 font-mono text-[9px] text-[#52525B]">erledigt</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {filtered.length > 1 && (
        <button
          type="button"
          onClick={() => {
            onPickAll(filtered.map((t) => t.id));
            onClose();
          }}
          className="border-t border-white/[0.06] px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-[0.3px] text-[#52525B] transition-colors hover:text-[#A1A1AA]"
        >
          Alle {filtered.length} hinzufügen
        </button>
      )}
    </div>
  );
}
