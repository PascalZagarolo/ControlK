'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signContract } from '@/lib/actions/contracts';

export function ContractSignBlock({
  contractId,
  shareToken,
  alreadySigned,
  signedName,
  signedAt,
}: {
  contractId: string;
  shareToken: string;
  alreadySigned: boolean;
  signedName?: string;
  signedAt?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  if (alreadySigned) {
    return (
      <section className="rounded-[12px] border border-[#5ee08a]/25 bg-[#5ee08a]/[0.05] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-[#5ee08a]">
          ✓ Vertrag akzeptiert
        </p>
        <p className="mt-1 text-[14px] font-medium text-ink-50">{signedName ?? '—'}</p>
        {signedAt && (
          <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
            {new Date(signedAt).toLocaleString('de-DE')}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-[12px] border border-white/[0.10] bg-white/[0.02] p-4">
      <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#5eb6ff]">
        Unterschrift
      </h2>
      <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-300">
        Mit deiner Bestätigung gilt der Vertrag als angenommen. Zeitpunkt + Name werden protokolliert.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!accepted) {
            setError('Bitte AGB-Checkbox bestätigen.');
            return;
          }
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await signContract({
              contractId,
              shareToken,
              signerName: String(fd.get('name') ?? ''),
              signerEmail: String(fd.get('email') ?? '') || undefined,
              signerRole: String(fd.get('role') ?? '') || undefined,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            router.refresh();
          });
        }}
        className="mt-4 flex flex-col gap-3"
      >
        {error && (
          <div className="rounded-[10px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] px-3 py-2 text-[12px] text-[#ff8a8a]">
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
              Vollständiger Name
            </label>
            <input
              name="name"
              required
              placeholder="Max Mustermann"
              className="mt-1 block w-full rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.20]"
            />
          </div>
          <div>
            <label className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
              E-Mail (optional)
            </label>
            <input
              name="email"
              type="email"
              placeholder="max@firma.de"
              className="mt-1 block w-full rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.20]"
            />
          </div>
        </div>
        <div>
          <label className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
            Rolle (optional)
          </label>
          <input
            name="role"
            placeholder="Geschäftsführer, Einkauf …"
            className="mt-1 block w-full rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-ink-50 outline-none focus:border-white/[0.20]"
          />
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-ink-100">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Ich habe den Vertragstext gelesen und akzeptiere die Konditionen verbindlich.
          </span>
        </label>
        <button
          type="submit"
          disabled={pending || !accepted}
          className="rounded-[8px] bg-[#5ee08a] px-4 py-2.5 text-[13.5px] font-medium leading-none text-black transition-opacity disabled:opacity-30"
        >
          {pending ? 'Unterschrift wird gespeichert …' : 'Vertrag unterschreiben'}
        </button>
      </form>
    </section>
  );
}
