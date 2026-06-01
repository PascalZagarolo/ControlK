'use client';

/**
 * Low-friction "als Kunde markieren" — Schritt 5.
 *
 * The LIGHTWEIGHT counterpart to LinkCustomerButton (which needs a
 * pre-existing CRM record). This creates a per-user contact_tag straight from
 * a mail: this address, or the whole domain, optionally with a name. No CRM
 * setup required. Strictly manual — we never auto-guess.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { tagSenderAsClient, untagContact, isSenderTagged } from '@/lib/actions/contact-tags';
import { emailDomain } from '@/lib/clients/resolve';
import { toast } from '@/lib/stores/toast-store';

export function TagClientButton({
  senderEmail,
  senderName,
  /** When already a client (tag or CRM) at render time, start in tagged state. */
  initiallyTagged = false,
}: {
  senderEmail: string;
  senderName: string | null;
  initiallyTagged?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tagged, setTagged] = useState(initiallyTagged);
  const [name, setName] = useState(senderName ?? '');
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const domain = emailDomain(senderEmail);

  // Confirm the real tag state on first open (covers domain tags + CRM).
  useEffect(() => {
    if (!open || initiallyTagged) return;
    isSenderTagged(senderEmail).then(setTagged).catch(() => {});
  }, [open, senderEmail, initiallyTagged]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const tag = (scope: 'email' | 'domain') =>
    start(async () => {
      const r = await tagSenderAsClient({ email: senderEmail, scope, displayName: name || null });
      if (r.ok) {
        setTagged(true);
        setOpen(false);
        toast(scope === 'domain' ? `${domain} als Kunde markiert` : 'Als Kunde markiert', 'success');
        router.refresh();
      } else {
        toast(r.error, 'danger');
      }
    });

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12.5px] transition-colors disabled:opacity-50 ${
          tagged
            ? 'border-[#5ee08a]/30 bg-[#5ee08a]/[0.08] text-[#5ee08a]'
            : 'border-white/[0.08] bg-white/[0.02] text-ink-200 hover:bg-white/[0.05]'
        }`}
      >
        {tagged ? '✓ Kunde' : '＋ Als Kunde markieren'}
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-72 rounded-[12px] border border-white/[0.08] bg-[rgba(18,19,21,0.98)] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <p className="mb-2 text-[11.5px] leading-[1.5] text-ink-300">
            Markiere diesen Absender als Kunde — er erscheint dann in „Nach Kunde",
            „Von Kunden" und „Wartet".
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anzeigename (optional, z.B. Müller GmbH)"
            className="mb-2 w-full rounded-md border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[12.5px] text-ink-50 outline-none focus:border-white/[0.18]"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => tag('email')}
              disabled={pending}
              className="rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-ink-100 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
            >
              Nur diese Adresse
              <span className="ml-1 text-ink-300">({senderEmail})</span>
            </button>
            {domain && (
              <button
                type="button"
                onClick={() => tag('domain')}
                disabled={pending}
                className="rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-ink-100 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
              >
                Ganze Firma
                <span className="ml-1 text-ink-300">(@{domain})</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
