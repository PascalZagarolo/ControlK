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
} from '@/components/ui/modal';
import { createVehicle } from '@/lib/actions/vehicles';

export function CreateVehicleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} kicker="Neues Fahrzeug" title="Fahrzeug anlegen" maxWidth={560}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const data = new FormData(e.currentTarget);
          start(async () => {
            const res = await createVehicle(data);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            router.push(`/flotte/${res.id}`);
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Kennzeichen">
            <ModalInput name="plate" required autoFocus placeholder="B-UR 314" />
          </ModalField>
          <ModalField label="Typ">
            <ModalSelect name="kind" defaultValue="transporter">
              <option value="sprinter">Sprinter</option>
              <option value="transporter">Transporter</option>
              <option value="pkw">PKW</option>
              <option value="kuehlfahrzeug">Kühlfahrzeug</option>
            </ModalSelect>
          </ModalField>
        </div>
        <ModalField label="Modell">
          <ModalInput name="model" required placeholder="Mercedes-Benz Sprinter 314 CDI" />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Status">
            <ModalSelect name="status" defaultValue="frei">
              <option value="frei">Frei</option>
              <option value="vermietet">Vermietet</option>
              <option value="reserviert">Reserviert</option>
              <option value="wartung">Wartung</option>
            </ModalSelect>
          </ModalField>
          <ModalField label="Standort">
            <ModalInput name="location" placeholder="Berlin-Mitte" />
          </ModalField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="Kilometerstand">
            <ModalInput name="km" inputMode="numeric" placeholder="0" />
          </ModalField>
          <ModalField label="Nächste Wartung">
            <ModalInput name="nextService" placeholder="z.B. 50.000 km" />
          </ModalField>
        </div>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Fahrzeug anlegen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}
