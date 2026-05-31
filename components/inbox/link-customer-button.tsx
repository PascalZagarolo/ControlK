'use client';

/**
 * Manual customer tagging (Schritt 4b). Links an inbox sender to a customer
 * by adding their email as a contact — deliberately manual, no auto-guessing.
 * Once linked, the sender shows up as that customer in the "Von Kunden" view,
 * churn alerts and commitments.
 *
 * Self-contained: lazily loads the workspace customer list on first open so a
 * normal mail view never pays for it.
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { listCustomersForLink, linkSenderToCustomer } from '@/lib/actions/customers';
import { toast } from '@/lib/stores/toast-store';

type Picker = { id: string; name: string; initials: string };

export function LinkCustomerButton({
  senderEmail,
  senderName,
}: {
  senderEmail: string;
  senderName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Picker[] | null>(null);
  const [query, setQuery] = useState('');
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Lazy-load the customer list the first time the popover opens.
  useEffect(() => {
    if (!open || customers !== null) return;
    let alive = true;
    listCustomersForLink()
      .then((rows) => alive && setCustomers(rows))
      .catch(() => alive && setCustomers([]));
    return () => {
      alive = false;
    };
  }, [open, customers]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const link = (customerId: string) =>
    start(async () => {
      const r = await linkSenderToCustomer({ customerId, email: senderEmail, name: senderName });
      if (r.ok) {
        toast('Mit Kunde verknüpft', 'success');
        setOpen(false);
        router.refresh();
      } else {
        toast(r.error, 'danger');
      }
    });

  const filtered = (customers ?? []).filter((c) =>
    query.trim() ? c.name.toLowerCase().includes(query.trim().toLowerCase()) : true
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-ink-200 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
      >
        ◉ Mit Kunde verknüpfen
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-40 w-72 rounded-[12px] border border-white/[0.08] bg-[rgba(18,19,21,0.98)] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kunde suchen …"
            className="mb-2 w-full rounded-md border border-white/[0.08] bg-black/30 px-2.5 py-1.5 text-[12.5px] text-ink-50 outline-none focus:border-white/[0.18]"
          />
          <div className="max-h-64 overflow-y-auto">
            {customers === null ? (
              <p className="px-2 py-3 text-center text-[12px] text-ink-300">Lädt …</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-[12px] text-ink-300">
                {customers.length === 0 ? 'Noch keine Kunden angelegt.' : 'Kein Treffer.'}
              </p>
            ) : (
              <ul className="flex flex-col">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => link(c.id)}
                      disabled={pending}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink-100 transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.06] font-mono text-[9px] text-ink-200">
                        {c.initials}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
