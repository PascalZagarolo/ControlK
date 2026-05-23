'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  filterSuggestionItems,
  insertOrUpdateBlock,
  type PartialBlock,
} from '@blocknote/core';
import {
  createReactBlockSpec,
  createReactInlineContentSpec,
} from '@blocknote/react';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { saveNoteDocument } from '@/lib/actions/notes';
import { createTodoFromNote, createEventFromNote } from '@/lib/actions/notes-actions';
import { EmbedRenderer } from './embeds/embed-renderer';

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

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    liveEmbed: LiveEmbed,
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
  const initialBlocks = useMemo<PartialBlock<typeof schema.blockSchema>[] | undefined>(() => {
    if (!Array.isArray(initialDocument)) return undefined;
    if (initialDocument.length === 0) return undefined;
    return initialDocument as any;
  }, [initialDocument]);

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialBlocks,
  });

  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerializedRef = useRef<string>(JSON.stringify(initialBlocks ?? []));

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
        try {
          await saveNoteDocument(noteId, blocks);
          setSavedAt(new Date());
        } finally {
          setSaving(false);
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
      {!readOnly && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-10 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          {saving
            ? 'Speichere …'
            : savedAt
              ? `Gespeichert · ${savedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : ''}
        </div>
      )}
      <style jsx global>{`
        .note-editor-shell .bn-editor {
          padding-top: 8px;
          padding-bottom: 240px;
        }
        .note-editor-shell .bn-container {
          background: transparent !important;
        }
        .note-editor-shell .bn-editor,
        .note-editor-shell .bn-editor p,
        .note-editor-shell .bn-editor li,
        .note-editor-shell .bn-editor h1,
        .note-editor-shell .bn-editor h2,
        .note-editor-shell .bn-editor h3 {
          color: #e6e7ec;
        }
        .note-editor-shell .bn-editor h1 {
          font-size: 28px;
          font-weight: 500;
          letter-spacing: -0.3px;
        }
        .note-editor-shell .bn-editor h2 {
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.2px;
        }
        .note-editor-shell .bn-editor h3 {
          font-size: 18px;
          font-weight: 500;
        }
        .note-editor-shell [data-content-type='paragraph'] {
          font-size: 14.5px;
          line-height: 1.6;
        }
        .note-editor-shell .bn-slash-menu,
        .note-editor-shell .mantine-Menu-dropdown,
        .note-editor-shell [data-mantine-styles] [class*='Popover'] {
          background: rgba(20, 21, 23, 0.96) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}
