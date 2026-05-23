'use client';

import { useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/channel/avatar';
import { DuePill, PriorityPill } from './todo-pill';
import { EnergyBadge } from './energy-picker';
import { setTodoStatus } from '@/lib/actions/todos';
import type { Todo } from '@/lib/types';

function shortContext(todo: Todo): string | null {
  const bits: string[] = [];
  if (todo.blockers?.length) {
    const b = todo.blockers[0];
    if (b.kind === 'vehicle_in_wartung') bits.push(`🚫 ${b.plate} in Wartung`);
    else if (b.kind === 'vehicle_vermietet') bits.push(`⊙ ${b.plate} vermietet`);
    else if (b.kind === 'contract_storniert') bits.push(`× ${b.title} storniert`);
    else if (b.kind === 'customer_inaktiv') bits.push(`· ${b.name} inaktiv`);
  } else if (todo.forecastImpact) {
    bits.push(`⚠ €${(todo.forecastImpact.valueCents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })} hängt dran`);
  } else if (todo.context) {
    if (todo.context.customerSilentDays != null && todo.context.customerSilentDays >= 10) {
      bits.push(`${todo.context.customerSilentDays}d stumm`);
    } else if (todo.context.customerStatus === 'aktiv') {
      bits.push('Kunde aktiv');
    }
    if (todo.context.contractDaysToEnd != null && todo.context.contractDaysToEnd <= 14) {
      bits.push(`Vertrag in ${todo.context.contractDaysToEnd}d aus`);
    }
  }
  return bits.length ? bits.join(' · ') : null;
}

function Card({ todo, onOpen }: { todo: Todo; onOpen: (id: string) => void }) {
  const [pending, start] = useTransition();
  const [drifting, setDrifting] = useState(false);
  const done = todo.status === 'erledigt';
  const color = todo.group?.color;
  const ctx = shortContext(todo);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!done) {
      setDrifting(true);
      setTimeout(
        () =>
          start(async () => {
            await setTodoStatus(todo.id, 'erledigt');
          }),
        220
      );
    } else {
      start(async () => {
        await setTodoStatus(todo.id, 'offen');
      });
    }
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(todo.id)}
      className={`group relative flex h-[160px] w-full flex-col overflow-hidden rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4 text-left transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.04] ${
        done ? 'opacity-50' : ''
      } ${drifting ? 'translate-x-2 opacity-30' : ''}`}
    >
      {color && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
          style={{
            background: `linear-gradient(90deg, ${color} 0%, ${color}55 60%, transparent 100%)`,
          }}
        />
      )}
      <div className="flex items-start gap-2.5">
        <span
          role="checkbox"
          aria-checked={done}
          onClick={toggle}
          className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-150 ${
            done ? 'border-[#5ee08a] bg-[#5ee08a]/15' : 'border-white/[0.18] hover:border-white/[0.40]'
          } ${pending ? 'opacity-50' : ''}`}
        >
          {done && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5ee08a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {todo.energy && <EnergyBadge energy={todo.energy} />}
            <span
              className={`line-clamp-2 text-[13.5px] font-medium leading-tight ${
                done ? 'text-ink-300 line-through' : 'text-ink-50'
              }`}
            >
              {todo.title}
            </span>
          </div>
        </span>
      </div>

      {ctx && <p className="mt-2 line-clamp-2 text-[11.5px] leading-[1.4] text-ink-300">{ctx}</p>}

      <div className="mt-auto flex items-center gap-1.5">
        <DuePill iso={todo.dueAt} />
        {(todo.priority === 'hoch' || todo.priority === 'urgent') && (
          <PriorityPill priority={todo.priority} />
        )}
        <span className="ml-auto flex items-center gap-1">
          {(todo.watchers ?? []).slice(0, 2).map((w, i) => (
            <span key={w.id} style={{ marginLeft: i > 0 ? -6 : 0 }}>
              <Avatar initials={w.initials} from={w.from} to={w.to} size={16} />
            </span>
          ))}
          {todo.assignee ? (
            <Avatar
              initials={todo.assignee.initials}
              from={todo.assignee.from}
              to={todo.assignee.to}
              size={20}
            />
          ) : (
            <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full border border-dashed border-white/[0.18] text-[10px] text-ink-300">
              ?
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

export function TodoCardView({
  todos,
  onOpen,
}: {
  todos: Todo[];
  onOpen: (id: string) => void;
}) {
  const open = useMemo(() => todos.filter((t) => t.status !== 'erledigt' && t.status !== 'abgebrochen'), [todos]);
  const done = useMemo(() => todos.filter((t) => t.status === 'erledigt' || t.status === 'abgebrochen'), [todos]);

  if (todos.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-14 text-center text-[14px] text-ink-300">
        Nichts zu sehen.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {open.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {open.map((t) => (
            <Card key={t.id} todo={t} onOpen={onOpen} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <section>
          <h3 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            Erledigt · {done.length}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {done.map((t) => (
              <Card key={t.id} todo={t} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
