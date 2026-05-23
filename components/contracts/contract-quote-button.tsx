'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Modal,
  ModalActions,
  ModalError,
  ModalField,
  ModalPrimary,
  ModalSecondary,
  ModalSelect,
  ModalTextarea,
} from '@/components/ui/modal';
import { postContractToChannel } from '@/lib/actions/contracts';

export function ContractQuoteButton({
  contractId,
  channels,
}: {
  contractId: string;
  channels: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [body, setBody] = useState('');

  if (channels.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 text-[12px] text-ink-200 hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-ink-50"
      >
        📎 In Channel
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        kicker="In Channel posten"
        title="Vertrag teilen"
        maxWidth={500}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await postContractToChannel({
                contractId,
                channelId,
                body: body.trim() || undefined,
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setOpen(false);
              setBody('');
              router.refresh();
            });
          }}
          className="flex flex-col gap-4"
        >
          {error && <ModalError>{error}</ModalError>}
          <ModalField label="Channel">
            <ModalSelect value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </ModalSelect>
          </ModalField>
          <ModalField label="Begleit-Nachricht (optional)">
            <ModalTextarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Anbei der finale Vertragsentwurf — bitte gegenchecken."
            />
          </ModalField>
          <ModalActions>
            <ModalSecondary onClick={() => setOpen(false)}>Abbrechen</ModalSecondary>
            <ModalPrimary pending={pending}>Posten</ModalPrimary>
          </ModalActions>
        </form>
      </Modal>
    </>
  );
}
