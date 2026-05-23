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
import {
  createCustomerShareLink,
  revokeCustomerShareLink,
} from '@/lib/actions/customers';
import type { CustomerShareLink } from '@/lib/types';

export function ShareCustomerModal({
  open,
  onClose,
  customerId,
  customerName,
  existingLinks,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  existingLinks: CustomerShareLink[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCreatedToken(null);
      setCopied(false);
      setError(null);
    }
  }, [open]);

  const url = (token: string) =>
    typeof window === 'undefined'
      ? `/share/customer/${token}`
      : `${window.location.origin}/share/customer/${token}`;

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(url(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Modal open={open} onClose={onClose} kicker="Kundenportal teilen" title={customerName} maxWidth={520}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const days = Number(fd.get('expiresInDays')) || null;
          start(async () => {
            const res = await createCustomerShareLink({
              customerId,
              expiresInDays: days,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setCreatedToken(res.token);
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}

        {createdToken ? (
          <div className="rounded-[10px] border border-[#5ee08a]/25 bg-[#5ee08a]/[0.05] p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#5ee08a]">
              Link erstellt
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={url(createdToken)}
                onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                className="flex-1 rounded-[6px] border border-white/[0.10] bg-white/[0.04] px-2 py-1.5 text-[12px] text-ink-50 outline-none"
              />
              <button
                type="button"
                onClick={() => copy(createdToken)}
                className="rounded-[6px] border border-white/[0.10] bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] text-ink-100 hover:bg-white/[0.08]"
              >
                {copied ? '✓ kopiert' : 'Kopieren'}
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-[1.45] text-ink-300">
              Read-only Kundenportal. Zeigt aktive Verträge, laufende Fahrzeuge und gemeinsame Termine.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] leading-[1.5] text-ink-300">
              Erzeugt einen Read-Only-Link, den du dem Kunden geben kannst. Er sieht: aktive Verträge,
              aktuell vermietete Fahrzeuge, gemeinsame Termine — ohne Login.
            </p>
            <ModalField label="Gültigkeit">
              <ModalSelect name="expiresInDays" defaultValue="30">
                <option value="7">7 Tage</option>
                <option value="30">30 Tage</option>
                <option value="90">90 Tage</option>
                <option value="0">Kein Ablauf</option>
              </ModalSelect>
            </ModalField>
          </>
        )}

        {existingLinks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              Bestehende Links · {existingLinks.length}
            </p>
            {existingLinks.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200">
                  {l.token.slice(0, 12)}…
                </span>
                <span className="font-mono text-[10px] text-ink-300">{l.viewCount} Views</span>
                {l.expiresAt && (
                  <span className="font-mono text-[10px] text-ink-300">
                    bis {new Date(l.expiresAt).toLocaleDateString('de-DE')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => copy(l.token)}
                  className="text-[11px] text-ink-200 hover:text-ink-50"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm('Link widerrufen?')) return;
                    start(async () => {
                      await revokeCustomerShareLink(l.id);
                      router.refresh();
                    });
                  }}
                  className="text-[11px] text-ink-300 hover:text-[#ff8a8a]"
                  aria-label="Widerrufen"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <ModalActions>
          <ModalSecondary onClick={onClose}>Schließen</ModalSecondary>
          {!createdToken && <ModalPrimary pending={pending}>Link erstellen</ModalPrimary>}
        </ModalActions>
      </form>
    </Modal>
  );
}
