'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Avatar } from '@/components/channel/avatar';
import { DuePill, PriorityPill } from './todo-pill';
import { EnergyBadge } from './energy-picker';
import { setTodoStatus, updateTodoTitle } from '@/lib/actions/todos';
import type { Todo } from '@/lib/types';

function formatEur(cents: number) {
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

function ContextStrip({ todo }: { todo: Todo }) {
  const bits: { key: string; tone: 'info' | 'warn' | 'danger'; text: string }[] = [];
  const ctx = todo.context;

  // Blockers first (most critical)
  if (todo.blockers?.length) {
    for (const b of todo.blockers) {
      if (b.kind === 'vehicle_in_wartung') {
        bits.push({
          key: `bl-${b.vehicleId}`,
          tone: 'danger',
          text: `🚫 Fahrzeug ${b.plate} in Wartung — blockiert`,
        });
      } else if (b.kind === 'vehicle_vermietet') {
        bits.push({
          key: `bl-${b.vehicleId}`,
          tone: 'warn',
          text: `⊙ Fahrzeug ${b.plate} aktuell vermietet`,
        });
      } else if (b.kind === 'contract_storniert') {
        bits.push({
          key: `bl-${b.contractId}`,
          tone: 'danger',
          text: `× Vertrag „${b.title}" storniert`,
        });
      } else if (b.kind === 'customer_inaktiv') {
        bits.push({
          key: `bl-${b.customerId}`,
          tone: 'warn',
          text: `· Kunde ${b.name} inaktiv`,
        });
      }
    }
  }

  // Forecast impact
  if (todo.forecastImpact) {
    bits.push({
      key: 'fc',
      tone: 'warn',
      text: `⚠ ${formatEur(todo.forecastImpact.valueCents)} an Risiko`,
    });
  }

  // Context-Strip facts
  if (ctx) {
    if (ctx.customerStatus === 'aktiv' && ctx.customerSilentDays != null && ctx.customerSilentDays >= 10) {
      bits.push({
        key: 'ctx-silent',
        tone: 'info',
        text: `${ctx.customerSilentDays}d stumm`,
      });
    } else if (ctx.customerStatus) {
      const label =
        ctx.customerStatus === 'aktiv' ? 'Kunde aktiv' : ctx.customerStatus === 'lead' ? 'Lead' : 'inaktiv';
      bits.push({ key: 'ctx-cust', tone: 'info', text: label });
    }
    if (ctx.contractValueCents && !todo.forecastImpact) {
      bits.push({
        key: 'ctx-val',
        tone: 'info',
        text: `${formatEur(ctx.contractValueCents)} Pipeline`,
      });
    }
    if (ctx.contractDaysToEnd != null && ctx.contractDaysToEnd <= 30 && ctx.contractDaysToEnd >= 0) {
      bits.push({
        key: 'ctx-end',
        tone: ctx.contractDaysToEnd <= 7 ? 'warn' : 'info',
        text: `Vertrag in ${ctx.contractDaysToEnd}d aus`,
      });
    }
    if (ctx.vehicleStatus && !todo.blockers?.length) {
      const map: Record<string, string> = {
        frei: 'Fahrzeug frei',
        vermietet: 'vermietet',
        wartung: 'in Wartung',
        reserviert: 'reserviert',
      };
      bits.push({ key: 'ctx-veh', tone: 'info', text: map[ctx.vehicleStatus] ?? ctx.vehicleStatus });
    }
  }

  if (bits.length === 0) return null;

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-[1.35]">
      {bits.map((b, i) => (
        <span key={b.key} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ink-400">·</span>}
          <span
            className={
              b.tone === 'danger'
                ? 'text-[#ff8a8a]'
                : b.tone === 'warn'
                  ? 'text-[#ffd96a]'
                  : 'text-ink-300'
            }
          >
            {b.text}
          </span>
        </span>
      ))}
    </span>
  );
}

export function TodoRow({
  todo,
  onOpen,
  compact,
}: {
  todo: Todo;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [drifting, setDrifting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.title);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const done = todo.status === 'erledigt';
  const color = todo.group?.color;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!done) {
      setDrifting(true);
      setTimeout(() => {
        start(async () => {
          await setTodoStatus(todo.id, 'erledigt');
        });
      }, 220);
    } else {
      start(async () => {
        await setTodoStatus(todo.id, 'offen');
      });
    }
  };

  const commitTitle = () => {
    const next = editValue.trim();
    setEditing(false);
    if (!next || next === todo.title) {
      setEditValue(todo.title);
      return;
    }
    start(async () => {
      const res = await updateTodoTitle(todo.id, next);
      if (!res.ok) setEditValue(todo.title);
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !editing && onOpen(todo.id)}
      onKeyDown={(e) => {
        if (!editing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen(todo.id);
        }
      }}
      style={
        color
          ? ({
              '--stripe': color,
            } as React.CSSProperties)
          : undefined
      }
      className={`group relative flex w-full cursor-pointer items-start gap-3 overflow-hidden rounded-[12px] border border-transparent pl-4 pr-3 py-2.5 text-left transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.03] ${
        done ? 'opacity-50' : ''
      } ${drifting ? 'translate-x-2 opacity-30' : ''}`}
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
        role="checkbox"
        aria-checked={done}
        onClick={toggleDone}
        className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all duration-150 ${
          done
            ? 'border-[#5ee08a] bg-[#5ee08a]/15'
            : 'border-white/[0.18] hover:border-white/[0.40] hover:bg-white/[0.04]'
        } ${pending ? 'opacity-50' : ''}`}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5ee08a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {todo.energy && <EnergyBadge energy={todo.energy} />}
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTitle();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditValue(todo.title);
                  setEditing(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded-[6px] border border-white/[0.18] bg-white/[0.04] px-2 py-0.5 text-[14px] font-medium leading-tight text-ink-50 outline-none focus:border-white/[0.30] focus:bg-white/[0.06]"
              maxLength={280}
            />
          ) : (
            <span
              onClick={(e) => {
                if (e.detail === 2) {
                  e.stopPropagation();
                  setEditing(true);
                  setEditValue(todo.title);
                }
              }}
              className={`truncate text-[14px] font-medium leading-tight ${
                done ? 'text-ink-300 line-through' : 'text-ink-50'
              }`}
              title="Doppelklick zum Bearbeiten"
            >
              {todo.title}
            </span>
          )}
          {todo.autoRuleSlug && (
            <span
              title="Automatisch erstellt durch Regel"
              className="shrink-0 rounded-full border border-[#c084fc]/30 bg-[#c084fc]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.3px] text-[#c084fc]"
            >
              auto
            </span>
          )}
        </span>

        {!compact && <ContextStrip todo={todo} />}

        {!compact && (
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <DuePill iso={todo.dueAt} />
            {(todo.priority === 'hoch' || todo.priority === 'urgent') && (
              <PriorityPill priority={todo.priority} />
            )}
            {todo.subtaskTotal > 0 && (
              <span className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
                {todo.subtaskDone}/{todo.subtaskTotal} Sub-Tasks
              </span>
            )}
            {todo.commentCount > 0 && (
              <span className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
                💬 {todo.commentCount}
              </span>
            )}
            {todo.group && (
              <span
                className="rounded-full px-2 py-0.5 text-[10.5px] text-ink-200"
                style={
                  color
                    ? { background: `${color}1f`, color: '#e6e7ec' }
                    : { background: 'rgba(255,255,255,0.04)' }
                }
              >
                {todo.group.emoji ? `${todo.group.emoji} ` : ''}
                {todo.group.name}
              </span>
            )}
            {todo.links.customer && !todo.group && (
              <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-ink-200">
                ◉ {todo.links.customer.name}
              </span>
            )}
            {todo.links.vehicle && (
              <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-ink-200">
                ⊞ {todo.links.vehicle.plate}
              </span>
            )}
            {todo.links.channel && (
              <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-ink-200">
                #{todo.links.channel.name}
              </span>
            )}
          </span>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {(todo.watchers ?? []).slice(0, 3).map((w, i) => (
          <span key={w.id} style={{ marginLeft: i > 0 ? -8 : 0 }}>
            <Avatar initials={w.initials} from={w.from} to={w.to} size={18} />
          </span>
        ))}
        {todo.watchers && todo.watchers.length > 3 && (
          <span className="font-mono text-[10px] text-ink-300">+{todo.watchers.length - 3}</span>
        )}
        {todo.assignee ? (
          <Avatar
            initials={todo.assignee.initials}
            from={todo.assignee.from}
            to={todo.assignee.to}
            size={22}
          />
        ) : (
          <span
            title="Niemand zugewiesen"
            className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-white/[0.18] text-[11px] text-ink-300"
          >
            ?
          </span>
        )}
      </span>
    </div>
  );
}
