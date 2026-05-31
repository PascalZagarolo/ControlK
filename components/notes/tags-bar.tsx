'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { addTagToNote, removeTagFromNote, type Tag } from '@/lib/actions/note-tags';
import { toast } from '@/lib/stores/toast-store';

/**
 * Inline tag editor — sits between the note title and the editor body.
 *
 * Optimistic UI: the pill appears immediately on Enter, server confirms
 * (and replaces the optimistic tag with the canonical one) shortly after.
 * If the server says no, we roll back and show a quiet error border.
 *
 * Workspace tags are pre-loaded (server prop) so autocomplete matches
 * are instant. Tags that don't yet exist in the workspace are created
 * on the fly when the user hits Enter.
 */
export function TagsBar({
  noteId,
  initialTags,
  workspaceTags,
}: {
  noteId: string;
  initialTags: Tag[];
  workspaceTags: Tag[];
}) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync on prop changes (note switch).
  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const suggestions = useMemo(() => {
    if (!draft.trim()) return [];
    const q = draft.trim().toLowerCase();
    const present = new Set(tags.map((t) => t.id));
    return workspaceTags
      .filter((t) => !present.has(t.id) && t.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [draft, tags, workspaceTags]);

  const commit = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;

    // Optimistic placeholder so the pill appears without latency.
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Tag = { id: optimisticId, name, slug: name.toLowerCase() };
    setTags((prev) => [...prev, optimistic]);
    setDraft('');

    start(async () => {
      const res = await addTagToNote(noteId, name);
      if (!res.ok) {
        // Rollback on failure — and say so, rather than letting the pill
        // vanish silently.
        setTags((prev) => prev.filter((t) => t.id !== optimisticId));
        toast(res.error || 'Tag konnte nicht gespeichert werden.', 'danger');
        return;
      }
      // Replace the optimistic row with the canonical tag (avoids
      // duplicates when the same slug is re-used).
      setTags((prev) => {
        const without = prev.filter(
          (t) => t.id !== optimisticId && t.id !== res.tag.id
        );
        return [...without, res.tag];
      });
    });
  };

  const remove = (tagId: string) => {
    const prev = tags;
    setTags((t) => t.filter((x) => x.id !== tagId));
    start(async () => {
      const res = await removeTagFromNote(noteId, tagId);
      if (!res.ok) {
        setTags(prev);
        toast(res.error || 'Tag konnte nicht entfernt werden.', 'danger');
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagPill key={t.id} tag={t} onRemove={() => remove(t.id)} />
      ))}

      {adding ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit(draft);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setAdding(false);
                setDraft('');
              } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
                // Backspace on empty input removes the last tag — terminal-style.
                remove(tags[tags.length - 1].id);
              }
            }}
            onBlur={() => {
              // Defer so a click on a suggestion lands before we collapse.
              setTimeout(() => {
                if (draft.trim()) commit(draft);
                setAdding(false);
              }, 120);
            }}
            placeholder="Tag-Name"
            className="rounded-sm border border-white/[0.08] bg-white/[0.03] px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.06em] text-[#FAFAFA] outline-none transition-colors focus:border-white/[0.18]"
            style={{ width: Math.max(110, draft.length * 8 + 40) }}
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 top-[calc(100%+4px)] z-30 flex min-w-[160px] flex-col rounded-md border border-white/[0.08] bg-[rgba(20,21,23,0.96)] p-1 shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-md">
              {suggestions.map((sug) => (
                <button
                  key={sug.id}
                  type="button"
                  // mousedown so the click registers BEFORE the input's blur
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(sug.name);
                    setAdding(false);
                  }}
                  className="rounded-sm px-2 py-1 text-left font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#A1A1AA] transition-colors hover:bg-white/[0.05] hover:text-[#FAFAFA]"
                >
                  {sug.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-sm px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.06em] text-[#52525B] transition-colors hover:bg-white/[0.04] hover:text-[#A1A1AA]"
        >
          {tags.length === 0 ? '# Tags hinzufügen' : '+'}
        </button>
      )}
    </div>
  );
}

function TagPill({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-white/[0.05] px-1.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.06em] text-[#A1A1AA]">
      <span>{tag.name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Tag ${tag.name} entfernen`}
        className="-mr-0.5 flex h-3 w-3 items-center justify-center rounded-sm text-[10px] leading-none text-[#52525B] transition-colors hover:bg-white/[0.06] hover:text-[#FAFAFA]"
      >
        ×
      </button>
    </span>
  );
}
