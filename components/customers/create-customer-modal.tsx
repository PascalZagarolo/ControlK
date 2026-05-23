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
import { createCustomer } from '@/lib/actions/customers';

export function CreateCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} kicker="Neuer Kunde" title="Kunde anlegen">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          start(async () => {
            const res = await createCustomer(data);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            router.push(`/kunden/${res.slug}`);
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        <ModalField label="Name">
          <ModalInput name="name" required autoFocus placeholder="Steiner GmbH" />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Branche">
            <ModalInput name="industry" placeholder="z.B. Logistik" />
          </ModalField>
          <ModalField label="Status">
            <ModalSelect name="status" defaultValue="lead">
              <option value="lead">Lead</option>
              <option value="aktiv">Aktiv</option>
              <option value="inaktiv">Inaktiv</option>
            </ModalSelect>
          </ModalField>
        </div>
        <ModalField label="Notizen (optional)">
          <ModalTextarea
            name="notes"
            rows={3}
            placeholder="Kontext, Eigenheiten, Präferenzen …"
          />
        </ModalField>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Kunde anlegen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
