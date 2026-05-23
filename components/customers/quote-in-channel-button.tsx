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
import { postContractIntoChannel } from '@/lib/actions/customers';

type ContractOpt = { id: string; title: string; valueCents: number };
type ChannelOpt = { id: string; slug: string; name: string };

export function QuoteInChannelButton({
  customerId,
  contracts,
  channels,
}: {
  customerId: string;
  contracts: ContractOpt[];
  channels: ChannelOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [contractId, setContractId] = useState(contracts[0]?.id ?? '');
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [body, setBody] = useState('');

  if (contracts.length === 0 || channels.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 text-[12px] text-ink-200 transition-colors hover:border-white/[0.18] hover:bg-white/[0.05] hover:text-ink-50"
      >
        📎 In Channel posten
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        kicker="Quote in Channel"
        title="Vertrag im Channel teilen"
        maxWidth={520}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await postContractIntoChannel({
                customerId,
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
          <ModalField label="Vertrag">
            <ModalSelect value={contractId} onChange={(e) => setContractId(e.target.value)}>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.valueCents
                    ? ` · €${(c.valueCents / 100).toLocaleString('de-DE')}`
                    : ''}
                </option>
              ))}
            </ModalSelect>
          </ModalField>
          <ModalField label="Channel">
            <ModalSelect value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
            </ModalSelect>
          </ModalField>
          <ModalField
            label="Begleit-Nachricht (optional)"
            hint="Leer = automatischer Embed mit Titel + Wert"
          >
            <ModalTextarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="z.B. Anbei der finale Vertragsentwurf — bitte gegenchecken."
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
