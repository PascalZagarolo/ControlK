import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listTodos } from '@/lib/db/queries/todos';
import { listTodoGroups } from '@/lib/db/queries/todo-groups';
import type { Todo } from '@/lib/types';

function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Spät noch wach';
  if (h < 11) return 'Guten Morgen';
  if (h < 14) return 'Guten Mittag';
  if (h < 18) return 'Hallo';
  return 'Guten Abend';
}

function fmtEur(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

function inThisWeek(iso: string) {
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return d >= start && d < end;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return d >= start && d < end;
}

function isOverdue(t: Todo) {
  if (!t.dueAt) return false;
  if (t.status !== 'offen' && t.status !== 'in_arbeit') return false;
  return new Date(t.dueAt).getTime() < Date.now();
}

const PRIO_RANK = { urgent: 0, hoch: 1, mittel: 2, niedrig: 3 } as const;

function sortByPriority(a: Todo, b: Todo) {
  return PRIO_RANK[a.priority] - PRIO_RANK[b.priority];
}

function TodoLink({ todo, hint }: { todo: Todo; hint?: string }) {
  return (
    <Link
      href={`/todos?todo=${todo.id}`}
      className="group flex items-start gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
    >
      <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ink-300" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-ink-50">{todo.title}</span>
        {hint && <span className="mt-0.5 block text-[11.5px] text-ink-300">{hint}</span>}
      </span>
      <span className="font-mono text-[11px] text-ink-300 transition-colors group-hover:text-ink-50">
        →
      </span>
    </Link>
  );
}

export default async function BriefPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/todos/brief');
  const ws = await requireCurrentWorkspace();

  const [todos, groups] = await Promise.all([
    listTodos(ws.id, user.id),
    listTodoGroups(ws.id),
  ]);

  const open = todos.filter((t) => t.status === 'offen' || t.status === 'in_arbeit');
  const mine = open.filter((t) => t.assignee?.id === user.id);
  const todayMine = mine.filter((t) => t.dueAt && isToday(t.dueAt));
  const overdueMine = mine.filter((t) => isOverdue(t));
  const blockedMine = mine.filter((t) => t.blockers?.length);
  const riskMine = mine.filter((t) => t.forecastImpact);
  const silentCustomers = new Map<string, { name: string; days: number; todos: Todo[] }>();
  for (const t of open) {
    if (
      t.links.customer &&
      t.context?.customerSilentDays != null &&
      t.context.customerSilentDays >= 14 &&
      t.context.customerStatus === 'aktiv'
    ) {
      const key = t.links.customer.id;
      const prev = silentCustomers.get(key);
      if (!prev || prev.days < t.context.customerSilentDays) {
        silentCustomers.set(key, {
          name: t.links.customer.name,
          days: t.context.customerSilentDays,
          todos: [...(prev?.todos ?? []), t],
        });
      } else {
        prev.todos.push(t);
      }
    }
  }
  const expiringContracts = new Map<string, { title: string; days: number; todos: Todo[] }>();
  for (const t of open) {
    if (
      t.links.contract &&
      t.context?.contractDaysToEnd != null &&
      t.context.contractDaysToEnd <= 14 &&
      t.context.contractDaysToEnd >= 0
    ) {
      const key = t.links.contract.id;
      const prev = expiringContracts.get(key);
      if (!prev) {
        expiringContracts.set(key, {
          title: t.links.contract.title,
          days: t.context.contractDaysToEnd,
          todos: [t],
        });
      } else {
        prev.todos.push(t);
      }
    }
  }

  const totalRisk = riskMine.reduce((acc, t) => acc + (t.forecastImpact?.valueCents ?? 0), 0);

  const firstName = user.name.split(' ')[0] || user.name;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-32 pt-28 md:px-6">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Daily Brief
        </span>
        <h1 className="mt-1 text-[34px] font-medium leading-[1.1] tracking-[-0.4px] text-ink-50">
          {greeting()}, {firstName}.
        </h1>
        <p className="mt-3 text-[15px] leading-[1.55] text-ink-200">
          {mine.length === 0 ? (
            <>Du hast aktuell <b className="text-ink-50">keine offenen Items</b>. Schöner Moment für eine Kaffeepause oder einen Workflow-Replay.</>
          ) : (
            <>
              Heute warten <b className="text-ink-50">{mine.length}</b> Items auf dich
              {todayMine.length > 0 && (
                <>
                  , davon <b className="text-ink-50">{todayMine.length}</b> mit Fälligkeit heute
                </>
              )}
              {overdueMine.length > 0 && (
                <>
                  {' '}
                  und <span className="text-[#ff8a8a]">{overdueMine.length} überfällig</span>
                </>
              )}
              .
              {totalRisk > 0 && (
                <>
                  {' '}
                  Insgesamt hängen{' '}
                  <b className="text-[#ffd96a]">{fmtEur(totalRisk)}</b> an Pipeline an deinen heutigen
                  Aufgaben.
                </>
              )}
            </>
          )}
        </p>
      </div>

      {overdueMine.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#ff8a8a]">
            ◉ Zuerst: {overdueMine.length} überfällig
          </h2>
          <div className="flex flex-col gap-1.5">
            {overdueMine
              .slice()
              .sort(sortByPriority)
              .slice(0, 5)
              .map((t) => (
                <TodoLink
                  key={t.id}
                  todo={t}
                  hint={`seit ${Math.floor((Date.now() - new Date(t.dueAt!).getTime()) / 86_400_000)}d offen · ${t.priority}`}
                />
              ))}
          </div>
        </section>
      )}

      {todayMine.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#5eb6ff]">
            ◐ Heute fällig · {todayMine.length}
          </h2>
          <div className="flex flex-col gap-1.5">
            {todayMine
              .slice()
              .sort(sortByPriority)
              .map((t) => (
                <TodoLink
                  key={t.id}
                  todo={t}
                  hint={`${t.priority}${t.energy ? ` · ${t.energy}` : ''}`}
                />
              ))}
          </div>
        </section>
      )}

      {blockedMine.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#ff8a8a]">
            ✕ Blockiert · {blockedMine.length}
          </h2>
          <p className="text-[12.5px] leading-[1.5] text-ink-300">
            Diese Items hängen an einer Entity, die aktuell nicht verfügbar ist. Snooze sie auf den Trigger oder löse den Blocker.
          </p>
          <div className="flex flex-col gap-1.5">
            {blockedMine.map((t) => {
              const b = t.blockers?.[0];
              let hint = 'blockiert';
              if (b?.kind === 'vehicle_in_wartung') hint = `Fahrzeug ${b.plate} in Wartung`;
              else if (b?.kind === 'vehicle_vermietet') hint = `Fahrzeug ${b.plate} vermietet`;
              else if (b?.kind === 'contract_storniert') hint = `Vertrag „${b.title}" storniert`;
              else if (b?.kind === 'customer_inaktiv') hint = `Kunde ${b.name} inaktiv`;
              return <TodoLink key={t.id} todo={t} hint={hint} />;
            })}
          </div>
        </section>
      )}

      {silentCustomers.size > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#ffd96a]">
            · Kunden, die warten · {silentCustomers.size}
          </h2>
          <p className="text-[12.5px] leading-[1.5] text-ink-300">
            Aktive Kunden, die seit mehr als 14 Tagen keinen Touchpoint hatten — vermutlich der
            Moment für ein kurzes Hi.
          </p>
          <div className="flex flex-col gap-1.5">
            {Array.from(silentCustomers.entries())
              .sort((a, b) => b[1].days - a[1].days)
              .slice(0, 5)
              .map(([id, c]) => (
                <Link
                  key={id}
                  href={`/kunden/${id}`}
                  className="group flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
                >
                  <span className="text-[14px] leading-none text-[#ffd96a]">·</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink-50">
                      {c.name}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-300">
                      seit {c.days}d kein Kontakt · {c.todos.length} offene Items
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-ink-300 group-hover:text-ink-50">→</span>
                </Link>
              ))}
          </div>
        </section>
      )}

      {expiringContracts.size > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-[#ffd96a]">
            § Verträge laufen aus · {expiringContracts.size}
          </h2>
          <div className="flex flex-col gap-1.5">
            {Array.from(expiringContracts.entries())
              .sort((a, b) => a[1].days - b[1].days)
              .map(([id, c]) => (
                <Link
                  key={id}
                  href={`/vertraege/${id}`}
                  className="group flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
                >
                  <span className="font-mono text-[14px] leading-none text-[#ffd96a]">§</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink-50">
                      {c.title}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-300">
                      läuft in {c.days}d · {c.todos.length} offene Items hängen dran
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-ink-300 group-hover:text-ink-50">→</span>
                </Link>
              ))}
          </div>
        </section>
      )}

      {groups.some((g) => g.health && g.health.staleRatio >= 0.4 && g.openCount >= 3) && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            ◇ Gruppen, die zustauben
          </h2>
          <div className="flex flex-col gap-1.5">
            {groups
              .filter((g) => g.health && g.health.staleRatio >= 0.4 && g.openCount >= 3)
              .sort((a, b) => (b.health!.staleRatio ?? 0) - (a.health!.staleRatio ?? 0))
              .slice(0, 4)
              .map((g) => (
                <Link
                  key={g.id}
                  href={`/todos/${g.slug}`}
                  className="group flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
                >
                  {g.emoji ? (
                    <span>{g.emoji}</span>
                  ) : (
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: g.color ?? '#9c9c9d' }}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink-50">
                      {g.name}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-ink-300">
                      {Math.round(g.health!.staleRatio * 100)}% Items älter als 14d · {g.openCount}{' '}
                      offen
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-ink-300 group-hover:text-ink-50">→</span>
                </Link>
              ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between border-t border-white/[0.06] pt-6 text-[11px] text-ink-300">
        <p>
          Heuristisch generiert · keine externen Calls. Erweiterung auf Conversational-LLM via Vercel
          AI Gateway später trivial.
        </p>
        <Link
          href="/todos"
          className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] text-ink-200 transition-colors hover:bg-white/[0.05] hover:text-ink-50"
        >
          Zur Liste →
        </Link>
      </div>
    </div>
  );
}
