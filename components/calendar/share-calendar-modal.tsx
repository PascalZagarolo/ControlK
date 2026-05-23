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
import { createCalendarShareLink } from '@/lib/actions/calendar';

export function ShareCalendarModal({
  open,
  onClose,
  customers,
}: {
  open: boolean;
  onClose: () => void;
  customers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setToken(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  const url = (t: string) => {
    if (typeof window === 'undefined') return `/share/calendar/${t}`;
    return `${window.location.origin}/share/calendar/${t}`;
  };
  const icalUrl = (t: string) => {
    if (typeof window === 'undefined') return `/api/ical/${t}`;
    return `${window.location.origin}/api/ical/${t}`;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Kalender teilen"
      title="Public Read-Only + iCal Feed"
      maxWidth={540}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const days = Number(fd.get('expiresInDays')) || null;
          const customerId = String(fd.get('customerId') ?? '') || null;
          start(async () => {
            const res = await createCalendarShareLink({
              customerId,
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
          <div className="flex flex-col gap-2">
            <div className="rounded-[10px] border border-[#5ee08a]/25 bg-[#5ee08a]/[0.05] p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#5ee08a]">
                Web-Link (Read-Only)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={url(token)}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                  className="flex-1 rounded-[6px] border border-white/[0.10] bg-white/[0.04] px-2 py-1.5 text-[12px] text-ink-50 outline-none"
                />
                <CopyBtn
                  text={url(token)}
                  copied={copied}
                  setCopied={setCopied}
                />
              </div>
            </div>
            <div className="rounded-[10px] border border-[#5eb6ff]/25 bg-[#5eb6ff]/[0.05] p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#5eb6ff]">
                iCal-Feed (Outlook / Google / Apple)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={icalUrl(token)}
                  onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                  className="flex-1 rounded-[6px] border border-white/[0.10] bg-white/[0.04] px-2 py-1.5 text-[12px] text-ink-50 outline-none"
                />
                <CopyBtn text={icalUrl(token)} copied={copied} setCopied={setCopied} />
              </div>
              <p className="mt-2 text-[11px] leading-[1.45] text-ink-300">
                In Outlook: „Kalender abonnieren" · in Google Cal: „Über URL hinzufügen".
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] leading-[1.5] text-ink-300">
              Erzeugt einen Read-Only-Link auf Termine. Optional gefiltert auf einen Kunden.
            </p>
            <ModalField label="Filter auf Kunde (optional)">
              <ModalSelect name="customerId" defaultValue="">
                <option value="">— alle Workspace-Events —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </ModalSelect>
            </ModalField>
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

        <ModalActions>
          <ModalSecondary onClick={onClose}>Schließen</ModalSecondary>
          {!token && <ModalPrimary pending={pending}>Link erstellen</ModalPrimary>}
        </ModalActions>
      </form>
    </Modal>
  );
}

function CopyBtn({
  text,
  copied,
  setCopied,
}: {
  text: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="rounded-[6px] border border-white/[0.10] bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] text-ink-100 hover:bg-white/[0.08]"
    >
      {copied ? '✓ kopiert' : 'Kopieren'}
    </button>
  );
}
