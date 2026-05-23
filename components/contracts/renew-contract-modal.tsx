'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Modal,
  ModalActions,
  ModalError,
  ModalField,
  ModalInput,
  ModalPrimary,
  ModalSecondary,
} from '@/components/ui/modal';
import { renewContract } from '@/lib/actions/contracts';

export function RenewContractModal({
  open,
  onClose,
  contractId,
  contractTitle,
  originalEndIso,
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  contractTitle: string;
  originalEndIso?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    if (open) {
      setMonths(12);
      setError(null);
    }
  }, [open]);

  const previewStart = originalEndIso
    ? new Date(new Date(originalEndIso).getTime() + 86_400_000)
    : new Date();
  const previewEnd = new Date(previewStart);
  previewEnd.setMonth(previewEnd.getMonth() + months);

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Verlängerung"
      title={`Verlängern: ${contractTitle}`}
      maxWidth={480}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await renewContract({
              contractId,
              monthsExtension: months,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            router.push(`/vertraege/${res.id}`);
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}

        <p className="text-[12.5px] leading-[1.5] text-ink-300">
          Erstellt einen neuen Vertrag mit denselben Verknüpfungen (Kunde, Fahrzeug, Body) und markiert den alten als „Auslaufend".
        </p>

        <ModalField label="Verlängern um (Monate)">
          <ModalInput
            type="number"
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value) || 12)}
            min={1}
            max={120}
          />
        </ModalField>

        <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">Neue Laufzeit</p>
          <p className="mt-1 text-[12.5px] text-ink-100">
            {previewStart.toLocaleDateString('de-DE')} → {previewEnd.toLocaleDateString('de-DE')}
          </p>
        </div>

        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Verlängerung erstellen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
