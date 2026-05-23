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
  ModalSelect,
} from '@/components/ui/modal';
import { createInvite, revokeInvite } from '@/lib/actions/workspace';
import type { WorkspaceInvite, WorkspaceRole } from '@/lib/types';

export function InviteModal({
  open,
  onClose,
  workspaceId,
  workspaceName,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  existing: WorkspaceInvite[];
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

  const url = (t: string) =>
    typeof window === 'undefined' ? `/invite/${t}` : `${window.location.origin}/invite/${t}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Member einladen"
      title={workspaceName}
      maxWidth={560}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await createInvite({
              workspaceId,
              role: (String(fd.get('role') ?? 'member') as WorkspaceRole) || 'member',
              expiresInDays: Number(fd.get('expiresInDays')) || null,
              maxUses: Number(fd.get('maxUses')) || 0,
              email: String(fd.get('email') ?? '') || undefined,
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
              Invite-Link erstellt
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
            <p className="mt-2 text-[11px] leading-[1.45] text-ink-300">
              Wer den Link hat + (optional) die richtige Email-Adresse, kann beitreten.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] leading-[1.5] text-ink-300">
              Erzeugt einen Invite-Link. Wer den Link öffnet, kann nach Login beitreten.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Rolle">
                <ModalSelect name="role" defaultValue="member">
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="guest">Guest (read-only)</option>
                </ModalSelect>
              </ModalField>
              <ModalField label="Gültigkeit">
                <ModalSelect name="expiresInDays" defaultValue="7">
                  <option value="1">1 Tag</option>
                  <option value="7">7 Tage</option>
                  <option value="30">30 Tage</option>
                  <option value="0">Kein Ablauf</option>
                </ModalSelect>
              </ModalField>
            </div>

            <ModalField
              label="Max. Nutzungen (optional)"
              hint="Leer = unbegrenzt"
            >
              <ModalInput name="maxUses" type="number" placeholder="z.B. 1 für einmaligen Einsatz" />
            </ModalField>

            <ModalField
              label="Email (optional)"
              hint="Wenn gesetzt, kann nur diese Person beitreten."
            >
              <ModalInput name="email" type="email" placeholder="kollegin@firma.de" />
            </ModalField>
          </>
        )}

        {existing.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              Bestehende Invites · {existing.length}
            </p>
            {existing.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-2 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-200">
                  {inv.role}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200">
                  {inv.token.slice(0, 12)}…
                </span>
                {inv.email && (
                  <span className="truncate font-mono text-[10px] text-ink-300">{inv.email}</span>
                )}
                <span className="font-mono text-[10px] text-ink-300">
                  {inv.usedCount}{inv.maxUses > 0 ? `/${inv.maxUses}` : ''} used
                </span>
                {inv.expiresAt && (
                  <span className="font-mono text-[10px] text-ink-300">
                    bis {new Date(inv.expiresAt).toLocaleDateString('de-DE')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url(inv.token));
                    } catch {}
                  }}
                  className="text-[11px] text-ink-200 hover:text-ink-50"
                >
                  ⧉
                </button>
                {!inv.revokedAt && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm('Invite widerrufen?')) return;
                      start(async () => {
                        await revokeInvite(inv.id);
                        router.refresh();
                      });
                    }}
                    className="text-[11px] text-ink-300 hover:text-[#ff8a8a]"
                  >
                    ×
                  </button>
                )}
                {inv.revokedAt && (
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-[#ff8a8a]">
                    widerrufen
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <ModalActions>
          <ModalSecondary onClick={onClose}>Schließen</ModalSecondary>
          {!token && <ModalPrimary pending={pending}>Invite-Link erstellen</ModalPrimary>}
        </ModalActions>
      </form>
    </Modal>
  );
}
