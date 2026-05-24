import Link from 'next/link';
import type { InboxDetailContext } from '@/lib/db/queries/inbox-detail';

// Right-rail context for the email detail view. The whole point of the
// view: surface what the workspace knows about this sender, so reading
// the mail comes with context other tools can't show.
//
// Layout: server component, 340px column. Order matters — customer
// match first (the strongest signal), then sender history (always
// available when senderEmail is set), then customer-derived todos and
// notes (only when we matched a customer).
export function InboxContextRail({ context }: { context: InboxDetailContext }) {
  const { customer, senderHistory, customerTodos, customerNotes } = context;

  const isFullyEmpty =
    !customer && senderHistory.length === 0;

  if (isFullyEmpty) {
    return (
      <div className="flex flex-col gap-2 rounded-[10px] border border-[#1F1F23] bg-white/[0.015] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
          Kontext
        </p>
        <p className="text-[12.5px] leading-[1.55] text-ink-300">
          Diesen Absender erkennen wir noch nicht im Workspace. Sobald du
          ihn als Kontakt anlegst, erscheinen hier Kunden-Card,
          Verträge und offene Todos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {customer && <CustomerCard customer={customer} />}

      {senderHistory.length > 0 && (
        <SenderHistoryBlock items={senderHistory} />
      )}

      {customerTodos.length > 0 && (
        <CustomerTodosBlock customerSlug={customer?.slug ?? ''} todos={customerTodos} />
      )}

      {customerNotes.length > 0 && (
        <CustomerNotesBlock notes={customerNotes} />
      )}
    </div>
  );
}

function CustomerCard({
  customer,
}: {
  customer: NonNullable<InboxDetailContext['customer']>;
}) {
  return (
    <Link
      href={`/kunden/${customer.id}`}
      className="group flex flex-col gap-3 rounded-[10px] border border-[#1F1F23] bg-white/[0.025] p-4 transition-colors hover:border-[#2A2A30]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-medium leading-none text-white"
          style={{
            background: `linear-gradient(135deg, ${customer.fromColor}, ${customer.toColor})`,
          }}
        >
          {customer.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <p className="truncate text-[14px] font-medium leading-tight text-ink-50">
              {customer.name}
            </p>
            <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-300">
              {customer.status}
            </span>
          </div>
          {customer.matchedContact && (
            <p className="mt-0.5 truncate text-[11.5px] leading-tight text-ink-300">
              {customer.matchedContact.name}
              {customer.matchedContact.role && ` · ${customer.matchedContact.role}`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-white/[0.04] pt-3 text-[11.5px]">
        <Stat label="Offene Todos" value={customer.openTodos} />
        <Stat label="Aktive Verträge" value={customer.activeContracts} />
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300 transition-colors group-hover:text-[#E8B86D]">
          Öffnen →
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[15px] font-medium leading-tight text-ink-50">
        {value}
      </span>
      <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-300">
        {label}
      </span>
    </div>
  );
}

function SenderHistoryBlock({
  items,
}: {
  items: InboxDetailContext['senderHistory'];
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
        Letzte Mails vom Absender
      </p>
      <ul className="flex flex-col">
        {items.map((m) => (
          <li key={m.id}>
            <Link
              href={`/inbox/${m.id}`}
              className="-mx-2 flex flex-col gap-0.5 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
            >
              <p
                className={`truncate text-[12.5px] leading-tight ${
                  m.isRead ? 'text-ink-200' : 'text-ink-50 font-medium'
                }`}
              >
                {m.subject || '(kein Betreff)'}
              </p>
              <p className="truncate text-[11px] leading-tight text-ink-300">
                {formatRel(m.receivedAt)} · {m.preview ?? ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CustomerTodosBlock({
  customerSlug,
  todos,
}: {
  customerSlug: string;
  todos: InboxDetailContext['customerTodos'];
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
        Offene Todos
      </p>
      <ul className="flex flex-col gap-1">
        {todos.map((t) => (
          <li
            key={t.id}
            className="flex items-baseline gap-2 rounded-md bg-white/[0.02] px-2.5 py-1.5"
          >
            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8B86D]" />
            <span className="flex-1 truncate text-[12.5px] leading-tight text-ink-100">
              {t.title}
            </span>
            {t.dueAt && (
              <span className="font-mono text-[10px] text-ink-300">
                {formatShortDate(t.dueAt)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CustomerNotesBlock({
  notes,
}: {
  notes: InboxDetailContext['customerNotes'];
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
        Notizen mit Erwähnung
      </p>
      <ul className="flex flex-col gap-1">
        {notes.map((n) => (
          <li key={n.id}>
            <Link
              href={`/notes/${n.noteId}`}
              className="block truncate rounded-md bg-white/[0.02] px-2.5 py-1.5 text-[12.5px] leading-tight text-ink-100 transition-colors hover:bg-white/[0.05]"
            >
              {n.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 60) return `vor ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h}h`;
  const d = Math.round(h / 24);
  if (d < 14) return `vor ${d}d`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}
