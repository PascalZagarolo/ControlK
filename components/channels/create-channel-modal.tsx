'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Modal,
  ModalActions,
  ModalError,
  ModalField,
  ModalInput,
  ModalPrimary,
  ModalSecondary,
  ModalTextarea,
} from '@/components/ui/modal';
import { createChannel } from '@/lib/actions/channels';

export function CreateChannelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} kicker="Neuer Channel" title="Channel erstellen">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          start(async () => {
            const res = await createChannel(data);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            router.push(`/channels/${res.slug}`);
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        <ModalField label="Name" hint="z.B. sales-pipeline, ops-fleet">
          <ModalInput
            name="name"
            required
            autoFocus
            placeholder="channel-name"
            maxLength={60}
          />
        </ModalField>
        <ModalField label="Topic (optional)" hint="Worüber wird hier gesprochen?">
          <ModalTextarea name="topic" rows={2} placeholder="Vertriebs-Updates, Pipeline-Reviews …" />
        </ModalField>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Channel erstellen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
