'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { archiveNote, duplicateNote } from '@/lib/actions/notes';
import { useNoteSaveStore } from '@/lib/notes/note-save-store';

export function NoteToolbar({
  noteId,
  initialTitle,
  updatedAt,
}: {
  noteId: string;
  initialTitle: string;
  updatedAt: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Subscribe to the live title (typed into the input below) so the
  // breadcrumb updates instantly without waiting for a re-render of the
  // server component.
  const liveTitle = useNoteSaveStore((s) =>
    s.noteId === noteId ? s.title : initialTitle
  );
  const saving = useNoteSaveStore((s) => s.saving);
  const savedAt = useNoteSaveStore((s) => s.savedAt);
  const wordCount = useNoteSaveStore((s) => s.wordCount);
  const syncStatus = useNoteSaveStore((s) => s.syncStatus);

  // Close the dropdown on outside click + escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const doDuplicate = () => {
    setMenuOpen(false);
    start(async () => {
      const res = await duplicateNote(noteId);
      if (res.ok) router.push(`/notes/${res.id}`);
    });
  };

  const doArchive = () => {
    setMenuOpen(false);
    if (!confirm('Notiz archivieren?')) return;
    start(async () => {
      await archiveNote(noteId);
      router.push('/notes');
    });
  };

  // Indicator state machine, driven by the save-queue's syncStatus:
  //   synced (idle)           → dot hidden
  //   synced (just persisted) → amber dot, 800ms fade
  //   saving                  → amber dot, continuous pulse
  //   pending                 → amber dot, no pulse — debounce armed
  //   offline                 → red dot + "Offline" label, no pulse
  const lastSaveMs = savedAt ? Date.now() - savedAt.getTime() : Infinity;
  const showSavedFlash = !saving && lastSaveMs < 800;
  const indicatorVisible =
    saving || showSavedFlash || syncStatus === 'pending' || syncStatus === 'offline';
  const dotColor = syncStatus === 'offline' ? '#ff8a8a' : '#E8B86D';
  const dotTitle =
    syncStatus === 'offline'
      ? 'Offline — Änderungen sind lokal sicher und werden synchronisiert sobald du wieder online bist.'
      : syncStatus === 'pending'
        ? 'Wartet …'
        : saving
          ? 'Speichert …'
          : 'Gespeichert';

  const displayTitle = liveTitle.trim() || 'Unbenannt';

  return (
    <div className="flex h-10 items-center justify-between gap-3 border-b border-[#1F1F23]">
      {/* Left: back-link + breadcrumb title */}
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
        <Link
          href="/notes"
          className="flex items-center gap-1 text-[#A1A1AA] transition-colors hover:text-[#FAFAFA]"
        >
          <span aria-hidden>←</span>
          <span>Notizen</span>
        </Link>
        <span aria-hidden className="text-[#3F3F46]">
          ·
        </span>
        <span className="truncate text-[#E5E5E7]">{displayTitle}</span>
      </div>

      {/* Right: meta + saving indicator + context menu */}
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#52525B]">
          {formatMeta({ updatedAt, savedAt, wordCount })}
        </span>

        {syncStatus === 'offline' && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#ff8a8a]">
            Offline
          </span>
        )}

        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full transition-opacity duration-700 ${
            indicatorVisible ? 'opacity-100' : 'opacity-0'
          } ${saving ? 'animate-[notePulse_1.2s_ease-in-out_infinite]' : ''}`}
          style={{ background: dotColor }}
          title={dotTitle}
        />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Notiz-Optionen"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#71717A] transition-colors hover:bg-white/[0.05] hover:text-[#E5E5E7]"
          >
            <span aria-hidden className="text-[15px] leading-none">···</span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[180px] rounded-md border border-white/[0.08] bg-[rgba(20,21,23,0.96)] p-1 text-[13px] shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-md"
            >
              <MenuItem
                href={`/notes/${noteId}/history`}
                onSelect={() => setMenuOpen(false)}
              >
                Historie
              </MenuItem>
              <MenuItem onSelect={doDuplicate} disabled={pending}>
                Duplizieren
              </MenuItem>
              <div className="my-1 h-px bg-white/[0.05]" />
              <MenuItem
                onSelect={doArchive}
                disabled={pending}
                tone="danger"
              >
                Archivieren
              </MenuItem>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function MenuItem({
  href,
  onSelect,
  disabled,
  tone = 'default',
  children,
}: {
  href?: string;
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  const cls = `flex w-full items-center rounded-sm px-2.5 py-1.5 text-left transition-colors duration-150 disabled:opacity-40 ${
    tone === 'danger'
      ? 'text-[#ff8a8a] hover:bg-[#ff6363]/10 hover:text-[#ff9b9b]'
      : 'text-[#cdcece] hover:bg-white/[0.05] hover:text-white'
  }`;
  if (href) {
    return (
      <Link href={href} role="menuitem" onClick={onSelect} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      className={cls}
    >
      {children}
    </button>
  );
}

function formatMeta({
  updatedAt,
  savedAt,
  wordCount,
}: {
  updatedAt: string;
  savedAt: Date | null;
  wordCount: number;
}) {
  const last = savedAt ?? new Date(updatedAt);
  const diffMs = Date.now() - last.getTime();
  const min = Math.round(diffMs / 60_000);
  let rel: string;
  if (min < 1) rel = 'gerade';
  else if (min < 60) rel = `vor ${min}m`;
  else if (min < 60 * 24) rel = `vor ${Math.round(min / 60)}h`;
  else rel = last.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  const wc = wordCount === 1 ? '1 Wort' : `${wordCount} Wörter`;
  return `Zuletzt ${rel} · ${wc}`;
}
