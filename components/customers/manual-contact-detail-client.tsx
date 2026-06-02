'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ManualContactDetail, DetailCommitment } from '@/lib/db/queries/clients';
import {
  updateManualContact,
  addContactEmail,
  removeContactEmail,
  setContactAssignee,
  addContactNote,
  deleteContactNote,
} from '@/lib/actions/customers';
import {
  confirmCommitment,
  dismissCommitment,
  resolveCommitment,
  commitmentToTodo,
  snoozeCommitment,
} from '@/lib/actions/commitments';
import { toast } from '@/lib/stores/toast-store';

// Manual contact DETAIL (shared business contact). Editable contact fields +
// multi-email management; the rest is the same calm READ-ONLY summary as a
// tagged client (commitments with source sentence, threads needing a reply,
// a workspace-wide interaction timeline showing WHO interacted). No pipeline
// stages, no activity logging — just these fields + acting on commitments.

const C = {
  bg: '#0A0A0C', fg: '#F0F0F2', muted: '#9c9c9d', faint: '#7c7c83',
  hair: 'rgba(255,255,255,0.06)', panel: 'rgba(255,255,255,0.02)',
  overdue: '#ff8a8a', waiting: '#5E9EFF', gold: '#E8B86D', done: '#5ee08a', calm: '#52525B',
};
const STATUS_SUGGESTIONS = ['neu', 'kontaktiert', 'interessiert', 'kein Interesse', 'Kunde'];

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

function relTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return fmtDate(iso);
}

export function ManualContactDetailClient({
  detail,
  currentUserId,
}: {
  detail: ManualContactDetail;
  currentUserId?: string;
}) {
  // The most recent timeline entry tells us who last interacted (team view).
  const last = detail.timeline[0];
  return (
    <main className="min-h-screen" style={{ background: C.bg, color: C.fg }}>
      <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-20 sm:px-8">
        <Link href="/kunden" className="text-[12.5px] transition-colors hover:opacity-80" style={{ color: C.faint }}>
          ← Kunden
        </Link>

        <ContactHeader detail={detail} />
        {last && (
          <p className="mt-2 text-[12.5px]" style={{ color: C.muted }}>
            Zuletzt: {last.byName ? last.byName.split(' ')[0] : 'jemand'},{' '}
            {relTime(last.receivedAt)} —{' '}
            {last.direction === 'sent' ? 'ihr habt geschrieben' : `${detail.name} hat geantwortet`}
          </p>
        )}
        <AssigneeSelector detail={detail} currentUserId={currentUserId} />
        <ContactFields detail={detail} />
        <EmailManager id={detail.id} emails={detail.emails} />
        <UpdatesThread id={detail.id} notes={detail.notes} currentUserId={currentUserId} />

        <Section title="Offene Zusagen" count={detail.openCommitments.length} empty="Keine offenen Zusagen an diesen Kontakt.">
          {detail.openCommitments.map((c) => <CommitmentCard key={c.id} c={c} />)}
        </Section>

        <Section title="Braucht Antwort" count={detail.waitingThreads.length} empty="Niemand wartet gerade auf eine Antwort.">
          {detail.waitingThreads.map((t) => (
            <Link key={t.id} href={`/inbox/${t.id}`}
              className="flex items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={{ borderColor: C.hair, background: C.panel }}>
              <span aria-hidden className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.waiting }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium" style={{ color: C.fg }}>{t.subject || '(kein Betreff)'}</p>
                {t.preview && <p className="mt-0.5 truncate text-[12px]" style={{ color: C.muted }}>{t.preview}</p>}
              </div>
              <span className="shrink-0 font-mono text-[11px]" style={{ color: C.waiting }}>
                {t.waitingDays} {t.waitingDays === 1 ? 'Tag' : 'Tage'}
              </span>
            </Link>
          ))}
        </Section>

        {detail.doneCommitments.length > 0 && (
          <Section title="Erledigte Zusagen" count={detail.doneCommitments.length}>
            {detail.doneCommitments.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl border px-3.5 py-2.5" style={{ borderColor: C.hair, background: C.panel }}>
                <span aria-hidden className="mt-[3px] text-[12px]" style={{ color: C.done }}>✓</span>
                <p className="text-[13px]" style={{ color: C.muted }}>{c.promiseText}</p>
              </div>
            ))}
          </Section>
        )}

        <Section title="Verlauf" count={detail.timeline.length} empty="Noch keine Mails mit diesem Kontakt.">
          <ol className="flex flex-col">
            {detail.timeline.map((e) => (
              <li key={e.id} className="flex items-center gap-3 border-b py-2 last:border-b-0" style={{ borderColor: C.hair }}>
                <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.2px]"
                  style={{ color: e.direction === 'sent' ? C.faint : C.waiting, width: 56 }}>
                  {e.direction === 'sent' ? 'Gesendet' : 'Erhalten'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: C.fg }}>{e.subject || '(kein Betreff)'}</span>
                {/* Team view: who on the team interacted. */}
                {e.byName && <span className="shrink-0 text-[11px]" style={{ color: C.calm }}>{e.byName.split(' ')[0]}</span>}
                <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: C.faint }}>{fmtDate(e.receivedAt)}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </main>
  );
}

function ContactHeader({ detail }: { detail: ManualContactDetail }) {
  return (
    <header className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-[26px] font-semibold tracking-[-0.01em]">{detail.name}</h1>
      {detail.company && <span className="text-[14px]" style={{ color: C.muted }}>· {detail.company}</span>}
      {detail.status && (
        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: 'rgba(255,255,255,0.05)', color: C.muted }}>
          {detail.status}
        </span>
      )}
      <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2px]" style={{ color: C.calm }}>
        Manuell angelegt
      </span>
    </header>
  );
}

function ContactFields({ detail }: { detail: ManualContactDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(detail.name);
  const [company, setCompany] = useState(detail.company ?? '');
  const [phone, setPhone] = useState(detail.phone ?? '');
  const [status, setStatus] = useState(detail.status ?? '');
  const [note, setNote] = useState(detail.note ?? '');

  const dirty =
    name.trim() !== detail.name ||
    company.trim() !== (detail.company ?? '') ||
    phone.trim() !== (detail.phone ?? '') ||
    status.trim() !== (detail.status ?? '') ||
    note.trim() !== (detail.note ?? '');

  const save = () => {
    if (!name.trim()) { toast('Name darf nicht leer sein.', 'danger'); return; }
    startTransition(async () => {
      const r = await updateManualContact({
        customerId: detail.id, name, company, phone, status, note,
      }).catch(() => ({ ok: false, error: 'Speichern fehlgeschlagen.' }));
      if (r.ok) { toast('Gespeichert.', 'success'); router.refresh(); }
      else toast(r.error ?? 'Speichern fehlgeschlagen.', 'danger');
    });
  };

  const field = 'w-full rounded-lg border bg-transparent px-3 py-2 text-[13.5px] outline-none transition-colors placeholder:text-[#52525B] focus:border-white/20';
  return (
    <div className="mt-6 flex flex-col gap-2.5 rounded-2xl border p-4" style={{ borderColor: C.hair, background: C.panel }}>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={field} style={{ borderColor: C.hair, color: C.fg }} />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Firma (optional)" className={field} style={{ borderColor: C.hair, color: C.fg }} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon (optional)" className={field} style={{ borderColor: C.hair, color: C.fg }} />
        <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status (frei)" list="contact-status-suggestions" className={field} style={{ borderColor: C.hair, color: C.fg }} />
        <datalist id="contact-status-suggestions">
          {STATUS_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz (optional) …" rows={2} maxLength={2000}
        className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-[13.5px] leading-relaxed outline-none transition-colors placeholder:text-[#52525B] focus:border-white/20"
        style={{ borderColor: C.hair, color: C.fg }} />
      {dirty && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={pending}
            className="rounded-md px-2.5 py-1 text-[12px] font-medium leading-none transition-colors disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.06)', color: C.fg }}>
            {pending ? 'Speichern …' : 'Speichern'}
          </button>
        </div>
      )}
    </div>
  );
}

function EmailManager({ id, emails }: { id: string; emails: { id: string; email: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState('');

  const add = () => {
    const email = adding.trim().toLowerCase();
    if (!email.includes('@')) { toast('Ungültige E-Mail.', 'danger'); return; }
    startTransition(async () => {
      const r = await addContactEmail({ customerId: id, email }).catch(() => ({ ok: false, error: 'Fehlgeschlagen.' }));
      if (r.ok) { setAdding(''); toast('Adresse zugeordnet.', 'success'); router.refresh(); }
      else toast(r.error ?? 'Fehlgeschlagen.', 'danger');
    });
  };
  const remove = (contactId: string) => {
    startTransition(async () => {
      const r = await removeContactEmail({ customerId: id, contactId }).catch(() => ({ ok: false, error: 'Fehlgeschlagen.' }));
      if (r.ok) { toast('Adresse entfernt.', 'success'); router.refresh(); }
      else toast(r.error ?? 'Fehlgeschlagen.', 'danger');
    });
  };

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>
        E-Mail-Adressen
      </h2>
      <p className="mb-2.5 text-[12px]" style={{ color: C.calm }}>
        Zugeordnete Adressen werden automatisch mit ein- und ausgehender Mail verknüpft.
      </p>
      <ul className="flex flex-col gap-1.5">
        {emails.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-lg border px-3 py-2" style={{ borderColor: C.hair, background: C.panel }}>
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]" style={{ color: C.fg }}>{e.email}</span>
            <button type="button" onClick={() => remove(e.id)} disabled={pending}
              className="shrink-0 text-[11.5px] transition-colors hover:opacity-80 disabled:opacity-50" style={{ color: C.faint }}>
              Entfernen
            </button>
          </li>
        ))}
        {emails.length === 0 && (
          <li className="text-[12.5px]" style={{ color: C.calm }}>Noch keine Adresse zugeordnet.</li>
        )}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <input value={adding} onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="adresse@firma.de" type="email"
          className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-[#52525B] focus:border-white/20"
          style={{ borderColor: C.hair, color: C.fg }} />
        <button type="button" onClick={add} disabled={pending || !adding.trim()}
          className="shrink-0 rounded-lg px-3 py-2 text-[12.5px] font-medium leading-none transition-colors disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.06)', color: C.fg }}>
          Hinzufügen
        </button>
      </div>
    </section>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>{title}</h2>
        {count > 0 && <span className="font-mono text-[11px]" style={{ color: C.calm }}>{count}</span>}
      </div>
      {count === 0 && empty ? (
        <p className="text-[13px]" style={{ color: C.calm }}>{empty}</p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </section>
  );
}

function CommitmentCard({ c }: { c: DetailCommitment }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    startTransition(async () => {
      const r = await fn().catch(() => ({ ok: false, error: 'Aktion fehlgeschlagen.' }));
      if (r.ok) { toast(okMsg, 'success'); router.refresh(); }
      else toast(r.error ?? 'Aktion fehlgeschlagen.', 'danger');
    });
  };
  const accent = c.overdueDays !== null ? C.overdue : c.isQuestion ? C.gold : C.muted;
  return (
    <div className="flex flex-col gap-2 rounded-xl border px-3.5 py-3" style={{ borderColor: C.hair, background: C.panel }}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium" style={{ color: C.fg }}>
            {c.isQuestion ? `${c.promiseText.replace(/\?+$/, '')}?` : c.promiseText}
          </p>
          <p className="mt-1 border-l-2 pl-2.5 text-[12px] italic" style={{ borderColor: C.hair, color: C.faint }}>„{c.sourceQuote}“</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px]">
            {c.overdueDays !== null ? (
              <span style={{ color: C.overdue }}>{c.overdueDays} {c.overdueDays === 1 ? 'Tag' : 'Tage'} überfällig</span>
            ) : c.dueAt ? (
              <span style={{ color: C.muted }}>fällig {fmtDate(c.dueAt)}</span>
            ) : null}
            {c.isQuestion && <span style={{ color: C.gold }}>unsicher — bitte bestätigen</span>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-4">
        {c.isQuestion && <ActionButton label="Ist eine Zusage" onClick={() => act(() => confirmCommitment(c.id), 'Bestätigt.')} disabled={pending} primary />}
        <ActionButton label="Erledigt" onClick={() => act(() => resolveCommitment(c.id), 'Als erledigt markiert.')} disabled={pending} />
        <ActionButton label="Nicht heute" onClick={() => act(() => snoozeCommitment(c.id), 'Auf morgen verschoben.')} disabled={pending} subtle />
        <ActionButton label="Als Todo" onClick={() => act(() => commitmentToTodo(c.id), 'Todo erstellt.')} disabled={pending} />
        <ActionButton label="Verwerfen" onClick={() => act(() => dismissCommitment(c.id), 'Verworfen.')} disabled={pending} subtle />
        {c.sourceItemId && (
          <Link href={`/inbox/${c.sourceItemId}`} className="rounded-md px-2 py-1 text-[11.5px] transition-colors hover:opacity-80" style={{ color: C.faint }}>
            Zur Mail →
          </Link>
        )}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled, primary, subtle }: {
  label: string; onClick: () => void; disabled: boolean; primary?: boolean; subtle?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="rounded-md px-2 py-1 text-[11.5px] font-medium leading-none transition-colors disabled:opacity-50"
      style={primary ? { background: 'rgba(232,184,109,0.12)', color: C.gold } : subtle ? { color: C.faint } : { background: 'rgba(255,255,255,0.05)', color: C.fg }}>
      {label}
    </button>
  );
}

// Lightweight responsibility — a member or "Beide" (null). One field, no flow.
function AssigneeSelector({
  detail,
  currentUserId,
}: {
  detail: ManualContactDetail;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = detail.assignedTo?.id ?? '';

  const choose = (value: string) => {
    startTransition(async () => {
      const r = await setContactAssignee({
        customerId: detail.id,
        assignedTo: value || null,
      }).catch(() => ({ ok: false, error: 'Fehlgeschlagen.' }));
      if (r.ok) router.refresh();
      else toast(r.error ?? 'Fehlgeschlagen.', 'danger');
    });
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-[12px]" style={{ color: C.faint }}>
        Zuständig:
      </span>
      <Chip label="Beide" active={current === ''} onClick={() => choose('')} disabled={pending} />
      {detail.members.map((m) => (
        <Chip
          key={m.id}
          label={m.id === currentUserId ? `${m.name.split(' ')[0]} (du)` : m.name.split(' ')[0]}
          active={current === m.id}
          onClick={() => choose(m.id)}
          disabled={pending}
        />
      ))}
    </div>
  );
}

function Chip({ label, active, onClick, disabled }: {
  label: string; active: boolean; onClick: () => void; disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-2.5 py-1 text-[12px] font-medium leading-none transition-colors disabled:opacity-50"
      style={active ? { background: 'rgba(232,184,109,0.14)', color: C.gold } : { background: 'rgba(255,255,255,0.05)', color: C.muted }}
    >
      {label}
    </button>
  );
}

// Shared chronological updates both partners read + add. Free text, no types.
function UpdatesThread({
  id,
  notes,
  currentUserId,
}: {
  id: string;
  notes: ManualContactDetail['notes'];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState('');

  const add = () => {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      const r = await addContactNote({ customerId: id, text: t }).catch(() => ({ ok: false, error: 'Fehlgeschlagen.' }));
      if (r.ok) { setText(''); router.refresh(); }
      else toast(r.error ?? 'Fehlgeschlagen.', 'danger');
    });
  };
  const remove = (noteId: string) => {
    startTransition(async () => {
      const r = await deleteContactNote({ noteId }).catch(() => ({ ok: false, error: 'Fehlgeschlagen.' }));
      if (r.ok) router.refresh();
      else toast(r.error ?? 'Fehlgeschlagen.', 'danger');
    });
  };

  return (
    <section className="mt-9">
      <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>
        Updates
      </h2>
      <div className="flex items-start gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }}
          placeholder="Kurzes Update fürs Team — z. B. angerufen, will Angebot bis Freitag …"
          rows={2}
          maxLength={2000}
          className="flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-[13px] leading-relaxed outline-none transition-colors placeholder:text-[#52525B] focus:border-white/20"
          style={{ borderColor: C.hair, color: C.fg }}
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !text.trim()}
          className="shrink-0 rounded-lg px-3 py-2 text-[12.5px] font-medium leading-none transition-colors disabled:opacity-50"
          style={{ background: 'rgba(255,255,255,0.06)', color: C.fg }}
        >
          Posten
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="mt-3 text-[13px]" style={{ color: C.calm }}>
          Noch keine Updates. Was dein Partner hier notiert, siehst du sofort.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex items-start gap-3 rounded-xl border px-3.5 py-2.5"
              style={{ borderColor: C.hair, background: C.panel }}
            >
              <span
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', color: C.muted }}
                title={n.authorName ?? 'Unbekannt'}
              >
                {n.authorInitials ?? '—'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: C.fg }}>
                  {n.text}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: C.calm }}>
                  {n.authorName ? n.authorName.split(' ')[0] : 'Unbekannt'} · {relTime(n.createdAt)}
                </p>
              </div>
              {n.authorId && n.authorId === currentUserId && (
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  disabled={pending}
                  className="shrink-0 text-[11px] transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{ color: C.faint }}
                >
                  Löschen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
