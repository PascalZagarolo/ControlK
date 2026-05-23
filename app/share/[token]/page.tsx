import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getShareLinkByToken } from '@/lib/db/queries/share-links';
import { Avatar } from '@/components/channel/avatar';
import { DuePill } from '@/components/todos/todo-pill';
import type { Todo } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ReadOnlyTodoRow({ todo, color }: { todo: Todo; color?: string }) {
  const done = todo.status === 'erledigt';
  return (
    <div
      className={`relative flex items-start gap-3 overflow-hidden rounded-[12px] border border-white/[0.06] bg-white/[0.02] pl-4 pr-3 py-2.5 ${
        done ? 'opacity-50' : ''
      }`}
    >
      {color && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
          style={{
            background: `linear-gradient(180deg, ${color} 0%, ${color}88 60%, transparent 100%)`,
          }}
        />
      )}
      <span
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
          done ? 'border-[#5ee08a] bg-[#5ee08a]/15' : 'border-white/[0.18]'
        }`}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5ee08a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] font-medium leading-tight ${done ? 'text-ink-300 line-through' : 'text-ink-50'}`}>
          {todo.title}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <DuePill iso={todo.dueAt} />
          {todo.subtaskTotal > 0 && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
              {todo.subtaskDone}/{todo.subtaskTotal} Sub-Tasks
            </span>
          )}
        </span>
      </span>
      {todo.assignee ? (
        <Avatar
          initials={todo.assignee.initials}
          from={todo.assignee.from}
          to={todo.assignee.to}
          size={22}
        />
      ) : null}
    </div>
  );
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await getShareLinkByToken(token);
  if (!resolved) notFound();

  const { group, creator, todos, link } = resolved;
  const open = todos.filter((t) => t.status === 'offen' || t.status === 'in_arbeit');
  const done = todos.filter((t) => t.status === 'erledigt');

  return (
    <div className="min-h-screen bg-ink-900">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-32 pt-16 md:px-6">
        <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            <Link href="/" className="transition-colors hover:text-ink-50">
              uRent
            </Link>
            <span className="opacity-50">·</span>
            <span>geteilte Gruppe</span>
            {link.expiresAt && (
              <>
                <span className="opacity-50">·</span>
                <span>gültig bis {new Date(link.expiresAt).toLocaleDateString('de-DE')}</span>
              </>
            )}
          </div>
          <h1 className="text-[36px] font-medium leading-[1.05] tracking-[-0.4px] text-ink-50">
            {group.emoji && <span className="mr-2">{group.emoji}</span>}
            {group.name}
          </h1>
          {group.description && (
            <p className="max-w-[560px] text-[14.5px] leading-[1.55] text-ink-200">
              {group.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2.5">
            <Avatar initials={creator.initials} from={creator.from} to={creator.to} size={22} />
            <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-ink-300">
              geteilt von {creator.name} · {open.length} offen · {done.length} erledigt
            </span>
          </div>
        </header>

        {open.length === 0 && done.length === 0 && (
          <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
            Diese Gruppe ist leer.
          </div>
        )}

        {open.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              Offen · {open.length}
            </h2>
            <div className="flex flex-col gap-1.5">
              {open.map((t) => (
                <ReadOnlyTodoRow key={t.id} todo={t} color={group.color} />
              ))}
            </div>
          </section>
        )}

        {done.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              Erledigt · {done.length}
            </h2>
            <div className="flex flex-col gap-1.5">
              {done.slice(0, 20).map((t) => (
                <ReadOnlyTodoRow key={t.id} todo={t} color={group.color} />
              ))}
            </div>
          </section>
        )}

        <footer className="mt-8 border-t border-white/[0.06] pt-6 text-center text-[11px] text-ink-300">
          Read-only Ansicht · Updates erscheinen automatisch ·{' '}
          <Link href="/" className="text-ink-100 hover:text-ink-50">
            uRent
          </Link>
        </footer>
      </div>
    </div>
  );
}
