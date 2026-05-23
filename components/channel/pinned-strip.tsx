'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Modal,
  ModalActions,
  ModalError,
  ModalField,
  ModalInput,
  ModalPrimary,
  ModalSecondary,
  ModalSelect,
} from '@/components/ui/modal';
import { pinChannelItem, unpinChannelItem } from '@/lib/actions/channels';
import type { ChannelPinnedItem, ChannelPinnedKind } from '@/lib/types';

const ICON: Record<ChannelPinnedKind, string> = {
  contract: '§',
  customer: '◉',
  vehicle: '⊞',
  todo: '✓',
  doc: '📄',
  thread: '↳',
  link: '🔗',
};

const COLOR: Record<ChannelPinnedKind, string> = {
  contract: '#ffd96a',
  customer: '#5eb6ff',
  vehicle: '#c084fc',
  todo: '#5ee08a',
  doc: '#9c9c9d',
  thread: '#9c9c9d',
  link: '#5eb6ff',
};

function pinHref(p: ChannelPinnedItem): string {
  if (p.url) return p.url;
  if (!p.targetId) return '#';
  if (p.kind === 'contract') return `/vertraege/${p.targetId}`;
  if (p.kind === 'customer') return `/kunden/${p.targetId}`;
  if (p.kind === 'vehicle') return `/flotte/${p.targetId}`;
  if (p.kind === 'todo') return `/todos?todo=${p.targetId}`;
  return '#';
}

export function PinnedStrip({
  pinned,
  channelId,
}: {
  pinned: ChannelPinnedItem[];
  channelId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  if (pinned.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Pinned
        </span>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-full border border-dashed border-white/[0.12] px-2.5 py-1 text-[11px] text-ink-300 hover:border-white/[0.24] hover:text-ink-50"
        >
          + Pin
        </button>
        <AddPinModal open={addOpen} onClose={() => setAddOpen(false)} channelId={channelId} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        Pinned
      </span>
      {pinned.map((p) => (
        <div
          key={p.id}
          className="group inline-flex items-center gap-1 rounded-[6px] border bg-white/[0.02] px-2 py-1 text-[11.5px]"
          style={{ borderColor: `${COLOR[p.kind]}33`, color: COLOR[p.kind] }}
        >
          <Link href={pinHref(p)} className="flex items-center gap-1 hover:underline">
            <span>{ICON[p.kind]}</span>
            <span className="text-ink-100">{p.label}</span>
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm('Pin entfernen?')) return;
              start(async () => {
                await unpinChannelItem(p.id);
                router.refresh();
              });
            }}
            className="opacity-0 transition-opacity hover:text-[#ff8a8a] group-hover:opacity-100"
            aria-label="Unpin"
          >
            <span className="font-mono text-[10px] text-ink-300">×</span>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="rounded-full border border-dashed border-white/[0.12] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 hover:border-white/[0.24] hover:text-ink-50"
      >
        + Pin
      </button>
      <AddPinModal open={addOpen} onClose={() => setAddOpen(false)} channelId={channelId} />
    </div>
  );
}

function AddPinModal({
  open,
  onClose,
  channelId,
}: {
  open: boolean;
  onClose: () => void;
  channelId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} kicker="Pin" title="Item pinnen" maxWidth={460}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await pinChannelItem({
              channelId,
              kind: (String(fd.get('kind') ?? 'link') as ChannelPinnedKind) || 'link',
              label: String(fd.get('label') ?? ''),
              url: String(fd.get('url') ?? '') || undefined,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        <ModalField label="Was">
          <ModalInput name="label" required placeholder="Übergabe-Protokoll" />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Typ">
            <ModalSelect name="kind" defaultValue="link">
              <option value="link">Link</option>
              <option value="doc">Dokument</option>
              <option value="contract">Vertrag</option>
              <option value="customer">Kunde</option>
              <option value="vehicle">Fahrzeug</option>
              <option value="todo">Todo</option>
              <option value="thread">Thread</option>
            </ModalSelect>
          </ModalField>
          <ModalField label="URL (optional)">
            <ModalInput name="url" type="url" placeholder="https://…" />
          </ModalField>
        </div>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Pinnen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
