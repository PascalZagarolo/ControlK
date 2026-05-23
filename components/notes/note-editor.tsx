'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import {
  BlockNoteSchema,
  defaultInlineContentSpecs,
  filterSuggestionItems,
  type PartialBlock,
} from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { saveNoteDocument } from '@/lib/actions/notes';

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

const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: Mention,
  },
});

type Props = {
  noteId: string;
  initialDocument: unknown;
  readOnly?: boolean;
};

export function NoteEditor({ noteId, initialDocument, readOnly }: Props) {
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

  return (
    <div className="note-editor-shell">
      <BlockNoteView editor={editor} editable={!readOnly} theme="dark" slashMenu>
        {!readOnly && (
          <SuggestionMenuController
            triggerCharacter={'@'}
            getItems={async (query) => filterSuggestionItems(await getMentionItems(query), query)}
          />
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
