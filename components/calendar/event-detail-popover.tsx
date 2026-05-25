'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ExternalLink, MapPin, Plus, X } from 'lucide-react';
import {
  addEventTag,
  loadEventDetail,
  removeEventTag,
  updateEventNote,
  updateEventStatus,
  type EventDetailLoad,
  type ExternalEventStatus,
  type Tag,
} from '@/lib/actions/event-metadata';
import type { ExternalEvent } from '@/lib/db/queries/external-calendar';

const STATUS_OPTIONS: Array<{ value: ExternalEventStatus; label: string; dot: string }> = [
  { value: null, label: 'Kein Status', dot: 'transparent' },
  { value: 'prep_needed', label: 'Vorbereitung nötig', dot: '#E8B86D' },
  { value: 'prepared', label: 'Vorbereitet', dot: '#5FCFA8' },
  { value: 'follow_up_due', label: 'Nachverfolgung offen', dot: '#FF8A5C' },
  { value: 'completed', label: 'Abgeschlossen', dot: '#52525B' },
];

export function EventDetailPopover({
  event,
  anchor,
  onClose,
}: {
  event: ExternalEvent;
  anchor: { top: number; left: number; right: number; height: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<EventDetailLoad | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Click-outside + Escape
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await loadEventDetail(event.id);
      if (cancelled) return;
      if (res.ok) setData(res);
      else setLoadError(res.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  // Position: try right of the anchor; if it would clip the viewport
  // we flip left. Same for vertical.
  const POPOVER_W = 360;
  const POPOVER_H = 520;
  const GAP = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = anchor.right + GAP;
  if (left + POPOVER_W > vw - 16) left = Math.max(16, anchor.left - GAP - POPOVER_W);
  let top = anchor.top;
  if (top + POPOVER_H > vh - 16) top = Math.max(16, vh - 16 - POPOVER_H);

  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const isRecurring = !!event.recurrenceRule || !!event.googleRecurringEventId;
  const googleHtmlLink = `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(event.googleEventId)}`;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Termin-Details"
      className="fixed z-50 flex w-[360px] origin-top-left flex-col gap-3 rounded-[10px] border border-[#1F1F23] bg-[#161618] p-4 shadow-[0_8px_28px_rgba(0,0,0,0.5)]"
      style={{ top, left, maxHeight: POPOVER_H }}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-[15px] font-medium leading-tight text-[#FAFAFA]">
          {event.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-300 hover:bg-white/[0.05] hover:text-ink-50"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Time + location (Google data) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2 text-[12.5px] text-ink-200">
          <Clock size={13} strokeWidth={1.75} className="mt-[1px] shrink-0 text-ink-300" />
          <span>{formatTimeRange(start, end, event.isAllDay)}</span>
        </div>
        {event.location && (
          <div className="flex items-start gap-2 text-[12.5px] text-ink-200">
            <MapPin size={13} strokeWidth={1.75} className="mt-[1px] shrink-0 text-ink-300" />
            <span className="min-w-0 break-words">{event.location}</span>
          </div>
        )}
        {isRecurring && (
          <p className="text-[11px] italic text-ink-300">
            Wiederkehrender Termin — Bearbeitung in Google Calendar.
          </p>
        )}
      </div>

      {/* Attendees */}
      {event.attendees.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
            Teilnehmer · {event.attendees.length}
          </p>
          <ul className="flex flex-col gap-0.5">
            {event.attendees.slice(0, 5).map((a) => (
              <li key={a.email} className="text-[12px] text-ink-100">
                {a.name ?? a.email}
                {a.isOrganizer && (
                  <span className="ml-1.5 font-mono text-[10px] text-[#E8B86D]">
                    Organisator
                  </span>
                )}
              </li>
            ))}
            {event.attendees.length > 5 && (
              <li className="text-[11px] text-ink-300">
                +{event.attendees.length - 5} weitere
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Description (Google) */}
      {event.description && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
            Beschreibung · von Google
          </p>
          <p className="whitespace-pre-line text-[12.5px] leading-[1.55] text-ink-200">
            {event.description}
          </p>
        </div>
      )}

      <div className="h-px bg-[#1F1F23]" />

      {/* Ctrl K metadata */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loadError && (
          <p className="text-[11px] text-[#ff8a8a]">{loadError}</p>
        )}
        {!loadError && !data && (
          <p className="text-[11px] italic text-ink-300">Lade Ctrl K Metadaten …</p>
        )}
        {data && (
          <div className="flex flex-col gap-4">
            <NoteSection eventId={event.id} initial={data.noteMarkdown} />
            <TagsSection
              eventId={event.id}
              initial={data.tags}
              workspaceTags={data.workspaceTags}
            />
            <StatusSection eventId={event.id} initial={data.status} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#1F1F23] pt-3">
        <a
          href={googleHtmlLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 transition-colors hover:border-white/[0.16] hover:text-ink-50"
        >
          <ExternalLink size={12} strokeWidth={1.75} />
          <span>Google Calendar</span>
        </a>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
function NoteSection({
  eventId,
  initial,
}: {
  eventId: string;
  initial: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save 500ms after last keystroke
  useEffect(() => {
    if (!editing) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      setSaving(true);
      startTransition(async () => {
        await updateEventNote(eventId, value);
        setSaving(false);
        router.refresh();
      });
    }, 500);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editing]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
          Deine Notiz zum Termin
        </p>
        {saving && (
          <span
            aria-label="Speichert"
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E8B86D]"
          />
        )}
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setEditing(false)}
          placeholder="Schreibe hier …"
          rows={4}
          className="w-full resize-y rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-[12.5px] leading-[1.55] text-ink-50 outline-none focus:border-white/[0.16]"
        />
      ) : value ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full whitespace-pre-line rounded-md border border-transparent px-2 py-1.5 text-left text-[12.5px] leading-[1.55] text-ink-100 transition-colors hover:bg-white/[0.025]"
        >
          {value}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-md border border-dashed border-white/[0.10] px-2 py-1.5 text-left text-[12px] italic text-ink-300 transition-colors hover:border-white/[0.20] hover:text-ink-200"
        >
          Klicken zum Hinzufügen …
        </button>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
function TagsSection({
  eventId,
  initial,
  workspaceTags,
}: {
  eventId: string;
  initial: Tag[];
  workspaceTags: Tag[];
}) {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>(initial);
  const [pendingTagIds, setPendingTagIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const onAdd = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    // Optimistic: drop a placeholder pill so the UI feels instant.
    const tempId = `temp-${name}`;
    const optimistic: Tag = { id: tempId, name, slug: name.toLowerCase(), color: null };
    setTags((t) => (t.some((x) => x.slug === optimistic.slug) ? t : [...t, optimistic]));
    setDraft('');
    setAdding(false);
    start(async () => {
      const res = await addEventTag(eventId, name);
      if (res.ok) {
        setTags((t) => {
          // Drop the temp + canonical may already be there
          const without = t.filter((x) => x.id !== tempId);
          if (without.some((x) => x.id === res.tag.id)) return without;
          return [...without, res.tag];
        });
        router.refresh();
      } else {
        setTags((t) => t.filter((x) => x.id !== tempId));
      }
    });
  };

  const onRemove = (tag: Tag) => {
    if (tag.id.startsWith('temp-')) {
      setTags((t) => t.filter((x) => x.id !== tag.id));
      return;
    }
    setPendingTagIds((s) => new Set(s).add(tag.id));
    start(async () => {
      const res = await removeEventTag(eventId, tag.id);
      if (res.ok) {
        setTags((t) => t.filter((x) => x.id !== tag.id));
        router.refresh();
      }
      setPendingTagIds((s) => {
        const next = new Set(s);
        next.delete(tag.id);
        return next;
      });
    });
  };

  const filteredSuggestions =
    draft.trim().length > 0
      ? workspaceTags
          .filter((t) =>
            t.name.toLowerCase().includes(draft.toLowerCase().trim())
          )
          .filter((t) => !tags.some((x) => x.slug === t.slug))
          .slice(0, 5)
      : [];

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
        Tags
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            className={`inline-flex items-center gap-1 rounded-full bg-[#E8B86D]/[0.14] px-2 py-0.5 text-[11px] text-[#E8B86D] ${
              pendingTagIds.has(t.id) ? 'opacity-50' : ''
            }`}
          >
            #{t.name}
            <button
              type="button"
              onClick={() => onRemove(t)}
              aria-label={`Tag ${t.name} entfernen`}
              className="text-[#E8B86D]/60 hover:text-[#E8B86D]"
            >
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <div className="relative">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAdd(draft);
                } else if (e.key === 'Escape') {
                  setAdding(false);
                  setDraft('');
                }
              }}
              onBlur={() => {
                // Defer so click on suggestion can register before blur closes
                setTimeout(() => {
                  if (draft.trim()) onAdd(draft);
                  else setAdding(false);
                }, 120);
              }}
              placeholder="tag-name"
              className="w-28 rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-ink-50 outline-none placeholder:text-ink-300 focus:bg-white/[0.07]"
            />
            {filteredSuggestions.length > 0 && (
              <div className="absolute left-0 top-[26px] z-10 flex w-44 flex-col rounded-md border border-[#1F1F23] bg-[#0E0E11] py-1 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
                {filteredSuggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onAdd(t.name);
                    }}
                    className="px-2 py-1 text-left text-[11.5px] text-ink-100 hover:bg-white/[0.04]"
                  >
                    #{t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-white/[0.12] px-2 py-0.5 text-[11px] text-ink-300 transition-colors hover:border-white/[0.24] hover:text-ink-100"
          >
            <Plus size={10} strokeWidth={2} />
            <span>Tag</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
function StatusSection({
  eventId,
  initial,
}: {
  eventId: string;
  initial: ExternalEventStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ExternalEventStatus>(initial);
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];

  const onPick = (val: ExternalEventStatus) => {
    setStatus(val);
    setOpen(false);
    start(async () => {
      await updateEventStatus(eventId, val);
      router.refresh();
    });
  };

  return (
    <div ref={ref} className="flex flex-col gap-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
        Status
      </p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[12px] text-ink-100 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
        >
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: current.dot }}
          />
          <span>{current.label}</span>
        </button>
        {open && (
          <div className="absolute left-0 top-[30px] z-10 flex w-48 flex-col rounded-md border border-[#1F1F23] bg-[#0E0E11] py-1 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => onPick(opt.value)}
                className={`flex items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-white/[0.04] ${
                  opt.value === status ? 'text-[#FAFAFA]' : 'text-ink-200'
                }`}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: opt.dot }}
                />
                <span>{opt.label}</span>
                {opt.value === status && (
                  <span className="ml-auto font-mono text-[10px] text-ink-300">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
function formatTimeRange(start: Date, end: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return start.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    }) + ' · Ganztägig';
  }
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const dayPart = start.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  const fmt = (d: Date) =>
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) {
    return `${dayPart} · ${fmt(start)} – ${fmt(end)}`;
  }
  const endDay = end.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  return `${dayPart} ${fmt(start)} – ${endDay} ${fmt(end)}`;
}
