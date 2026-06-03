'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CustomerOverviewRow, ClientSuggestion } from '@/lib/db/queries/clients';
import { createManualContact, updateManualContact } from '@/lib/actions/customers';
import { tagSenderAsClient, dismissClientSuggestion } from '@/lib/actions/contact-tags';
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
  suggestions = [],
}: {
  rows: CustomerOverviewRow[];
  canCreate?: boolean;
  currentUserId?: string;
  suggestions?: ClientSuggestion[];
}) {
  const [sort, setSort] = useState<Sort>('urgency');
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  // 'all' | 'mine' | <memberId>
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  // Distinct statuses + assignees present → drive the filter dropdowns.
  const statuses = useMemo(
    () =>
      [...new Set(rows.map((r) => r.status?.trim()).filter((x): x is string => !!x))].sort((a, b) =>
        a.localeCompare(b, 'de')
      ),
    [rows]
  );
  const assignees = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.assignedTo) m.set(r.assignedTo.id, r.assignedTo.name);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (assigneeFilter === 'mine') {
        if (!(r.entity === 'tag' || r.assignedTo?.id === currentUserId)) return false;
      } else if (assigneeFilter !== 'all') {
        if (r.assignedTo?.id !== assigneeFilter) return false;
      }
      if (statusFilter !== 'all' && (r.status ?? '') !== statusFilter) return false;
      if (q && !`${r.displayName} ${r.company ?? ''} ${r.identifier}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rows, query, statusFilter, assigneeFilter, currentUserId]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sort === 'name') copy.sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
    else if (sort === 'recent')
      copy.sort((a, b) => (a.lastInteractionDays ?? Infinity) - (b.lastInteractionDays ?? Infinity));
    // 'urgency' keeps the server order (overdue → waiting → open → recent).
    return copy;
  }, [filtered, sort]);

  const needAttention = rows.filter((r) => r.overdueCommitments > 0 || r.waitingDays !== null).length;

  return (
    <main className="min-h-screen" style={{ background: C.bg, color: C.fg }}>
      <div className="mx-auto w-full max-w-5xl px-5 pb-24 pt-24 sm:px-8">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.01em] sm:text-[26px]">Kunden</h1>
            <p className="mt-1 text-[13px]" style={{ color: C.faint }}>
              {rows.length === 0
                ? 'Markiere Absender im Posteingang als Kunde oder leg einen Kontakt an.'
                : `${rows.length} ${rows.length === 1 ? 'Kontakt' : 'Kontakte'}${
                    needAttention > 0
                      ? ` · ${needAttention} ${needAttention === 1 ? 'braucht' : 'brauchen'} Aufmerksamkeit`
                      : ' · alles ruhig'
                  }`}
            </p>
          </div>
          {canCreate && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="shrink-0 rounded-lg border px-3 py-1.5 text-[13px] font-medium leading-none transition-colors hover:bg-[#E8B86D]/[0.06]"
              style={{ borderColor: 'rgba(232,184,109,0.35)', color: C.gold }}
            >
              + Neuer Kontakt
            </button>
          )}
        </header>

        {canCreate && creating && <CreateContactForm onClose={() => setCreating(false)} />}
        {suggestions.length > 0 && <SuggestionStrip suggestions={suggestions} />}

        {rows.length === 0 ? (
          <div
            className="mt-8 rounded-2xl border p-6 text-[13.5px] leading-relaxed"
            style={{ borderColor: C.hair, background: 'rgba(255,255,255,0.015)', color: C.muted }}
          >
            Noch keine Kunden. Markier Absender im Posteingang als Kunde — oder leg oben einen
            Kontakt an. Sie erscheinen dann hier mit allem, was offen ist.
          </div>
        ) : (
          <>
            {/* Toolbar — Suchen · Status · Zuständig · Sortierung */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <span aria-hidden style={{ color: C.faint }}>⌕</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Suchen"
                  aria-label="Kunden suchen"
                  className="w-28 bg-transparent text-[12.5px] outline-none placeholder:text-[#7c7c83] sm:w-40"
                  style={{ color: C.fg }}
                />
              </div>
              {statuses.length > 0 && (
                <Dropdown
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[{ value: 'all', label: 'Alle' }, ...statuses.map((st) => ({ value: st, label: st }))]}
                />
              )}
              {(assignees.length > 0 || currentUserId) && (
                <Dropdown
                  label="Zuständig"
                  value={assigneeFilter}
                  onChange={setAssigneeFilter}
                  options={[
                    { value: 'all', label: 'Alle' },
                    ...(currentUserId ? [{ value: 'mine', label: 'Meine' }] : []),
                    ...assignees.map((a) => ({ value: a.id, label: a.name.split(' ')[0] })),
                  ]}
                />
              )}
              <div className="ml-auto flex items-center gap-1">
                <span className="text-[12px]" style={{ color: C.faint }}>Sortiert:</span>
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
                    className="rounded-md px-2 py-1 text-[12px] font-medium leading-none transition-colors"
                    style={sort === key ? { color: C.gold } : { color: C.faint }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[680px]">
                <div
                  className="grid gap-2 px-3 pb-2"
                  style={{ gridTemplateColumns: GRID, borderBottom: `0.5px solid ${C.hair}` }}
                >
                  {['Kontakt', 'Status', 'Letzter Kontakt', 'Zuständig', ''].map((h, i) => (
                    <span
                      key={i}
                      className="text-[10.5px] uppercase tracking-[0.08em]"
                      style={{ color: C.faint }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {sorted.map((r) => (
                  <CustomerTableRow key={r.id} row={r} currentUserId={currentUserId} />
                ))}
                {sorted.length === 0 && (
                  <p className="px-3 py-6 text-[13px]" style={{ color: C.calm }}>
                    Keine Treffer für diese Filter.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// Column ratios mirror the CRM-table mockup: Kontakt · Status · Letzter Kontakt
// · Zuständig · chevron.
const GRID = '2.2fr 1.1fr 1.4fr 1fr 0.4fr';

type PillTone = 'urgent' | 'positive' | 'neutral' | 'cold';
const PILL: Record<PillTone, { color: string; background: string }> = {
  urgent: { color: '#E8B86D', background: 'rgba(232,184,109,0.12)' },
  positive: { color: '#5ee08a', background: 'rgba(94,224,138,0.10)' },
  neutral: { color: '#9c9c9d', background: 'rgba(255,255,255,0.05)' },
  cold: { color: '#7c7c83', background: 'rgba(255,255,255,0.03)' },
};

/** Tone of a free status string (Kunde/interessiert → positive, etc.). */
function classifyStatus(status: string): PillTone {
  const s = status.toLowerCase();
  return /kein interesse/.test(s) ? 'cold' : /kunde|interess/.test(s) ? 'positive' : 'neutral';
}

// Read-only status pill (used for tagged clients, which have no editable status):
// urgency wins (the actionable signal), else nothing.
function statusPill(row: CustomerOverviewRow, isMe: boolean): { label: string; tone: PillTone } | null {
  if (row.overdueCommitments > 0) return { label: 'überfällige Zusage', tone: 'urgent' };
  if (row.waitingDays !== null) return { label: isMe ? 'wartet auf dich' : 'wartet', tone: 'urgent' };
  if (row.openCommitments > 0) return { label: 'offene Zusage', tone: 'urgent' };
  if (row.status) return { label: row.status, tone: classifyStatus(row.status) };
  return null;
}

const OPT_STYLE = { background: '#111214', color: '#F0F0F2' } as const;

// Editable status for a manual contact — click the pill, pick a new status.
// A styled native <select> so its dropdown never gets clipped by the table's
// horizontal scroll container.
function StatusCell({ row }: { row: CustomerOverviewRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const current = row.status ?? '';
  const tone: PillTone = current ? classifyStatus(current) : 'neutral';

  const change = (value: string) => {
    if (value === current) return;
    start(async () => {
      // Empty option clears the status ('' → null).
      const r = await updateManualContact({ customerId: row.id, status: value || null }).catch(
        () => ({ ok: false as const, error: 'Status ändern fehlgeschlagen.' })
      );
      if (r.ok) {
        toast('Status aktualisiert', 'success');
        router.refresh();
      } else {
        toast(r.error ?? 'Status ändern fehlgeschlagen.', 'danger');
      }
    });
  };

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      disabled={pending}
      aria-label="Status ändern"
      title={current || 'Status ändern'}
      className="max-w-full cursor-pointer appearance-none truncate rounded-md px-2 py-[3px] text-[11.5px] outline-none transition-opacity disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#E8B86D]/40"
      style={
        current
          ? { color: PILL[tone].color, background: PILL[tone].background }
          : { color: C.faint, background: 'rgba(255,255,255,0.04)' }
      }
    >
      <option value="" style={OPT_STYLE}>
        {current ? 'Kein Status' : 'Status setzen'}
      </option>
      {STATUS_SUGGESTIONS.map((s) => (
        <option key={s} value={s} style={OPT_STYLE}>
          {s}
        </option>
      ))}
    </select>
  );
}

function Dropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px]"
      style={{ background: 'rgba(255,255,255,0.04)', color: '#9c9c9d' }}
    >
      <span style={{ color: '#7c7c83' }}>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} filtern`}
        className="cursor-pointer bg-transparent text-[12.5px] outline-none"
        style={{ color: '#F0F0F2' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: '#111214', color: '#F0F0F2' }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CustomerTableRow({
  row,
  currentUserId,
}: {
  row: CustomerOverviewRow;
  currentUserId?: string;
}) {
  const isMe = !!currentUserId && row.assignedTo?.id === currentUserId;
  const pill = statusPill(row, isMe);
  // Attention = any open obligation, matching statusPill's gold "Zusage" tones,
  // so the left-accent and the pill never disagree.
  const attention =
    row.overdueCommitments > 0 || row.waitingDays !== null || row.openCommitments > 0;
  const cold = pill?.tone === 'cold';
  const sub = row.company || (row.entity === 'tag' ? row.identifier : '—');

  return (
    <div
      className="grid items-center gap-2 px-3 transition-colors hover:bg-white/[0.02]"
      style={{
        gridTemplateColumns: GRID,
        padding: '11px 12px',
        borderBottom: `0.5px solid ${C.hair}`,
        borderLeft: `2px solid ${attention ? C.gold : 'transparent'}`,
        opacity: cold ? 0.65 : 1,
      }}
    >
      {/* Kontakt */}
      <div className="min-w-0">
        <div className="truncate text-[14.5px]" style={{ color: C.fg }}>
          {row.displayName}
        </div>
        <div className="truncate text-[12px]" style={{ color: C.faint }}>
          {sub}
        </div>
      </div>

      {/* Status — editable for manual contacts, read-only for tagged clients */}
      <div className="min-w-0">
        {row.entity === 'manual' ? (
          <StatusCell row={row} />
        ) : pill ? (
          <span
            className="inline-block truncate rounded-md px-2 py-[3px] text-[11.5px]"
            style={{ color: PILL[pill.tone].color, background: PILL[pill.tone].background }}
          >
            {pill.label}
          </span>
        ) : null}
      </div>

      {/* Letzter Kontakt (+ who, if known) */}
      <div className="flex min-w-0 items-center gap-1.5">
        {row.lastInteractionBy && (
          <span
            className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[9px]"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#9c9c9d' }}
            title={`Zuletzt: ${row.lastInteractionBy.name}`}
          >
            {row.lastInteractionBy.initials}
          </span>
        )}
        <span className="truncate text-[13px]" style={{ color: attention ? C.gold : C.muted }}>
          {relDays(row.lastInteractionDays)}
          {row.overdueCommitments > 0 ? ' · überfällig' : ''}
        </span>
      </div>

      {/* Zuständig */}
      <div className="flex min-w-0 items-center gap-1.5">
        {row.assignedTo ? (
          <>
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px]"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9c9c9d' }}
            >
              {row.assignedTo.initials}
            </span>
            <span className="truncate text-[12.5px]" style={{ color: '#9c9c9d' }}>
              {isMe ? 'Du' : row.assignedTo.name.split(' ')[0]}
            </span>
          </>
        ) : (
          <span className="text-[12.5px]" style={{ color: C.calm }}>—</span>
        )}
      </div>

      {/* Chevron — the ONLY thing that opens the detail view, so make it a
          clearly visible, focusable target. */}
      <div className="flex justify-end">
        <Link
          href={`/kunden/${row.id}`}
          aria-label={`${row.displayName} öffnen`}
          title={`${row.displayName} öffnen`}
          className="rounded px-1.5 py-0.5 text-[16px] leading-none transition-colors hover:text-[#F0F0F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8B86D]/40"
          style={{ color: C.muted }}
        >
          ›
        </Link>
      </div>
    </div>
  );
}

// Gentle auto-customer SUGGESTIONS — frequent untagged senders. Pure proposal:
// one tap to tag, one tap to dismiss. Never auto-tags.
function SuggestionStrip({ suggestions }: { suggestions: ClientSuggestion[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [handled, setHandled] = useState<Record<string, boolean>>({});

  const visible = suggestions.filter((sug) => !handled[sug.email]);
  if (visible.length === 0) return null;

  const act = (email: string, fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => {
    setHandled((h) => ({ ...h, [email]: true }));
    startTransition(async () => {
      const r = await fn().catch(() => ({ ok: false, error: 'Fehlgeschlagen.' }));
      if (r.ok) {
        toast(msg, 'success');
        router.refresh();
      } else {
        setHandled((h) => ({ ...h, [email]: false }));
        toast(r.error ?? 'Fehlgeschlagen.', 'danger');
      }
    });
  };

  return (
    <div
      className="mt-6 flex flex-col gap-2 rounded-2xl border p-4"
      style={{ borderColor: C.hair, background: 'rgba(255,255,255,0.015)' }}
    >
      <p className="text-[12px]" style={{ color: C.faint }}>
        Häufige Absender — als Kunde markieren? (Vorschlag, kein Automatismus.)
      </p>
      <ul className="flex flex-col gap-1.5">
        {visible.map((sug) => (
          <li
            key={sug.email}
            className="flex items-center gap-3 rounded-lg border px-3 py-2"
            style={{ borderColor: C.hair, background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium" style={{ color: C.fg }}>
                {sug.name}
              </p>
              <p className="truncate font-mono text-[11px]" style={{ color: C.faint }}>
                {sug.email} · {sug.count}× Kontakt
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                act(
                  sug.email,
                  () => tagSenderAsClient({ email: sug.email, scope: 'email', displayName: sug.name }),
                  'Als Kunde markiert.'
                )
              }
              className="shrink-0 rounded-md px-2.5 py-1.5 text-[12px] font-medium leading-none transition-colors disabled:opacity-50"
              style={{ background: 'rgba(232,184,109,0.14)', color: C.gold }}
            >
              Als Kunde
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                act(sug.email, () => dismissClientSuggestion(sug.email), 'Vorschlag ausgeblendet.')
              }
              className="shrink-0 text-[12px] transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ color: C.faint }}
            >
              Ignorieren
            </button>
          </li>
        ))}
      </ul>
    </div>
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
