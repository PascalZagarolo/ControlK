import Link from 'next/link';
import type { NoteOverviewItem } from '@/lib/types';
import type { PreviewBlock } from '@/lib/db/queries/notes';
import { NewNoteButton } from './new-note-button';
import {
  NoteTemplatesGallery,
  type NoteTemplateMeta,
} from '@/components/notes/note-templates-gallery';

// Right pane click target — wrapping the preview in a Link means the
// whole card is clickable to open the editor.
function OpenInEditorLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Link
      href={`/notes/${id}`}
      className="group block cursor-pointer rounded-lg px-1 transition-colors hover:bg-white/[0.015]"
    >
      {children}
    </Link>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `vor ${hr}h`;
  const d = Math.round(hr / 24);
  if (d < 30) return `vor ${d}d`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

export function NotesOverview({
  items,
  selectedId,
  previewBlocks,
  templates = [],
}: {
  items: NoteOverviewItem[];
  selectedId: string | null;
  previewBlocks: PreviewBlock[];
  templates?: NoteTemplateMeta[];
}) {
  // Resolve the active note. If no selection (or selection points at a
  // note that's been deleted/archived since the link was generated),
  // fall back to the first row so the preview pane never sits empty
  // when content is available.
  const active =
    items.find((n) => n.id === selectedId) ??
    (selectedId === null ? items[0] : undefined);
  const latest = items[0];

  return (
    <div className="mx-auto flex h-[calc(100vh-160px)] w-full max-w-[1200px] flex-col px-4 pt-28 md:px-6">
      {/* Module header */}
      <header className="flex items-end justify-between gap-4 pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#52525B]">
            Notizen
          </span>
          <p className="text-[13px] text-[#A1A1AA]">
            {items.length} {items.length === 1 ? 'Notiz' : 'Notizen'}
            {latest && (
              <>
                {' '}
                <span className="text-[#3F3F46]">·</span>{' '}
                <span>zuletzt {formatRelative(latest.updatedAt)}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NoteTemplatesGallery templates={templates} />
          <NewNoteButton />
        </div>
      </header>

      {/* Two-column area */}
      <div className="flex min-h-0 flex-1 gap-6 border-t border-white/[0.04] pt-2">
        {/* List */}
        <aside className="w-[320px] shrink-0 overflow-y-auto py-2 pr-1">
          <ul className="flex flex-col gap-0.5">
            {items.map((n) => {
              const isActive = active?.id === n.id;
              return (
                <li key={n.id}>
                  <Link
                    href={`/notes?n=${n.id}`}
                    scroll={false}
                    className={`block rounded-md border-l-2 px-3 py-2.5 transition-colors duration-150 ${
                      isActive
                        ? 'border-l-[#E8B86D] bg-[rgba(232,184,109,0.07)]'
                        : 'border-l-transparent hover:bg-white/[0.025]'
                    }`}
                  >
                    <div className="flex items-baseline gap-1.5">
                      {n.icon && (
                        <span aria-hidden className="text-[12px] leading-none">
                          {n.icon}
                        </span>
                      )}
                      <span
                        className={`flex-1 truncate text-[13.5px] font-medium leading-tight ${
                          isActive ? 'text-[#FAFAFA]' : 'text-[#E5E5E7]'
                        }`}
                      >
                        {n.title || 'Unbenannt'}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-[1.5] text-[#71717A]">
                      {n.isEmpty ? <span className="italic">Leer</span> : n.excerpt}
                    </p>
                    <p className="mt-1.5 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
                      {n.parentTitle && (
                        <>
                          <span>↳ {n.parentTitle}</span>
                          <span className="mx-1.5 text-[#3F3F46]">·</span>
                        </>
                      )}
                      <span>{formatRelative(n.updatedAt)}</span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Preview */}
        <section className="min-w-0 flex-1 overflow-y-auto py-2">
          {active ? (
            <OpenInEditorLink id={active.id}>
              <div className="mx-auto max-w-[640px] px-2 py-4">
                <header className="mb-6 flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#52525B]">
                    Vorschau
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B] transition-colors group-hover:text-[#E8B86D]">
                    Öffnen →
                  </span>
                </header>
                <div className="flex items-baseline gap-2.5">
                  {active.icon && (
                    <span aria-hidden className="text-[22px] leading-none">
                      {active.icon}
                    </span>
                  )}
                  <h1 className="text-[26px] font-medium leading-tight tracking-[-0.02em] text-[#FAFAFA]">
                    {active.title || 'Unbenannt'}
                  </h1>
                </div>
                <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#52525B]">
                  {active.parentTitle && (
                    <>
                      <span>↳ {active.parentTitle}</span>
                      <span className="mx-1.5 text-[#3F3F46]">·</span>
                    </>
                  )}
                  <span>zuletzt {formatRelative(active.updatedAt)}</span>
                </p>
                {active.isEmpty || previewBlocks.length === 0 ? (
                  <p className="mt-10 text-[14px] italic leading-[1.7] text-[#52525B]">
                    Diese Notiz ist leer. Klick auf "Öffnen", um zu schreiben.
                  </p>
                ) : (
                  <div className="mt-8 flex flex-col gap-3">
                    {previewBlocks.map((b, i) => (
                      <PreviewBlockNode key={i} block={b} />
                    ))}
                  </div>
                )}
              </div>
            </OpenInEditorLink>
          ) : (
            <NoSelectionPlaceholder />
          )}
        </section>
      </div>
    </div>
  );
}

// Per-block preview renderer. Keeps the same typography vocabulary as
// the editor itself (15/1.7 #D4D4D8 body, headings tight #FAFAFA) so
// what you see in the preview matches what you wrote.
function PreviewBlockNode({ block }: { block: PreviewBlock }) {
  const baseProse = 'text-[15px] leading-[1.7] text-[#D4D4D8] letter-spacing-[-0.005em]';
  switch (block.kind) {
    case 'heading': {
      const size = block.level === 1 ? 'text-[22px]' : block.level === 2 ? 'text-[18px]' : 'text-[15px]';
      return (
        <h3 className={`${size} font-medium leading-tight tracking-[-0.02em] text-[#FAFAFA]`}>
          {block.text}
        </h3>
      );
    }
    case 'bullet':
      return (
        <div className="flex gap-2.5">
          <span aria-hidden className="mt-[10px] h-[3px] w-[3px] shrink-0 rounded-full bg-[#71717A]" />
          <p className={baseProse}>{block.text}</p>
        </div>
      );
    case 'numbered':
      return (
        <div className="flex gap-2.5">
          <span className="mt-[1px] shrink-0 font-mono text-[13px] text-[#71717A]">
            {block.index}.
          </span>
          <p className={baseProse}>{block.text}</p>
        </div>
      );
    case 'check':
      return (
        <div className="flex items-baseline gap-2.5">
          <span
            aria-hidden
            className={`mt-[3px] inline-flex h-[12px] w-[12px] shrink-0 items-center justify-center rounded-sm border ${
              block.checked
                ? 'border-[#E8B86D] bg-[#E8B86D]'
                : 'border-[#3F3F46] bg-transparent'
            }`}
          >
            {block.checked && (
              <span className="text-[9px] leading-none text-[#0A0A0C]">✓</span>
            )}
          </span>
          <p
            className={`${baseProse} ${
              block.checked ? 'text-[#71717A] line-through' : ''
            }`}
          >
            {block.text}
          </p>
        </div>
      );
    case 'quote':
      return (
        <blockquote className={`${baseProse} border-l-2 border-[#1F1F23] pl-4 text-[#A1A1AA]`}>
          {block.text}
        </blockquote>
      );
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-sm border-l-2 border-[#1F1F23] bg-white/[0.03] px-4 py-3 font-mono text-[12.5px] leading-[1.6] text-[#E5E5E7]">
          {block.text}
        </pre>
      );
    case 'divider':
      return <hr className="my-2 border-0 border-t border-[#1F1F23]" />;
    case 'paragraph':
    default:
      return <p className={baseProse}>{block.text}</p>;
  }
}

function NoSelectionPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <p className="max-w-[280px] text-[14px] leading-[1.6] text-[#71717A]">
        Wähle eine Notiz links —
        <br />
        oder fang neu an.
      </p>
      <NewNoteButton />
    </div>
  );
}
