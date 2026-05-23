'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Modal,
  ModalActions,
  ModalError,
  ModalField,
  ModalPrimary,
  ModalSecondary,
  ModalSelect,
} from '@/components/ui/modal';
import { createVehicleShareLink } from '@/lib/actions/vehicles';

export function ShareVehicleModal({
  open,
  onClose,
  vehicleId,
  vehicleLabel,
  isCatalog,
}: {
  open: boolean;
  onClose: () => void;
  vehicleId?: string;
  vehicleLabel?: string;
  isCatalog?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setToken(null);
      setCopied(false);
      setError(null);
    }
  }, [open]);

  const url = (t: string) => {
    if (typeof window === 'undefined') return isCatalog ? `/share/fleet/${t}` : `/share/vehicle/${t}`;
    return `${window.location.origin}${isCatalog ? '/share/fleet/' : '/share/vehicle/'}${t}`;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker={isCatalog ? 'Fleet-Katalog teilen' : 'Fahrzeug teilen'}
      title={isCatalog ? 'Öffentlicher Flotten-Katalog' : vehicleLabel ?? 'Fahrzeug'}
      maxWidth={520}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const days = Number(fd.get('expiresInDays')) || null;
          start(async () => {
            const res = await createVehicleShareLink({
              vehicleId: vehicleId ?? null,
              expiresInDays: days,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setToken(res.token);
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        {token ? (
          <div className="rounded-[10px] border border-[#5ee08a]/25 bg-[#5ee08a]/[0.05] p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#5ee08a]">
              Link erstellt
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={url(token)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                className="flex-1 rounded-[6px] border border-white/[0.10] bg-white/[0.04] px-2 py-1.5 text-[12px] text-ink-50 outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url(token));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {}
                }}
                className="rounded-[6px] border border-white/[0.10] bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] text-ink-100 hover:bg-white/[0.08]"
              >
                {copied ? '✓ kopiert' : 'Kopieren'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] leading-[1.5] text-ink-300">
              {isCatalog
                ? 'Read-only Catalog aller derzeit freien Fahrzeuge mit Tagessatz und Specs.'
                : 'Read-only Vehicle-Page für Interessenten oder Versicherungs-Anfragen.'}
            </p>
            <ModalField label="Gültigkeit">
              <ModalSelect name="expiresInDays" defaultValue="30">
                <option value="1">1 Tag</option>
                <option value="7">7 Tage</option>
                <option value="30">30 Tage</option>
                <option value="90">90 Tage</option>
                <option value="0">Kein Ablauf</option>
              </ModalSelect>
            </ModalField>
          </>
        )}
        <ModalActions>
          <ModalSecondary onClick={onClose}>Schließen</ModalSecondary>
          {!token && <ModalPrimary pending={pending}>Link erstellen</ModalPrimary>}
        </ModalActions>
      </form>
    </Modal>
  );
}
