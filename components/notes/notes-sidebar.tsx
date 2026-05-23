'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { archiveNote, createNote } from '@/lib/actions/notes';
import type { NoteTreeItem } from '@/lib/types';

type Node = NoteTreeItem & { children: Node[] };

function buildTree(items: NoteTreeItem[]): Node[] {
  const map = new Map<string, Node>();
  for (const i of items) map.set(i.id, { ...i, children: [] });
  const roots: Node[] = [];
  for (const n of map.values()) {
    if (n.parentNoteId && map.has(n.parentNoteId)) {
      map.get(n.parentNoteId)!.children.push(n);
    } else {
      roots.push(n);
    }
  }
  return roots;
}

export function NotesSidebar({ items }: { items: NoteTreeItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const tree = useMemo(() => buildTree(items), [items]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const onCreateRoot = () => {
    start(async () => {
      const res = await createNote({ title: 'Unbenannt' });
      if (res.ok) router.push(`/notes/${res.id}`);
    });
  };

  return (
    <aside className="flex w-full flex-col gap-2 lg:w-[280px] lg:shrink-0">
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Notizen · {items.length}
        </span>
        <button
          type="button"
          onClick={onCreateRoot}
          disabled={pending}
          className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50 disabled:opacity-50"
          title="Neue Notiz"
        >
          + neu
        </button>
      </div>

      {tree.length === 0 ? (
        <button
          type="button"
          onClick={onCreateRoot}
          disabled={pending}
          className="rounded-[10px] border border-dashed border-white/[0.10] bg-white/[0.01] px-3 py-4 text-center text-[12px] text-ink-300 hover:border-white/[0.18] hover:bg-white/[0.03] hover:text-ink-100"
        >
          Erste Notiz anlegen
        </button>
      ) : (
        <nav className="flex flex-col gap-0.5">
          {tree.map((n) => (
            <TreeRow
              key={n.id}
              node={n}
              depth={0}
              activePath={pathname}
              expanded={expanded}
              setExpanded={setExpanded}
            />
          ))}
        </nav>
      )}
    </aside>
  );
}

function TreeRow({
  node,
  depth,
  activePath,
  expanded,
  setExpanded,
}: {
  node: Node;
  depth: number;
  activePath: string;
  expanded: Record<string, boolean>;
  setExpanded: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const isActive = activePath === `/notes/${node.id}`;
  const isOpen = !!expanded[node.id];

  const onAddChild = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start(async () => {
      const res = await createNote({ parentNoteId: node.id });
      if (res.ok) {
        setExpanded((prev) => ({ ...prev, [node.id]: true }));
        router.push(`/notes/${res.id}`);
      }
    });
  };

  const onArchive = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Notiz archivieren?')) return;
    start(async () => {
      await archiveNote(node.id);
      if (isActive) router.push('/notes');
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col">
      <div
        className={`group flex items-center gap-1 rounded-[6px] pr-1 transition-colors ${
          isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
        }`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() =>
              setExpanded((prev) => ({ ...prev, [node.id]: !prev[node.id] }))
            }
            className="flex h-5 w-5 shrink-0 items-center justify-center text-ink-300 hover:text-ink-50"
            aria-label={isOpen ? 'Einklappen' : 'Ausklappen'}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}
        <Link
          href={`/notes/${node.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-[13px] leading-none text-ink-100"
        >
          <span className="shrink-0 text-[13px]">
            {node.icon || <span className="text-ink-300">·</span>}
          </span>
          <span className="truncate">{node.title || 'Unbenannt'}</span>
        </Link>
        <button
          type="button"
          onClick={onAddChild}
          className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-ink-300 transition-colors hover:bg-white/[0.08] hover:text-ink-50 group-hover:flex"
          aria-label="Unter-Notiz hinzufügen"
          title="Unter-Notiz hinzufügen"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-ink-300 transition-colors hover:bg-[#ff8a8a]/[0.12] hover:text-[#ff8a8a] group-hover:flex"
          aria-label="Archivieren"
          title="Archivieren"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
      {isOpen && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              expanded={expanded}
              setExpanded={setExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
