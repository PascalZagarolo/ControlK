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
  ModalTextarea,
} from '@/components/ui/modal';
import { importVehiclesCsv } from '@/lib/actions/vehicles';

const EXAMPLE = `plate,model,kind,km
MV-AB 123,VW Crafter,sprinter,45000
B-CD 456,Ford Transit,transporter,22000
M-EF 789,VW Polo,pkw,80000`;

export function BulkImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [csv, setCsv] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} kicker="Bulk-Import" title="Fahrzeuge aus CSV" maxWidth={560}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setFeedback(null);
          start(async () => {
            const res = await importVehiclesCsv(csv);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setFeedback(`${res.imported} Fahrzeug${res.imported === 1 ? '' : 'e'} importiert`);
            router.refresh();
            setTimeout(() => {
              onClose();
              setCsv('');
              setFeedback(null);
            }, 1500);
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        {feedback && (
          <div className="rounded-[10px] border border-[#5ee08a]/25 bg-[#5ee08a]/[0.05] px-3 py-2 text-[12.5px] text-[#5ee08a]">
            ✓ {feedback}
          </div>
        )}
        <ModalField
          label="CSV-Inhalt"
          hint="Erste Zeile = Header. Pflicht-Spalten: plate, model. Optional: kind, km. Trenner: Komma oder Semikolon."
        >
          <ModalTextarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={10}
            placeholder={EXAMPLE}
          />
        </ModalField>
        <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Gültige kind-Werte
          </p>
          <p className="mt-1 text-[12px] text-ink-200">
            sprinter · transporter · pkw · kuehlfahrzeug
          </p>
        </div>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Import starten</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
