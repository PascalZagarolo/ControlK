'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CustomerDetail, DetailCommitment } from '@/lib/db/queries/clients';
import {
  confirmCommitment,
  dismissCommitment,
  resolveCommitment,
  commitmentToTodo,
  snoozeCommitment,
} from '@/lib/actions/commitments';
import { updateContactTag } from '@/lib/actions/contact-tags';
import { toast } from '@/lib/stores/toast-store';

// Calm customer DETAIL (wedge) — a read-only summary of what Ctrl+K knows
// about one tagged client: open/done promises (with their source sentence),
// threads that need a reply, an interaction timeline from mail metadata, and
// one optional free-text note. The only manual input is the note + acting on
// commitments (confirm/dismiss/resolve/→todo) which already exist (Prompt 3).

const C = {
  bg: '#0A0A0C',
  fg: '#F0F0F2',
  muted: '#9c9c9d',
  faint: '#7c7c83',
  hair: 'rgba(255,255,255,0.06)',
  panel: 'rgba(255,255,255,0.02)',
  overdue: '#ff8a8a',
  waiting: '#5E9EFF',
  gold: '#E8B86D',
  done: '#5ee08a',
  calm: '#52525B',
};

function fmtDate(iso: string): string {
  // Deterministic (UTC date portion) — no Intl/timezone hydration drift.
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

export function KundeWedgeDetailClient({ detail }: { detail: CustomerDetail }) {
  return (
    <main className="min-h-screen" style={{ background: C.bg, color: C.fg }}>
      <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-20 sm:px-8">
        <Link
          href="/kunden"
          className="text-[12.5px] transition-colors hover:opacity-80"
          style={{ color: C.faint }}
        >
          ← Kunden
        </Link>

        <header className="mt-4 flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.01em]">{detail.displayName}</h1>
          <p className="font-mono text-[12px]" style={{ color: C.faint }}>
            {detail.identifier}
            {detail.kind === 'domain' && ' · ganze Firma'}
          </p>
        </header>

        <NoteEditor tagId={detail.tagId} initial={detail.note} />

        <Section
          title="Offene Zusagen"
          count={detail.openCommitments.length}
          empty="Keine offenen Zusagen an diesen Kunden."
        >
          {detail.openCommitments.map((c) => (
            <CommitmentCard key={c.id} c={c} />
          ))}
        </Section>

        <Section
          title="Braucht Antwort"
          count={detail.waitingThreads.length}
          empty="Niemand wartet gerade auf eine Antwort."
        >
          {detail.waitingThreads.map((t) => (
            <Link
              key={t.id}
              href={`/inbox/${t.id}`}
              className="flex items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-colors hover:bg-white/[0.02]"
              style={{ borderColor: C.hair, background: C.panel }}
            >
              <span aria-hidden className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: C.waiting }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium" style={{ color: C.fg }}>
                  {t.subject || '(kein Betreff)'}
                </p>
                {t.preview && (
                  <p className="mt-0.5 truncate text-[12px]" style={{ color: C.muted }}>
                    {t.preview}
                  </p>
                )}
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
              <div
                key={c.id}
                className="flex items-start gap-3 rounded-xl border px-3.5 py-2.5"
                style={{ borderColor: C.hair, background: C.panel }}
              >
                <span aria-hidden className="mt-[3px] text-[12px]" style={{ color: C.done }}>
                  ✓
                </span>
                <p className="text-[13px]" style={{ color: C.muted }}>
                  {c.promiseText}
                </p>
              </div>
            ))}
          </Section>
        )}

        <Section
          title="Verlauf"
          count={detail.timeline.length}
          empty="Noch keine Mails mit diesem Kunden."
        >
          <ol className="flex flex-col">
            {detail.timeline.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 border-b py-2 last:border-b-0"
                style={{ borderColor: C.hair }}
              >
                <span
                  className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.2px]"
                  style={{ color: e.direction === 'sent' ? C.faint : C.waiting, width: 56 }}
                >
                  {e.direction === 'sent' ? 'Gesendet' : 'Erhalten'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: C.fg }}>
                  {e.subject || '(kein Betreff)'}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums" style={{ color: C.faint }}>
                  {fmtDate(e.receivedAt)}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>
          {title}
        </h2>
        {count > 0 && (
          <span className="font-mono text-[11px]" style={{ color: C.calm }}>
            {count}
          </span>
        )}
      </div>
      {count === 0 && empty ? (
        <p className="text-[13px]" style={{ color: C.calm }}>
          {empty}
        </p>
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
      if (r.ok) {
        toast(okMsg, 'success');
        router.refresh();
      } else {
        toast(r.error ?? 'Aktion fehlgeschlagen.', 'danger');
      }
    });
  };

  const accent = c.overdueDays !== null ? C.overdue : c.isQuestion ? C.gold : C.muted;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border px-3.5 py-3"
      style={{ borderColor: C.hair, background: C.panel }}
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium" style={{ color: C.fg }}>
            {c.isQuestion ? `${c.promiseText.replace(/\?+$/, '')}?` : c.promiseText}
          </p>
          {/* Explainability — the verbatim source sentence (Prompt 3). */}
          <p className="mt-1 border-l-2 pl-2.5 text-[12px] italic" style={{ borderColor: C.hair, color: C.faint }}>
            „{c.sourceQuote}“
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px]">
            {c.overdueDays !== null ? (
              <span style={{ color: C.overdue }}>
                {c.overdueDays} {c.overdueDays === 1 ? 'Tag' : 'Tage'} überfällig
              </span>
            ) : c.dueAt ? (
              <span style={{ color: C.muted }}>fällig {fmtDate(c.dueAt)}</span>
            ) : null}
            {c.dueBasis && <span style={{ color: C.calm }}>„{c.dueBasis}“</span>}
            {c.isQuestion && <span style={{ color: C.gold }}>unsicher — bitte bestätigen</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-4">
        {c.isQuestion && (
          <ActionButton label="Ist eine Zusage" onClick={() => act(() => confirmCommitment(c.id), 'Bestätigt.')} disabled={pending} primary />
        )}
        <ActionButton label="Erledigt" onClick={() => act(() => resolveCommitment(c.id), 'Als erledigt markiert.')} disabled={pending} />
        <ActionButton label="Nicht heute" onClick={() => act(() => snoozeCommitment(c.id), 'Auf morgen verschoben.')} disabled={pending} subtle />
        <ActionButton label="Als Todo" onClick={() => act(() => commitmentToTodo(c.id), 'Todo erstellt.')} disabled={pending} />
        <ActionButton label="Verwerfen" onClick={() => act(() => dismissCommitment(c.id), 'Verworfen.')} disabled={pending} subtle />
        {c.sourceItemId && (
          <Link
            href={`/inbox/${c.sourceItemId}`}
            className="rounded-md px-2 py-1 text-[11.5px] transition-colors hover:opacity-80"
            style={{ color: C.faint }}
          >
            Zur Mail →
          </Link>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  primary,
  subtle,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-2 py-1 text-[11.5px] font-medium leading-none transition-colors disabled:opacity-50"
      style={
        primary
          ? { background: 'rgba(232,184,109,0.12)', color: C.gold }
          : subtle
            ? { color: C.faint }
            : { background: 'rgba(255,255,255,0.05)', color: C.fg }
      }
    >
      {label}
    </button>
  );
}

function NoteEditor({ tagId, initial }: { tagId: string; initial: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? '');
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== (initial ?? '').trim();

  const save = () => {
    startTransition(async () => {
      const r = await updateContactTag({ id: tagId, note: value }).catch(() => ({
        ok: false,
        error: 'Speichern fehlgeschlagen.',
      }));
      if (r.ok) {
        toast('Notiz gespeichert.', 'success');
        router.refresh();
      } else {
        toast(r.error ?? 'Speichern fehlgeschlagen.', 'danger');
      }
    });
  };

  return (
    <div className="mt-6">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Notiz zu diesem Kunden (optional) …"
        rows={2}
        maxLength={2000}
        className="w-full resize-none rounded-xl border bg-transparent px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none transition-colors placeholder:text-[#52525B] focus:border-white/20"
        style={{ borderColor: C.hair, color: C.fg }}
      />
      {dirty && (
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-md px-2.5 py-1 text-[12px] font-medium leading-none transition-colors disabled:opacity-50"
            style={{ background: 'rgba(255,255,255,0.06)', color: C.fg }}
          >
            {pending ? 'Speichern …' : 'Notiz speichern'}
          </button>
          <button
            type="button"
            onClick={() => setValue(initial ?? '')}
            disabled={pending}
            className="text-[12px] transition-colors disabled:opacity-50"
            style={{ color: C.faint }}
          >
            Verwerfen
          </button>
        </div>
      )}
    </div>
  );
}
