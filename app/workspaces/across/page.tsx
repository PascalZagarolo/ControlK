import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '@/lib/auth/current-user';
import {
  getMyEventsAcrossWorkspaces,
  getMyTodosAcrossWorkspaces,
} from '@/lib/db/queries/cross-workspace';
import { Headline, MetaTag, MetaDivider } from '@/components/ui/headline';
import { KIND_META } from '@/components/calendar/event-color';

const PRIORITY_COLOR: Record<string, string> = {
  niedrig: '#9c9c9d',
  mittel: '#5eb6ff',
  hoch: '#ffd96a',
  urgent: '#ff8a8a',
};

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/workspaces/across');

  const [todayTodos, overdueTodos, allMyTodos, upcomingEvents] = await Promise.all([
    getMyTodosAcrossWorkspaces(user.id, 'today'),
    getMyTodosAcrossWorkspaces(user.id, 'overdue'),
    getMyTodosAcrossWorkspaces(user.id, 'mine'),
    getMyEventsAcrossWorkspaces(user.id, 7),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 pb-32 pt-28 md:px-6">
      <Headline
        kicker="Across Workspaces"
        title="Alles auf einen Blick."
        subtitle="Aggregierter Daily-Brief über alle deine Workspaces — Privat, Job, Vermietung etc."
        meta={
          <>
            <MetaTag highlight>{allMyTodos.length} offen</MetaTag>
            <MetaDivider />
            <MetaTag>{upcomingEvents.length} Events · 7d</MetaTag>
            {overdueTodos.length > 0 && (
              <>
                <MetaDivider />
                <MetaTag>{overdueTodos.length} überfällig</MetaTag>
              </>
            )}
          </>
        }
      />

      {overdueTodos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#ff8a8a]">
            ◉ Überfällig · {overdueTodos.length}
          </h2>
          <TodoList items={overdueTodos} />
        </section>
      )}

      {todayTodos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#5eb6ff]">
            ◐ Heute · {todayTodos.length}
          </h2>
          <TodoList items={todayTodos} />
        </section>
      )}

      {upcomingEvents.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            Anstehende Termine · {upcomingEvents.length}
          </h2>
          <div className="flex flex-col gap-1.5">
            {upcomingEvents.map((e) => {
              const meta = (KIND_META as any)[e.kind];
              const s = new Date(e.startsAt);
              return (
                <Link
                  key={e.id}
                  href={`/kalender?event=${e.id}`}
                  className="group flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
                >
                  <WorkspaceBadge
                    name={e.workspaceName}
                    emoji={e.workspaceIconEmoji}
                    from={e.workspaceFrom}
                    to={e.workspaceTo}
                  />
                  <span
                    className="font-mono text-[10.5px] uppercase tracking-[0.3px]"
                    style={{ color: meta?.color ?? '#9c9c9d' }}
                  >
                    {meta?.icon ?? '·'}{' '}
                    {s.toLocaleString('de-DE', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-50">
                    {e.title}
                  </span>
                  <span className="font-mono text-[10px] text-ink-300 group-hover:text-ink-50">
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {allMyTodos.length === 0 && upcomingEvents.length === 0 && (
        <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
          Nichts auf der Liste — sieht nach einem ruhigen Tag aus.
        </div>
      )}
    </div>
  );
}

function TodoList({ items }: { items: any[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((t) => (
        <Link
          key={t.id}
          href={`/todos?todo=${t.id}`}
          className="group flex items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
        >
          <WorkspaceBadge
            name={t.workspaceName}
            emoji={t.workspaceIconEmoji}
            from={t.workspaceFrom}
            to={t.workspaceTo}
          />
          {(t.priority === 'hoch' || t.priority === 'urgent') && (
            <span
              className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
              style={{
                background: `${PRIORITY_COLOR[t.priority]}1f`,
                color: PRIORITY_COLOR[t.priority],
              }}
            >
              {t.priority}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-50">
            {t.title}
          </span>
          {t.dueAt && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
              {new Date(t.dueAt).toLocaleDateString('de-DE')}
            </span>
          )}
          <span className="font-mono text-[10px] text-ink-300 group-hover:text-ink-50">→</span>
        </Link>
      ))}
    </div>
  );
}

function WorkspaceBadge({
  name,
  emoji,
  from,
  to,
}: {
  name: string;
  emoji?: string;
  from: string;
  to: string;
}) {
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
      style={{ background: `${from}1f`, color: '#e6e7ec' }}
      title={name}
    >
      {emoji ? <span>{emoji}</span> : null}
      <span className="max-w-[100px] truncate">{name}</span>
    </span>
  );
}
