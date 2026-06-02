'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CustomerOverviewRow } from '@/lib/db/queries/clients';
import { createManualContact } from '@/lib/actions/customers';
import { toast } from '@/lib/stores/toast-store';

// Calm customer OVERVIEW (wedge). A read-only view onto what Ctrl+K already
// knows per tagged client — open commitments, who's waiting, last contact.
// No CRM: nothing here is edited except the optional note (on the detail page).
// Hierarchy via typography + spacing, not a card grid. Sand/gold is reserved
// for genuine urgency (overdue), red for overdue promises, blue for waiting.

type Sort = 'urgency' | 'name' | 'recent';

const C = {
  bg: '#0A0A0C',
  fg: '#F0F0F2',
  muted: '#9c9c9d',
  faint: '#7c7c83',
  hair: 'rgba(255,255,255,0.06)',
  overdue: '#ff8a8a',
  waiting: '#5E9EFF',
  gold: '#E8B86D',
  calm: '#52525B',
};

function relDays(days: number | null): string {
  if (days === null) return 'kein Kontakt';
  if (days === 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  if (days < 30) return `vor ${Math.floor(days / 7)} Wo.`;
  if (days < 365) return `vor ${Math.floor(days / 30)} Mon.`;
  return `vor ${Math.floor(days / 365)} J.`;
}

const STATUS_SUGGESTIONS = ['neu', 'kontaktiert', 'interessiert', 'kein Interesse', 'Kunde'];

export function KundenWedgeClient({
  rows,
  canCreate = false,
  currentUserId,
}: {
  rows: CustomerOverviewRow[];
  canCreate?: boolean;
  currentUserId?: string;
}) {
  const [sort, setSort] = useState<Sort>('urgency');
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState<'all' | 'mine'>('all');

  // "Meine" = contacts assigned to me, plus my personal tagged clients.
  const hasAssignments = rows.some((r) => r.assignedTo);
  const scoped = useMemo(() => {
    if (scope === 'all' || !currentUserId) return rows;
    return rows.filter(
      (r) => r.entity === 'tag' || r.assignedTo?.id === currentUserId
    );
  }, [rows, scope, currentUserId]);

  const sorted = useMemo(() => {
    const copy = [...scoped];
    if (sort === 'name') {
      copy.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
    } else if (sort === 'recent') {
      copy.sort(
        (a, b) => (a.lastInteractionDays ?? Infinity) - (b.lastInteractionDays ?? Infinity)
      );
    }
    // 'urgency' keeps the server order (overdue → waiting → open → recent).
    return copy;
  }, [scoped, sort]);

  const needAttention = rows.filter(
    (r) => r.overdueCommitments > 0 || r.waitingDays !== null
  ).length;

  return (
    <main className="min-h-screen" style={{ background: C.bg, color: C.fg }}>
      <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-24 sm:px-8">
        <header className="flex items-start gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-[26px] font-semibold tracking-[-0.01em] sm:text-[30px]">Kunden</h1>
            <p className="text-[14px] leading-relaxed" style={{ color: C.muted }}>
              {rows.length === 0
                ? 'Markiere Absender im Posteingang als Kunde oder leg einen Kontakt an — dann erscheinen sie hier mit allem, was offen ist.'
                : needAttention > 0
                  ? `${needAttention} ${needAttention === 1 ? 'Kunde braucht' : 'Kunden brauchen'} gerade deine Aufmerksamkeit.`
                  : 'Alles ruhig — bei keinem Kunden ist gerade etwas offen.'}
            </p>
          </div>
          {canCreate && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="ml-auto shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium leading-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: C.fg }}
            >
              + Neuer Kontakt
            </button>
          )}
        </header>

        {canCreate && creating && (
          <CreateContactForm onClose={() => setCreating(false)} />
        )}

        {rows.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              {(
                [
                  ['urgency', 'Dringlichkeit'],
                  ['recent', 'Letzter Kontakt'],
                  ['name', 'Name'],
                ] as [Sort, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className="rounded-md px-2.5 py-1 text-[12px] font-medium leading-none transition-colors"
                  style={
                    sort === key
                      ? { background: 'rgba(255,255,255,0.06)', color: C.fg }
                      : { color: C.faint }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {hasAssignments && currentUserId && (
              <div className="flex items-center gap-1 border-l pl-3" style={{ borderColor: C.hair }}>
                {(
                  [
                    ['all', 'Alle'],
                    ['mine', 'Meine'],
                  ] as ['all' | 'mine', string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setScope(key)}
                    className="rounded-md px-2.5 py-1 text-[12px] font-medium leading-none transition-colors"
                    style={
                      scope === key
                        ? { background: 'rgba(255,255,255,0.06)', color: C.fg }
                        : { color: C.faint }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <ul className="mt-3 flex flex-col">
          {sorted.map((r) => (
            <CustomerRow key={r.id} row={r} currentUserId={currentUserId} />
          ))}
          {sorted.length === 0 && rows.length > 0 && (
            <li className="py-6 text-[13px]" style={{ color: C.calm }}>
              Dir sind gerade keine Kontakte zugeordnet.
            </li>
          )}
        </ul>
      </div>
    </main>
  );
}

function CustomerRow({
  row,
  currentUserId,
}: {
  row: CustomerOverviewRow;
  currentUserId?: string;
}) {
  const calm =
    row.overdueCommitments === 0 &&
    row.waitingDays === null &&
    row.openCommitments === 0;

  // Team assignment hint on actionable rows: is it on me or my partner?
  const actionable = row.overdueCommitments > 0 || row.waitingDays !== null;
  const assignHint =
    actionable && row.assignedTo
      ? row.assignedTo.id === currentUserId
        ? { text: 'auf dich', color: C.gold }
        : { text: `${row.assignedTo.name.split(' ')[0]} ist dran`, color: C.faint }
      : null;

  return (
    <li>
      <Link
        href={`/kunden/${row.id}`}
        className="group flex items-center gap-4 border-b py-3.5 transition-colors hover:bg-white/[0.02]"
        style={{ borderColor: C.hair }}
      >
        {/* Urgency rail — red overdue, blue waiting, else nothing loud. */}
        <span
          aria-hidden
          className="h-9 w-[3px] shrink-0 rounded-full"
          style={{
            background:
              row.overdueCommitments > 0
                ? C.overdue
                : row.waitingDays !== null
                  ? C.waiting
                  : 'transparent',
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate text-[15px] font-medium" style={{ color: C.fg }}>
              {row.displayName}
            </p>
            {row.company && (
              <span className="shrink-0 truncate text-[12px]" style={{ color: C.muted }}>
                · {row.company}
              </span>
            )}
            {row.status && (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', color: C.faint }}
              >
                {row.status}
              </span>
            )}
            {row.entity === 'tag' && row.kind === 'domain' && (
              <span
                className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.2px]"
                style={{ color: C.calm }}
              >
                Firma
              </span>
            )}
          </div>
          {/* Signals — only what's true; calm clients say so plainly. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
            {row.overdueCommitments > 0 && (
              <span style={{ color: C.overdue }}>
                {row.overdueCommitments} überfällige{' '}
                {row.overdueCommitments === 1 ? 'Zusage' : 'Zusagen'}
              </span>
            )}
            {row.openCommitments - row.overdueCommitments > 0 && (
              <span style={{ color: C.muted }}>
                {row.openCommitments - row.overdueCommitments} offene{' '}
                {row.openCommitments - row.overdueCommitments === 1 ? 'Zusage' : 'Zusagen'}
              </span>
            )}
            {row.waitingDays !== null && (
              <span style={{ color: C.waiting }}>
                wartet seit {row.waitingDays} {row.waitingDays === 1 ? 'Tag' : 'Tagen'}
              </span>
            )}
            {assignHint && <span style={{ color: assignHint.color }}>· {assignHint.text}</span>}
            {calm && <span style={{ color: C.calm }}>nichts Offenes</span>}
            {row.note && (
              <span className="truncate" style={{ color: C.faint }} title={row.note}>
                · {row.note}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Who had the last interaction — dezente Partner-Initialen (Team). */}
          {row.lastInteractionBy && (
            <span
              className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: C.muted }}
              title={`Zuletzt: ${row.lastInteractionBy.name}`}
            >
              {row.lastInteractionBy.initials}
            </span>
          )}
          <span className="font-mono text-[11px] tabular-nums" style={{ color: C.faint }}>
            {relDays(row.lastInteractionDays)}
          </span>
        </div>
      </Link>
    </li>
  );
}

// Lightweight "manually add a contact" form (Business-Workspaces). Maps to a
// shared customers row + customer_contacts emails — no pipeline/stage fields.
function CreateContactForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [emails, setEmails] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');

  const submit = () => {
    if (!name.trim()) {
      toast('Name erforderlich.', 'danger');
      return;
    }
    const emailList = emails
      .split(/[,\s;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
    startTransition(async () => {
      const r = await createManualContact({
        name,
        emails: emailList,
        company,
        phone,
        status,
        note,
      }).catch(() => ({ ok: false as const, error: 'Anlegen fehlgeschlagen.' }));
      if (r.ok) {
        toast('Kontakt angelegt.', 'success');
        onClose();
        router.refresh();
      } else {
        toast(r.error ?? 'Anlegen fehlgeschlagen.', 'danger');
      }
    });
  };

  const field =
    'w-full rounded-lg border bg-transparent px-3 py-2 text-[13.5px] outline-none transition-colors placeholder:text-[#52525B] focus:border-white/20';
  return (
    <div
      className="mt-6 flex flex-col gap-2.5 rounded-2xl border p-4"
      style={{ borderColor: C.hair, background: 'rgba(255,255,255,0.02)' }}
    >
      <p className="text-[13px] font-medium" style={{ color: C.fg }}>
        Neuer Kontakt
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name *" className={field} style={{ borderColor: C.hair, color: C.fg }} />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Firma (optional)" className={field} style={{ borderColor: C.hair, color: C.fg }} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (optional)" className={field} style={{ borderColor: C.hair, color: C.fg }} />
        <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status (frei)" list="create-status-suggestions" className={field} style={{ borderColor: C.hair, color: C.fg }} />
        <datalist id="create-status-suggestions">
          {STATUS_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <input
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        placeholder="E-Mail-Adressen (Komma-getrennt, optional)"
        className={field}
        style={{ borderColor: C.hair, color: C.fg }}
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notiz (optional) …"
        rows={2}
        maxLength={2000}
        className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-[13.5px] leading-relaxed outline-none transition-colors placeholder:text-[#52525B] focus:border-white/20"
        style={{ borderColor: C.hair, color: C.fg }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim()}
          className="rounded-md px-3 py-1.5 text-[12.5px] font-medium leading-none transition-colors disabled:opacity-50"
          style={{ background: '#E8B86D', color: '#0A0A0C' }}
        >
          {pending ? 'Anlegen …' : 'Kontakt anlegen'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="text-[12.5px] transition-colors disabled:opacity-50"
          style={{ color: C.faint }}
        >
          Abbrechen
        </button>
        <span className="ml-auto text-[11px]" style={{ color: C.calm }}>
          Zugeordnete Mails heften sich automatisch an.
        </span>
      </div>
    </div>
  );
}
