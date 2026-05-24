import Link from 'next/link';
import type {
  ProfileCustomer,
  ProfileNote,
  ProfileTodo,
} from '@/lib/db/queries/person-profile';

export function PersonRail({
  customer,
  todos,
  notes,
}: {
  customer: ProfileCustomer | null;
  todos: ProfileTodo[];
  notes: ProfileNote[];
}) {
  // No customer match + no derived artifacts = nothing to put in the
  // rail. The header already shows the person; suppress the empty
  // column so the timeline can have the room.
  if (!customer && todos.length === 0 && notes.length === 0) {
    return (
      <div className="rounded-[10px] border border-white/[0.04] bg-white/[0.015] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
          Kontext
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.55] text-ink-300">
          Diesen Absender erkennen wir noch nicht im Workspace. Lege ihn als
          Kontakt an, dann erscheinen hier verknüpfte Todos, Notizen und
          Vertragsdaten.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {customer && <CustomerSummary customer={customer} />}
      {todos.length > 0 && <TodoBlock todos={todos} />}
      {notes.length > 0 && <NoteBlock notes={notes} />}
    </div>
  );
}

function CustomerSummary({ customer }: { customer: ProfileCustomer }) {
  return (
    <section className="flex flex-col gap-3 rounded-[10px] border border-[#1F1F23] bg-white/[0.025] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
        Kunde
      </p>
      <Link
        href={`/kunden/${customer.id}`}
        className="group flex items-center gap-3"
      >
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
          <p className="truncate text-[14px] font-medium leading-tight text-ink-50">
            {customer.name}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] leading-tight text-ink-300">
            Status: {customer.status}
          </p>
        </div>
        <span
          aria-hidden
          className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-300 transition-colors group-hover:text-[#E8B86D]"
        >
          →
        </span>
      </Link>
      <div className="flex items-baseline gap-4 border-t border-white/[0.04] pt-3 text-[11.5px]">
        <Stat label="Offene Todos" value={customer.openTodos} />
        <Stat label="Aktive Verträge" value={customer.activeContracts} />
      </div>
    </section>
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

function TodoBlock({ todos }: { todos: ProfileTodo[] }) {
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
              <span className="shrink-0 font-mono text-[10px] text-ink-300">
                {formatShortDate(t.dueAt)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoteBlock({ notes }: { notes: ProfileNote[] }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#52525B]">
        Notizen mit Erwähnung
      </p>
      <ul className="flex flex-col gap-1">
        {notes.map((n) => (
          <li key={n.id}>
            <Link
              href={`/notes/${n.id}`}
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

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
  });
}
