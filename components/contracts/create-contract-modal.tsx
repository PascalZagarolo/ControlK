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
  ModalSelect,
  ModalTextarea,
} from '@/components/ui/modal';
import { createContract } from '@/lib/actions/contracts';

type CustomerOption = { slug: string; name: string };

export function CreateContractModal({
  open,
  onClose,
  customers,
}: {
  open: boolean;
  onClose: () => void;
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'entwurf' | 'aktiv' | 'auslaufend' | 'storniert' | 'vorlage'>(
    'entwurf'
  );

  const isTemplate = status === 'vorlage';

  return (
    <Modal open={open} onClose={onClose} kicker="Neuer Vertrag" title="Vertrag anlegen" maxWidth={620}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          start(async () => {
            const res = await createContract(data);
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
        <ModalField label="Titel">
          <ModalInput name="title" required autoFocus placeholder="Mietvertrag B2B Standard" />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Status">
            <ModalSelect
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="entwurf">Entwurf</option>
              <option value="vorlage">Vorlage</option>
              <option value="aktiv">Aktiv</option>
              <option value="auslaufend">Auslaufend</option>
            </ModalSelect>
          </ModalField>
          <ModalField label="Wert (€)" hint="Bei Vorlagen leer lassen">
            <ModalInput
              name="value"
              placeholder="48000"
              inputMode="decimal"
              disabled={isTemplate}
            />
          </ModalField>
        </div>
        {!isTemplate && (
          <>
            <ModalField label="Kunde (optional)">
              <ModalSelect name="customerSlug" defaultValue="">
                <option value="">— Kein Kunde —</option>
                {customers.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Beginn (optional)">
                <ModalInput name="startsAt" type="date" />
              </ModalField>
              <ModalField label="Ende (optional)">
                <ModalInput name="endsAt" type="date" />
              </ModalField>
            </div>
          </>
        )}
        <ModalField
          label="Body (optional)"
          hint="Section-Heading auf eine Zeile, Absätze leerzeilengetrennt, Sections mit --- trennen"
        >
          <ModalTextarea
            name="body"
            rows={5}
            placeholder={`1. Vertragsgegenstand\nErster Absatz …\n\nZweiter Absatz …\n---\n2. Konditionen\n…`}
          />
        </ModalField>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Vertrag anlegen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
