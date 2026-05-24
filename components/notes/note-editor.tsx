'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  createReactBlockSpec,
  createReactInlineContentSpec,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu as insertOrUpdateBlock,
  type PartialBlock,
} from '@blocknote/core';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { saveNoteDocument } from '@/lib/actions/notes';
import { useYjsDoc } from '@/lib/notes/use-yjs-doc';
import { createTodoFromNote, createEventFromNote } from '@/lib/actions/notes-actions';
import { useNoteSaveStore, countWordsInText } from '@/lib/notes/note-save-store';
import { EmbedRenderer } from './embeds/embed-renderer';

// Walk a BlockNote document and extract its inline text. Used to keep
// the toolbar's word count in sync with the editor without serialising
// the entire JSON tree just to count.
function extractDocumentText(blocks: unknown): string {
  let out = '';
  const visit = (nodes: unknown): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (typeof node === 'string') {
        out += node + ' ';
        continue;
      }
      if (!node || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      if (typeof n.text === 'string') out += n.text + ' ';
      if (Array.isArray(n.content)) visit(n.content);
      if (Array.isArray(n.children)) visit(n.children);
    }
  };
  visit(blocks);
  return out;
}

type MentionKind = 'customer' | 'contract' | 'vehicle' | 'channel';

const KIND_GLYPH: Record<MentionKind, string> = {
  customer: '◉',
  contract: '§',
  vehicle: '⊞',
  channel: '#',
};

const KIND_HREF = (k: MentionKind, id: string) => {
  if (k === 'customer') return `/kunden/${id}`;
  if (k === 'contract') return `/vertraege/${id}`;
  if (k === 'vehicle') return `/flotte/${id}`;
  if (k === 'channel') return `/channels/${id}`;
  return '#';
};

const Mention = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      kind: { default: 'customer' as const, values: ['customer', 'contract', 'vehicle', 'channel'] },
      id: { default: '' },
      label: { default: '' },
      status: { default: '' },
    },
    content: 'none',
  } as const,
  {
    render: (props) => {
      const { kind, id, label, status } = props.inlineContent.props as {
        kind: MentionKind;
        id: string;
        label: string;
        status: string;
      };
      return (
        <a
          href={KIND_HREF(kind, id)}
          onClick={(e) => {
            // Allow normal nav on cmd-click, etc.
            if (e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            window.location.href = KIND_HREF(kind, id);
          }}
          className="inline-flex items-center gap-1 rounded-md bg-[#5eb6ff]/[0.12] px-1.5 py-0.5 text-[13px] text-[#5eb6ff] no-underline hover:bg-[#5eb6ff]/[0.20]"
          contentEditable={false}
          data-mention-kind={kind}
          data-mention-id={id}
        >
          <span className="font-mono text-[10px] opacity-80">{KIND_GLYPH[kind]}</span>
          <span>{label}</span>
          {status && (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.3px] opacity-70">
              · {status}
            </span>
          )}
        </a>
      );
    },
  }
);

// Custom block: live workspace-data embed
const LiveEmbed = createReactBlockSpec(
  {
    type: 'liveEmbed',
    propSchema: {
      kind: {
        default: 'brief' as const,
        values: ['brief', 'pipeline', 'fleet'],
      },
    },
    content: 'none',
  } as const,
  {
    render: (props) => {
      const kind = (props.block.props as any).kind as 'brief' | 'pipeline' | 'fleet';
      return <EmbedRenderer kind={kind} />;
    },
  }
);

// createReactBlockSpec returns a factory in this BlockNote version — call it
// with no options to materialize the BlockSpec for BlockNoteSchema.create.
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    liveEmbed: LiveEmbed(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: Mention,
  },
});

type Props = {
  noteId: string;
  initialDocument: unknown;
  readOnly?: boolean;
  workspaceScope?: 'business' | 'private';
};

export function NoteEditor({ noteId, initialDocument, readOnly, workspaceScope = 'business' }: Props) {
  const router = useRouter();

  // Local-first foundation: Yjs doc + IndexedDB persistence per note.
  // The fragment is BlockNote's collaboration target — see useYjsDoc.
  const { fragment, ready: yjsReady } = useYjsDoc(noteId);

  const initialBlocks = useMemo<PartialBlock<typeof schema.blockSchema>[] | undefined>(() => {
    if (!Array.isArray(initialDocument)) return undefined;
    if (initialDocument.length === 0) return undefined;
    return initialDocument as any;
  }, [initialDocument]);

  /**
   * Uploads files (image paste/drop) to our /api/notes/upload endpoint, which
   * wraps Vercel Blob. BlockNote calls this transparently when the user
   * inserts an image. If BLOB is not configured (503), the call rejects and
   * the editor shows its built-in error state.
   */
  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/notes/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`upload-failed-${res.status}`);
    const data = await res.json();
    if (!data?.url) throw new Error('upload-no-url');
    return data.url as string;
  };

  // With `collaboration`, BlockNote takes the Yjs fragment as the source of
  // truth — `initialContent` cannot be passed. We bootstrap server content
  // into the empty fragment AFTER IndexedDB has hydrated, see effect below.
  const editor = useCreateBlockNote({
    schema,
    uploadFile,
    collaboration: {
      fragment,
      user: { name: 'Pascal', color: '#5eb6ff' },
    },
  });

  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef<string>(JSON.stringify(initialBlocks ?? []));
  const hydratedRef = useRef(false);

  // Push save state + word count into the shared store so the toolbar
  // can render the pulse indicator and the "X Wörter" counter without
  // a prop chain. The store is keyed implicitly by noteId via the
  // titleInput's hydrate() — we just write the current values.
  const storeSetSaving = useNoteSaveStore((s) => s.setSaving);
  const storeSetSavedAt = useNoteSaveStore((s) => s.setSavedAt);
  const storeSetWordCount = useNoteSaveStore((s) => s.setWordCount);

  // Seed the initial word count on mount so the toolbar isn't stuck on
  // "0 Wörter" for an existing non-empty note before the first edit.
  useEffect(() => {
    storeSetWordCount(countWordsInText(extractDocumentText(initialDocument)));
  }, [initialDocument, storeSetWordCount]);

  // Bootstrap server content into the Yjs fragment if and only if:
  //   1. IndexedDB has finished hydrating (yjsReady)
  //   2. The fragment is still empty (nothing in IndexedDB for this note)
  //   3. We haven't already hydrated this mount (prevent double-apply)
  //   4. The server has actual content
  // Otherwise IndexedDB or fresh-empty wins.
  useEffect(() => {
    if (!yjsReady || hydratedRef.current || readOnly) return;
    if (!initialBlocks || initialBlocks.length === 0) {
      hydratedRef.current = true;
      return;
    }
    const currentBlocks = editor.document;
    const isEmpty =
      currentBlocks.length === 0 ||
      (currentBlocks.length === 1 &&
        currentBlocks[0].type === 'paragraph' &&
        (!('content' in currentBlocks[0]) ||
          (currentBlocks[0] as any).content?.length === 0 ||
          (currentBlocks[0] as any).content?.[0]?.text === ''));
    if (isEmpty) {
      try {
        editor.replaceBlocks(editor.document, initialBlocks as any);
      } catch (e) {
        console.error('[note-editor] failed to hydrate initial content', e);
      }
    }
    hydratedRef.current = true;
  }, [yjsReady, initialBlocks, editor, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const off = editor.onChange(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const blocks = editor.document;
        const next = JSON.stringify(blocks);
        if (next === lastSerializedRef.current) return;
        lastSerializedRef.current = next;
        setSaving(true);
        storeSetSaving(true);
        try {
          await saveNoteDocument(noteId, blocks);
          const now = new Date();
          setSavedAt(now);
          storeSetSavedAt(now);
          storeSetWordCount(countWordsInText(extractDocumentText(blocks)));
        } catch (e) {
          // Offline / server unreachable — document is safe in IndexedDB,
          // we'll retry on the next change. No alert to avoid being noisy.
          console.warn('[note-editor] save failed (will retry on next edit)', e);
        } finally {
          setSaving(false);
          storeSetSaving(false);
        }
      }, 800);
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeof off === 'function') off();
    };
  }, [editor, noteId, readOnly]);

  /**
   * @-mention suggestion menu. Fetches workspace candidates from
   * /api/notes/mentions/search, returns DefaultReactSuggestionItems that
   * insert a 'mention' inline content with the chosen entity.
   */
  const getMentionItems = async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    try {
      const res = await fetch(
        `/api/notes/mentions/search?q=${encodeURIComponent(query ?? '')}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];
      return hits.map<DefaultReactSuggestionItem>((h) => ({
        title: h.label,
        subtext: h.subtitle,
        group: h.kind === 'customer' ? 'Kunden' : h.kind === 'contract' ? 'Verträge' : h.kind === 'vehicle' ? 'Flotte' : 'Channels',
        icon: <span className="font-mono text-[12px]">{KIND_GLYPH[h.kind as MentionKind] ?? '·'}</span>,
        onItemClick: () => {
          editor.insertInlineContent([
            {
              type: 'mention',
              props: {
                kind: h.kind,
                id: h.id,
                label: h.label,
                status: h.status ?? '',
              },
            } as any,
            ' ',
          ]);
        },
      }));
    } catch {
      return [];
    }
  };

  /**
   * Extends the default slash-menu with uRent-specific actions:
   *   - /embed-brief, /embed-pipeline, /embed-fleet  → insert live-data blocks
   *   - /todo                                         → spawn a workspace todo
   *   - /event                                        → spawn a calendar event
   *
   * Business-scope-only items are hidden when the workspace is private.
   */
  const getSlashItems = (query: string): DefaultReactSuggestionItem[] => {
    const items: DefaultReactSuggestionItem[] = [
      ...getDefaultReactSlashMenuItems(editor as any),
    ];

    items.push({
      title: 'Live: Daily Brief',
      onItemClick: () => {
        insertOrUpdateBlock(editor as any, {
          type: 'liveEmbed',
          props: { kind: 'brief' },
        } as any);
      },
      subtext: 'Heutiger Brief, immer live',
      aliases: ['embed-brief', 'brief', 'daily'],
      group: 'Live-Embeds',
      icon: <span className="font-mono text-[14px]">⌬</span>,
    });
    if (workspaceScope === 'business') {
      items.push({
        title: 'Live: Sales Pipeline',
        onItemClick: () => {
          insertOrUpdateBlock(editor as any, {
            type: 'liveEmbed',
            props: { kind: 'pipeline' },
          } as any);
        },
        subtext: 'Kunden nach Status',
        aliases: ['embed-pipeline', 'pipeline', 'sales'],
        group: 'Live-Embeds',
        icon: <span className="font-mono text-[14px]">⌬</span>,
      });
      items.push({
        title: 'Live: Flotten-Status',
        onItemClick: () => {
          insertOrUpdateBlock(editor as any, {
            type: 'liveEmbed',
            props: { kind: 'fleet' },
          } as any);
        },
        subtext: '7-Tage-Auslastung mit Markup',
        aliases: ['embed-fleet', 'fleet', 'flotte'],
        group: 'Live-Embeds',
        icon: <span className="font-mono text-[14px]">⌬</span>,
      });
    }
    items.push({
      title: 'Todo aus Notiz erstellen',
      onItemClick: () => {
        const title = window.prompt('Todo-Titel?')?.trim();
        if (!title) return;
        (async () => {
          const res = await createTodoFromNote({ noteId, title });
          if (res.ok) {
            editor.insertInlineContent([
              {
                type: 'mention',
                props: { kind: 'channel', id: res.id, label: `Todo: ${title}`, status: 'offen' },
              } as any,
              ' ',
            ]);
            router.refresh();
          }
        })();
      },
      subtext: 'Erstellt Todo in dieser Workspace, linkt zurück',
      aliases: ['todo', 'task', 'aufgabe'],
      group: 'Aktionen',
      icon: <span className="font-mono text-[14px]">☐</span>,
    });
    items.push({
      title: 'Voice → Text',
      onItemClick: () => {
        const SR =
          (typeof window !== 'undefined' &&
            ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
          null;
        if (!SR) {
          alert('Voice-Capture wird in diesem Browser nicht unterstützt (Chrome/Edge benötigt).');
          return;
        }
        const rec = new SR();
        rec.lang = 'de-DE';
        rec.interimResults = false;
        rec.continuous = false;
        rec.onresult = (e: any) => {
          const text = String(e.results?.[0]?.[0]?.transcript ?? '').trim();
          if (text) {
            insertOrUpdateBlock(editor as any, {
              type: 'paragraph',
              content: [{ type: 'text', text, styles: {} }],
            } as any);
          }
        };
        rec.onerror = () => {};
        try {
          rec.start();
        } catch {}
      },
      subtext: 'Spricht, transkribiert, fügt als Absatz ein',
      aliases: ['voice', 'mic', 'diktat'],
      group: 'Aktionen',
      icon: <span className="font-mono text-[14px]">🎙</span>,
    });
    items.push({
      title: 'Termin erstellen',
      onItemClick: () => {
        const title = window.prompt('Termin-Titel?')?.trim();
        if (!title) return;
        const dateStr = window.prompt('Datum (z.B. 2026-06-14 15:00)?', '');
        const startsAt = dateStr && !isNaN(new Date(dateStr).getTime())
          ? new Date(dateStr).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        (async () => {
          const res = await createEventFromNote({ noteId, title, startsAt });
          if (res.ok) router.refresh();
        })();
      },
      subtext: 'Erstellt Calendar-Event und linkt zurück',
      aliases: ['event', 'termin', 'meeting'],
      group: 'Aktionen',
      icon: <span className="font-mono text-[14px]">◷</span>,
    });

    return filterSuggestionItems(items, query);
  };

  return (
    <div className="note-editor-shell">
      <BlockNoteView editor={editor} editable={!readOnly} theme="dark" slashMenu={false}>
        {!readOnly && (
          <>
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => getSlashItems(query)}
            />
            <SuggestionMenuController
              triggerCharacter="@"
              getItems={async (query) => filterSuggestionItems(await getMentionItems(query), query)}
            />
          </>
        )}
      </BlockNoteView>
      <style jsx global>{`
        /* ── Notes editor: iA-Writer flat-canvas treatment ──────────────
         * The defaults from @blocknote/mantine assume a "panel" shell with
         * borders, hover handles, and drag affordances. We strip all of
         * that so the editor disappears into the canvas — what's left is
         * just text with our typography.
         */
        .note-editor-shell .bn-container,
        .note-editor-shell .bn-editor,
        .note-editor-shell [data-content-type] {
          background: transparent !important;
          box-shadow: none !important;
          border: 0 !important;
          border-radius: 0 !important;
        }
        .note-editor-shell .bn-editor {
          padding-top: 0;
          padding-bottom: 240px;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        /* Kill the per-block hover chrome: drag handle, "+" insert, the
         * whole side-control gutter that Notion-style editors render. */
        .note-editor-shell .bn-side-menu,
        .note-editor-shell .bn-block-side-menu,
        .note-editor-shell [class*='SideMenu'],
        .note-editor-shell [class*='blockSideMenu'],
        .note-editor-shell [data-popper-placement][role='tooltip'] {
          display: none !important;
        }

        /* Typography: 15px / 1.7 / #D4D4D8 Geist Sans on body paragraphs.
         * Headings stay tighter for visual rhythm. */
        .note-editor-shell .bn-editor,
        .note-editor-shell [data-content-type='paragraph'],
        .note-editor-shell [data-content-type='bulletListItem'],
        .note-editor-shell [data-content-type='numberedListItem'],
        .note-editor-shell [data-content-type='checkListItem'] {
          font-family: var(--font-inter), -apple-system, BlinkMacSystemFont,
            'Segoe UI', system-ui, sans-serif;
          font-size: 15px;
          line-height: 1.7;
          color: #d4d4d8;
          letter-spacing: -0.005em;
        }
        .note-editor-shell h1,
        .note-editor-shell h2,
        .note-editor-shell h3,
        .note-editor-shell .bn-editor h1,
        .note-editor-shell .bn-editor h2,
        .note-editor-shell .bn-editor h3 {
          color: #fafafa;
          font-weight: 500;
          letter-spacing: -0.02em;
          line-height: 1.3;
        }
        .note-editor-shell .bn-editor h1 { font-size: 24px; }
        .note-editor-shell .bn-editor h2 { font-size: 20px; }
        .note-editor-shell .bn-editor h3 { font-size: 16px; }

        /* Inline accents */
        .note-editor-shell code {
          font-family: var(--font-jetbrains-mono), ui-monospace, Menlo, monospace !important;
          font-size: 0.92em;
          background: rgba(255, 255, 255, 0.05);
          padding: 1px 5px;
          border-radius: 4px;
          color: #fafafa;
        }
        .note-editor-shell pre,
        .note-editor-shell [data-content-type='codeBlock'] {
          font-family: var(--font-jetbrains-mono), ui-monospace, Menlo, monospace !important;
          background: rgba(255, 255, 255, 0.03) !important;
          border-left: 2px solid #1f1f23 !important;
          color: #e5e5e7 !important;
          font-size: 13px !important;
          padding: 12px 16px !important;
        }
        .note-editor-shell blockquote,
        .note-editor-shell [data-content-type='blockquote'] {
          border-left: 2px solid #1f1f23 !important;
          padding-left: 16px !important;
          color: #a1a1aa !important;
          font-style: normal !important;
        }
        .note-editor-shell a {
          color: #e8b86d !important;
          text-decoration: underline;
          text-decoration-color: rgba(232, 184, 109, 0.3);
          text-underline-offset: 2px;
        }
        .note-editor-shell hr {
          border: 0 !important;
          border-top: 1px solid #1f1f23 !important;
          margin: 24px 0 !important;
        }

        /* Custom placeholder — "Schreib drauf los." on the first empty
         * paragraph, no Mantine default. */
        .note-editor-shell .bn-editor [data-content-type='paragraph']:first-child:empty::before,
        .note-editor-shell .bn-editor [data-content-type='paragraph'].is-empty:first-child::before {
          content: 'Schreib drauf los.';
          color: #52525b;
          font-style: italic;
          pointer-events: none;
        }

        /* Slash menu + mention popover */
        .note-editor-shell .bn-slash-menu,
        .note-editor-shell .mantine-Menu-dropdown,
        .note-editor-shell [data-mantine-styles] [class*='Popover'] {
          background: rgba(20, 21, 23, 0.96) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          backdrop-filter: blur(12px);
          color: #e5e5e7 !important;
        }
      `}</style>
    </div>
  );
}
