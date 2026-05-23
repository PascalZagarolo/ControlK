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
import { createContractShareLink, revokeContractShareLink } from '@/lib/actions/contracts';
import type { ContractShareLinkRecord } from '@/lib/types';

export function ContractShareModal({
  open,
  onClose,
  contractId,
  contractTitle,
  existingLinks,
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  contractTitle: string;
  existingLinks: ContractShareLinkRecord[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [allowSignature, setAllowSignature] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setToken(null);
      setError(null);
      setCopied(false);
      setAllowSignature(true);
    }
  }, [open]);

  const url = (t: string) =>
    typeof window === 'undefined'
      ? `/share/contract/${t}`
      : `${window.location.origin}/share/contract/${t}`;

  return (
    <Modal open={open} onClose={onClose} kicker="Vertrag teilen" title={contractTitle} maxWidth={540}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const days = Number(fd.get('expiresInDays')) || null;
          start(async () => {
            const res = await createContractShareLink({
              contractId,
              expiresInDays: days,
              allowSignature,
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
              Link erstellt {allowSignature && '· Unterschrift erlaubt'}
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
              Erzeugt einen Read-Only-Link auf den Vertrag. Optional kann der Empfänger online unterschreiben.
            </p>
            <ModalField label="Gültigkeit">
              <ModalSelect name="expiresInDays" defaultValue="14">
                <option value="3">3 Tage</option>
                <option value="7">7 Tage</option>
                <option value="14">14 Tage</option>
                <option value="30">30 Tage</option>
                <option value="0">Kein Ablauf</option>
              </ModalSelect>
            </ModalField>
            <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12.5px] text-ink-100">
              <input
                type="checkbox"
                checked={allowSignature}
                onChange={(e) => setAllowSignature(e.target.checked)}
              />
              <div className="flex-1">
                <p>Online-Unterschrift erlauben</p>
                <p className="mt-0.5 text-[11px] text-ink-300">
                  Empfänger kann Vertrag direkt im Browser akzeptieren.
                </p>
              </div>
            </label>
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
                {l.allowSignature && (
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-[#5ee08a]">
                    signbar
                  </span>
                )}
                <span className="font-mono text-[10px] text-ink-300">{l.viewCount} Views</span>
                {l.expiresAt && (
                  <span className="font-mono text-[10px] text-ink-300">
                    bis {new Date(l.expiresAt).toLocaleDateString('de-DE')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm('Link widerrufen?')) return;
                    start(async () => {
                      await revokeContractShareLink(l.id);
                      router.refresh();
                    });
                  }}
                  className="text-[11px] text-ink-300 hover:text-[#ff8a8a]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <ModalActions>
          <ModalSecondary onClick={onClose}>Schließen</ModalSecondary>
          {!token && <ModalPrimary pending={pending}>Link erstellen</ModalPrimary>}
        </ModalActions>
      </form>
    </Modal>
  );
}
