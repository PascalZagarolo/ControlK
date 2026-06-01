'use client';

/**
 * Todo-GRUPPE — grafische Ansicht (lazy), als FREIER, interaktiver Canvas.
 *
 * Der Canvas startet leer; per „+ Todo hinzufügen" wählt man bestehende
 * Gruppen-Todos als Knoten. Auf dem Canvas kann man:
 *   - Knoten frei verschieben (Drag),
 *   - Verbindungen ziehen (vom rechten Punkt eines Knotens zum linken eines
 *     anderen) — z.B. „erst A, dann B",
 *   - Knoten/Verbindungen wieder entfernen.
 *
 * Das komplette Layout (welche Todos, ihre Positionen, die Verbindungen) ist
 * eine reine Ansichts-Präferenz und wird pro Gruppe lokal in localStorage
 * gespeichert — kein Schema, keine Vermischung mit echten Flows. Das Abhaken
 * eines Knotens schreibt über setTodoStatus in die DB (Liste & Canvas sync).
 *
 * React-Flow läuft hier UNCONTROLLED über useNodesState/useEdgesState, damit
 * Drag + Connect tatsächlich funktionieren (der frühere Bug: gememote Knoten
 * ohne onNodesChange → Positionen sprangen sofort zurück, Kanten fehlten ganz).
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
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { setTodoStatus } from '@/lib/actions/todos';
import { toast } from '@/lib/stores/toast-store';
import { FLOW_STATUS, FLOW_EDGE, FLOW_CANVAS_BG, FLOW_DOT_COLOR } from '@/lib/flows/status';
import type { TodoStatus, TodoPriority } from '@/lib/types';

export type GraphTodo = {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  dueAt: string | null;
};

const isDone = (s: TodoStatus) => s === 'erledigt' || s === 'abgebrochen';
const storageKey = (groupId: string) => `ctrlk:group-graph:v2:${groupId}`;

// Persisted shape: node positions + edges. Membership = positions.keys().
type SavedLayout = {
  positions: Record<string, { x: number; y: number }>;
  edges: { source: string; target: string }[];
};

const NODE_W = 220;
const PER_ROW = 3;
const H_GAP = 80;
const V_GAP = 110;

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
      {/* Connectable handles: drag from the right dot to another node's left. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-[#0c0d0f]"
        style={{ background: '#6a6b6c' }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(todo.id, done)}
          aria-label={done ? 'Wieder öffnen' : 'Erledigt'}
          className="nodrag grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] disabled:opacity-50"
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
          className="nodrag shrink-0 text-[13px] text-[#434345] opacity-0 transition-opacity hover:text-[#ff8a8a] group-hover/node:opacity-100"
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
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-[#0c0d0f]"
        style={{ background: '#E8B86D' }}
      />
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

const EDGE_STYLE = {
  type: 'smoothstep' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: FLOW_EDGE.traversed.stroke, width: 16, height: 16 },
  style: { stroke: FLOW_EDGE.traversed.stroke, strokeWidth: FLOW_EDGE.traversed.width },
};

// ── Canvas ───────────────────────────────────────────────────────────

export default function GroupGraphView({ groupId, todos }: { groupId: string; todos: GraphTodo[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const byId = useMemo(() => new Map(todos.map((t) => [t.id, t])), [todos]);

  // ── Persistence ──
  const save = useCallback(
    (ns: Node<NodeData>[], es: Edge[]) => {
      const layout: SavedLayout = {
        positions: Object.fromEntries(ns.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }])),
        edges: es.map((e) => ({ source: e.source, target: e.target })),
      };
      try {
        localStorage.setItem(storageKey(groupId), JSON.stringify(layout));
      } catch {
        /* storage blocked → canvas still works for the session */
      }
    },
    [groupId]
  );

  // ── Node factory ──
  const onToggle = useCallback(
    (id: string, done: boolean) =>
      start(async () => {
        const r = await setTodoStatus(id, done ? 'offen' : 'erledigt');
        if (!r.ok) toast(r.error ?? 'Aktion fehlgeschlagen', 'danger');
        router.refresh();
      }),
    [router]
  );

  const removeNode = useCallback(
    (id: string) => {
      setNodes((ns) => {
        const next = ns.filter((n) => n.id !== id);
        setEdges((es) => {
          const e2 = es.filter((e) => e.source !== id && e.target !== id);
          save(next, e2);
          return e2;
        });
        return next;
      });
    },
    [setNodes, setEdges, save]
  );

  const makeNode = useCallback(
    (todo: GraphTodo, pos: { x: number; y: number }): Node<NodeData> => ({
      id: todo.id,
      type: 'todo',
      position: pos,
      data: { todo, busy: pending, onToggle, onRemove: removeNode },
      width: NODE_W,
    }),
    [pending, onToggle, removeNode]
  );

  // ── Hydrate from storage on mount ──
  useEffect(() => {
    let layout: SavedLayout | null = null;
    try {
      const raw = localStorage.getItem(storageKey(groupId));
      if (raw) layout = JSON.parse(raw) as SavedLayout;
    } catch {
      /* ignore */
    }
    if (layout?.positions) {
      const ids = Object.keys(layout.positions).filter((id) => byId.has(id));
      setNodes(ids.map((id) => makeNode(byId.get(id)!, layout!.positions[id])));
      const valid = new Set(ids);
      setEdges(
        (layout.edges ?? [])
          .filter((e) => valid.has(e.source) && valid.has(e.target))
          .map((e) => ({ id: `${e.source}->${e.target}`, source: e.source, target: e.target, ...EDGE_STYLE }))
      );
    }
    setHydrated(true);
    // Hydrate once per group; makeNode/byId intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Keep node DATA fresh when todos change (status/title) without disturbing
  // positions the user set. Runs after hydration only.
  useEffect(() => {
    if (!hydrated) return;
    setNodes((ns) =>
      ns
        .filter((n) => byId.has(n.id)) // drop deleted todos
        .map((n) => {
          const t = byId.get(n.id)!;
          return { ...n, data: { todo: t, busy: pending, onToggle, onRemove: removeNode } };
        })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byId, pending, hydrated]);

  // ── Change handlers (persist after applying) ──
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<NodeData>>[]) => {
      onNodesChange(changes);
      // Persist only when a drag finishes (positions settled).
      if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
        setNodes((ns) => {
          setEdges((es) => {
            save(ns, es);
            return es;
          });
          return ns;
        });
      }
    },
    [onNodesChange, setNodes, setEdges, save]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      onEdgesChange(changes);
      if (changes.some((c) => c.type === 'remove')) {
        setEdges((es) => {
          setNodes((ns) => {
            save(ns, es);
            return ns;
          });
          return es;
        });
      }
    },
    [onEdgesChange, setEdges, setNodes, save]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return;
      setEdges((es) => {
        const next = addEdge({ ...conn, id: `${conn.source}->${conn.target}`, ...EDGE_STYLE }, es);
        setNodes((ns) => {
          save(ns, next);
          return ns;
        });
        return next;
      });
    },
    [setEdges, setNodes, save]
  );

  // ── Add todos from the picker ──
  const onCanvasIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const available = useMemo(() => todos.filter((t) => !onCanvasIds.has(t.id)), [todos, onCanvasIds]);

  const addTodos = useCallback(
    (ids: string[]) => {
      const fresh = ids.filter((id) => !onCanvasIds.has(id) && byId.has(id));
      if (fresh.length === 0) return;
      setNodes((ns) => {
        const base = ns.length;
        const added = fresh.map((id, k) => {
          const i = base + k;
          return makeNode(byId.get(id)!, {
            x: (i % PER_ROW) * (NODE_W + H_GAP) + 40,
            y: Math.floor(i / PER_ROW) * V_GAP + 60,
          });
        });
        const next = [...ns, ...added];
        setEdges((es) => {
          save(next, es);
          return es;
        });
        return next;
      });
    },
    [onCanvasIds, byId, makeNode, setNodes, setEdges, save]
  );

  const empty = hydrated && nodes.length === 0;

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
        {nodes.length > 0 && (
          <span className="font-mono text-[10px] text-[#52525B]">
            {nodes.length} Knoten · Verbindungen ziehen · lokal gespeichert
          </span>
        )}
      </div>

      {empty && !picking && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center">
          <span aria-hidden className="text-[26px] opacity-50">◇</span>
          <p className="text-[14px] font-medium text-[#A1A1AA]">Leerer Canvas.</p>
          <p className="max-w-[340px] text-[12.5px] leading-[1.6] text-[#52525B]">
            „+ Todo hinzufügen" oben links. Dann Knoten frei verschieben und vom
            rechten Punkt zum nächsten Knoten ziehen, um „erst A, dann B" zu zeigen.
          </p>
        </div>
      )}

      {picking && (
        <TodoPicker available={available} onAdd={(ids) => addTodos(ids)} onClose={() => setPicking(false)} />
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        deleteKeyCode={['Backspace', 'Delete']}
        panOnScroll
        zoomOnScroll={false}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={EDGE_STYLE}
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
  onAdd,
  onClose,
}: {
  available: GraphTodo[];
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
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
                  onClick={() => onAdd([t.id])}
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
            onAdd(filtered.map((t) => t.id));
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
