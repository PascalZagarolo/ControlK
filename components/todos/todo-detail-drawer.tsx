'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/channel/avatar';
import { DuePill, PriorityPill, StatusPill } from './todo-pill';
import {
  addComment,
  addSubtask,
  deleteSubtask,
  deleteTodo,
  setTodoAssignee,
  setTodoDue,
  setTodoPriority,
  setTodoStatus,
  snoozeTodo,
  toggleSubtask,
} from '@/lib/actions/todos';
import { moveTodoToGroup } from '@/lib/actions/todo-groups';
import { EnergyPicker } from './energy-picker';
import { useChannelSubscription } from '@/lib/realtime/pusher-client';
import type {
  Todo,
  TodoActivityKind,
  TodoBlocker,
  TodoGroup,
  TodoPriority,
  TodoStatus,
  TodoUser,
} from '@/lib/types';

const TABS = ['Details', 'Sub-Tasks', 'Kommentare', 'Aktivität'] as const;
type Tab = (typeof TABS)[number];

const STATUS_OPTIONS: TodoStatus[] = ['offen', 'in_arbeit', 'erledigt', 'abgebrochen'];
const PRIORITY_OPTIONS: TodoPriority[] = ['niedrig', 'mittel', 'hoch', 'urgent'];

export function TodoDetailDrawer({
  todo,
  members,
  groups,
  onClose,
}: {
  todo: Todo;
  members: TodoUser[];
  groups?: TodoGroup[];
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>('Details');
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const refresh = () => router.refresh();

  // Live updates for this todo (e.g. someone else comments)
  useChannelSubscription(`todo-${todo.id}`, {
    'todo.commented': refresh,
    'todo.updated': refresh,
  });

  return (
    <div className="fixed inset-0 z-[150]">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <aside
        ref={ref}
        className="absolute bottom-0 right-0 top-0 flex w-[min(560px,100vw)] flex-col border-l border-white/[0.08] bg-[rgba(14,15,18,0.97)] shadow-panel backdrop-blur-xl"
      >
        {/* Head */}
        <div className="flex items-start gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
                Todo
              </span>
              {todo.autoRuleSlug && (
                <span className="rounded-full border border-[#c084fc]/30 bg-[#c084fc]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.3px] text-[#c084fc]">
                  auto · {todo.autoRuleSlug.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-[19px] font-medium leading-snug tracking-[-0.2px] text-ink-50">
              {todo.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-50"
          >
            ✕
          </button>
        </div>

        {/* Blocker / Forecast banner */}
        {(todo.blockers?.length || todo.forecastImpact) && (
          <div className="flex flex-col gap-1.5 border-b border-white/[0.06] px-5 py-3">
            {todo.blockers?.map((b) => (
              <BlockerBanner key={`${b.kind}-${'vehicleId' in b ? b.vehicleId : 'contractId' in b ? b.contractId : 'customerId' in b ? b.customerId : ''}`} blocker={b} />
            ))}
            {todo.forecastImpact && (
              <div className="flex items-start gap-2.5 rounded-[10px] border border-[#ffd96a]/25 bg-[#ffd96a]/[0.05] px-3 py-2">
                <span className="text-[14px] leading-none text-[#ffd96a]">⚠</span>
                <span className="text-[12.5px] leading-[1.45] text-ink-100">
                  €{(todo.forecastImpact.valueCents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })} an Risiko ·
                  <span className="ml-1 text-ink-300">{todo.forecastImpact.reason}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-3">
          <StatusSelect
            value={todo.status}
            onChange={(s) => start(async () => { await setTodoStatus(todo.id, s); refresh(); })}
            disabled={pending}
          />
          <PrioritySelect
            value={todo.priority}
            onChange={(p) => start(async () => { await setTodoPriority(todo.id, p); refresh(); })}
            disabled={pending}
          />
          <AssigneeSelect
            value={todo.assignee?.id ?? null}
            members={members}
            onChange={(id) => start(async () => { await setTodoAssignee(todo.id, id); refresh(); })}
            disabled={pending}
          />
          <DueInput
            value={todo.dueAt ?? null}
            onChange={(iso) => start(async () => { await setTodoDue(todo.id, iso); refresh(); })}
            disabled={pending}
          />
          <SnoozeMenu
            todoId={todo.id}
            onChange={() => refresh()}
            disabled={pending}
          />
          <EnergyPicker todoId={todo.id} current={todo.energy} />
          {groups && (
            <GroupSelect
              value={todo.group?.id ?? null}
              groups={groups}
              onChange={(id) => start(async () => { await moveTodoToGroup(todo.id, id); refresh(); })}
              disabled={pending}
            />
          )}
          <button
            type="button"
            onClick={() => {
              if (!confirm('Todo löschen?')) return;
              start(async () => {
                await deleteTodo(todo.id);
                onClose();
                refresh();
              });
            }}
            className="ml-auto rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[11.5px] text-ink-300 transition-colors hover:border-[#ff8a8a]/30 hover:bg-[#ff8a8a]/10 hover:text-[#ff8a8a]"
          >
            Löschen
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/[0.06] px-3">
          <div className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => {
              const active = t === tab;
              const count =
                t === 'Sub-Tasks'
                  ? todo.subtasks.length
                  : t === 'Kommentare'
                    ? todo.comments.length
                    : t === 'Aktivität'
                      ? todo.activity.length
                      : null;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] font-medium leading-none transition-colors duration-150 ${
                    active
                      ? 'border-ink-50 text-ink-50'
                      : 'border-transparent text-ink-300 hover:text-ink-50'
                  }`}
                >
                  {t}
                  {count !== null && count > 0 && (
                    <span className="ml-1.5 font-mono text-[10px] text-ink-300">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'Details' && <DetailsTab todo={todo} />}
          {tab === 'Sub-Tasks' && <SubtasksTab todo={todo} onChange={refresh} />}
          {tab === 'Kommentare' && <CommentsTab todo={todo} onChange={refresh} />}
          {tab === 'Aktivität' && <ActivityTab todo={todo} />}
        </div>
      </aside>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────

function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: TodoStatus;
  onChange: (v: TodoStatus) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <StatusPill status={value} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TodoStatus)}
        disabled={disabled}
        className="cursor-pointer rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-1.5 py-1 text-[11.5px] text-ink-200 outline-none transition-colors hover:bg-white/[0.05]"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ')}
          </option>
        ))}
      </select>
    </label>
  );
}

function PrioritySelect({
  value,
  onChange,
  disabled,
}: {
  value: TodoPriority;
  onChange: (v: TodoPriority) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <PriorityPill priority={value} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TodoPriority)}
        disabled={disabled}
        className="cursor-pointer rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-1.5 py-1 text-[11.5px] text-ink-200 outline-none transition-colors hover:bg-white/[0.05]"
      >
        {PRIORITY_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}

function AssigneeSelect({
  value,
  members,
  onChange,
  disabled,
}: {
  value: string | null;
  members: TodoUser[];
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const active = members.find((m) => m.id === value);
  return (
    <label className="inline-flex items-center gap-1.5">
      {active ? (
        <Avatar initials={active.initials} from={active.from} to={active.to} size={20} />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-white/[0.18] text-[10px] text-ink-300">
          ?
        </span>
      )}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className="cursor-pointer rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-1.5 py-1 text-[11.5px] text-ink-200 outline-none transition-colors hover:bg-white/[0.05]"
      >
        <option value="">Niemand</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function GroupSelect({
  value,
  groups,
  onChange,
  disabled,
}: {
  value: string | null;
  groups: TodoGroup[];
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const active = groups.find((g) => g.id === value);
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">Gruppe</span>
      {active ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-ink-200">
          {active.emoji ? <span>{active.emoji}</span> : (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: active.color ?? '#9c9c9d' }}
            />
          )}
          <span>{active.name}</span>
        </span>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300/70">∅</span>
      )}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className="cursor-pointer rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-1.5 py-1 text-[11.5px] text-ink-200 outline-none transition-colors hover:bg-white/[0.05]"
      >
        <option value="">Ohne Gruppe</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.emoji ? `${g.emoji} ` : ''}
            {g.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DueInput({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const v = value ? value.slice(0, 16) : '';
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">Fällig</span>
      <input
        type="datetime-local"
        value={v}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        disabled={disabled}
        className="rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11.5px] text-ink-50 outline-none transition-colors hover:bg-white/[0.05]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[11px] text-ink-300 hover:text-ink-50"
        >
          ×
        </button>
      )}
    </label>
  );
}

function SnoozeMenu({
  todoId,
  onChange,
  disabled,
}: {
  todoId: string;
  onChange: () => void;
  disabled?: boolean;
}) {
  const [, start] = useTransition();
  const apply = (offset: number | null, trigger?: { kind: string; ref?: string }) => {
    const until =
      offset === null ? null : new Date(Date.now() + offset * 60 * 60 * 1000).toISOString();
    start(async () => {
      await snoozeTodo(todoId, until, trigger);
      onChange();
    });
  };
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[11.5px] text-ink-200 transition-colors hover:bg-white/[0.05]">
        Snooze
      </summary>
      <div className="absolute right-0 top-[calc(100%+4px)] z-10 flex w-[200px] flex-col rounded-[10px] border border-white/[0.10] bg-[rgba(20,21,23,0.96)] p-1 shadow-panel">
        {[
          ['1 Stunde', 1, undefined],
          ['Heute Abend', 6, undefined],
          ['Morgen früh', 16, undefined],
          ['Nächste Woche', 24 * 7, undefined],
        ].map(([label, hrs]) => (
          <button
            key={String(label)}
            type="button"
            disabled={disabled}
            onClick={() => apply(hrs as number)}
            className="rounded-[6px] px-2.5 py-1.5 text-left text-[12px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
          >
            {label as string}
          </button>
        ))}
        <div className="my-1 h-px bg-white/[0.07]" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => apply(null, { kind: 'customer_reply' })}
          className="rounded-[6px] px-2.5 py-1.5 text-left text-[12px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
        >
          Bis Kunde antwortet
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => apply(null, { kind: 'contract_active' })}
          className="rounded-[6px] px-2.5 py-1.5 text-left text-[12px] text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
        >
          Wenn Vertrag aktiv
        </button>
        <div className="my-1 h-px bg-white/[0.07]" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => apply(0)}
          className="rounded-[6px] px-2.5 py-1.5 text-left text-[12px] text-ink-300 hover:bg-white/[0.05] hover:text-ink-50"
        >
          Snooze aufheben
        </button>
      </div>
    </details>
  );
}

function DetailsTab({ todo }: { todo: Todo }) {
  return (
    <div className="flex flex-col gap-5">
      {todo.description && (
        <div>
          <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Beschreibung
          </h3>
          <p className="whitespace-pre-line text-[14px] leading-[1.65] text-ink-200">
            {todo.description}
          </p>
        </div>
      )}

      <div>
        <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Verknüpfungen
        </h3>
        <div className="flex flex-col gap-1.5">
          {todo.links.customer && (
            <LinkRow href={`/kunden/${todo.links.customer.slug}`} icon="◉" label="Kunde" value={todo.links.customer.name} />
          )}
          {todo.links.contract && (
            <LinkRow
              href={`/vertraege/${todo.links.contract.externalId}`}
              icon="§"
              label="Vertrag"
              value={todo.links.contract.title}
            />
          )}
          {todo.links.vehicle && (
            <LinkRow
              href={`/flotte/${todo.links.vehicle.externalId}`}
              icon="⊞"
              label="Fahrzeug"
              value={`${todo.links.vehicle.plate} · ${todo.links.vehicle.model}`}
            />
          )}
          {todo.links.channel && (
            <LinkRow
              href={`/channels/${todo.links.channel.slug}`}
              icon="#"
              label="Channel"
              value={todo.links.channel.name}
            />
          )}
          {!todo.links.customer &&
            !todo.links.contract &&
            !todo.links.vehicle &&
            !todo.links.channel && (
              <p className="text-[12.5px] text-ink-300">Keine Verknüpfungen.</p>
            )}
        </div>
      </div>

      <div>
        <h3 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Metadaten
        </h3>
        <dl className="flex flex-col gap-1.5 text-[12.5px]">
          <Meta label="Erstellt" value={new Date(todo.createdAt).toLocaleString('de-DE')} />
          <Meta label="Erstellt von" value={todo.createdBy.name} />
          <Meta label="Sichtbarkeit" value={todo.visibility} />
          {todo.snoozeUntil && (
            <Meta label="Snooze bis" value={new Date(todo.snoozeUntil).toLocaleString('de-DE')} />
          )}
          {todo.snoozeTrigger && (
            <Meta label="Snooze-Trigger" value={todo.snoozeTrigger.kind.replace('_', ' ')} />
          )}
          {todo.completedAt && (
            <Meta label="Erledigt am" value={new Date(todo.completedAt).toLocaleString('de-DE')} />
          )}
        </dl>
      </div>
    </div>
  );
}

function BlockerBanner({ blocker }: { blocker: TodoBlocker }) {
  let icon = '🚫';
  let title = '';
  let body = '';
  let href: string | null = null;
  if (blocker.kind === 'vehicle_in_wartung') {
    icon = '🚫';
    title = `Fahrzeug ${blocker.plate} in Wartung`;
    body = 'Übergabe / Rückgabe blockiert, bis das Fahrzeug aus der Wartung kommt.';
    href = `/flotte/${blocker.vehicleId}`;
  } else if (blocker.kind === 'vehicle_vermietet') {
    icon = '⊙';
    title = `Fahrzeug ${blocker.plate} aktuell vermietet`;
    body = 'Andere Buchung läuft. Termin ggf. mit Rückgabe synchronisieren.';
    href = `/flotte/${blocker.vehicleId}`;
  } else if (blocker.kind === 'contract_storniert') {
    icon = '×';
    title = `Vertrag „${blocker.title}" storniert`;
    body = 'Dieses Todo bezieht sich auf einen stornierten Vertrag — vermutlich obsolet.';
    href = null;
  } else if (blocker.kind === 'customer_inaktiv') {
    icon = '·';
    title = `Kunde ${blocker.name} ist inaktiv`;
    body = 'Vor jeder Aktion lohnt sich ein kurzer Status-Check.';
    href = `/kunden/${blocker.customerId}`;
  }
  const inner = (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-[#ff8a8a]/25 bg-[#ff8a8a]/[0.06] px-3 py-2">
      <span className="text-[14px] leading-none text-[#ff8a8a]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium leading-tight text-ink-50">{title}</p>
        <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink-300">{body}</p>
      </div>
      {href && <span className="font-mono text-[11px] text-ink-300">→</span>}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">{label}</dt>
      <dd className="text-ink-200">{value}</dd>
    </div>
  );
}

function LinkRow({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-white/[0.04] font-mono text-[12px] text-ink-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          {label}
        </span>
        <span className="block truncate text-[13px] text-ink-50">{value}</span>
      </span>
      <span className="font-mono text-[11px] text-ink-300">→</span>
    </Link>
  );
}

function SubtasksTab({ todo, onChange }: { todo: Todo; onChange: () => void }) {
  const [, start] = useTransition();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    start(async () => {
      await addSubtask(todo.id, t);
      setDraft('');
      inputRef.current?.focus();
      onChange();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {todo.subtasks.length === 0 && (
        <p className="text-[12.5px] text-ink-300">Noch keine Sub-Tasks.</p>
      )}
      {todo.subtasks.map((st) => (
        <div
          key={st.id}
          className="flex items-center gap-3 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-3 py-2"
        >
          <button
            type="button"
            onClick={() => start(async () => { await toggleSubtask(st.id); onChange(); })}
            className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${
              st.done ? 'border-[#5ee08a] bg-[#5ee08a]/15' : 'border-white/[0.18] hover:border-white/[0.40]'
            }`}
            aria-label={st.done ? 'Als offen markieren' : 'Als erledigt markieren'}
          >
            {st.done && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#5ee08a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
          </button>
          <span className={`flex-1 text-[13px] ${st.done ? 'text-ink-300 line-through' : 'text-ink-50'}`}>
            {st.title}
          </span>
          <button
            type="button"
            onClick={() => start(async () => { await deleteSubtask(st.id); onChange(); })}
            className="font-mono text-[11px] text-ink-300 hover:text-[#ff8a8a]"
            aria-label="Löschen"
          >
            ×
          </button>
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Neue Sub-Task …"
          className="flex-1 rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] text-ink-50 outline-none focus:border-white/[0.20]"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-[8px] bg-white px-3 py-2 text-[12px] font-medium leading-none text-black transition-opacity disabled:opacity-30"
        >
          +
        </button>
      </form>
    </div>
  );
}

function CommentsTab({ todo, onChange }: { todo: Todo; onChange: () => void }) {
  const [, start] = useTransition();
  const [draft, setDraft] = useState('');

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    start(async () => {
      await addComment(todo.id, t);
      setDraft('');
      onChange();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {todo.comments.length === 0 && (
        <p className="text-[12.5px] text-ink-300">Noch keine Kommentare.</p>
      )}
      {todo.comments.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar initials={c.authorInitials} from={c.authorFrom} to={c.authorTo} size={28} />
          <div className="min-w-0 flex-1 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-medium text-ink-50">{c.authorName}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                {new Date(c.createdAt).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-line text-[13px] leading-[1.55] text-ink-200">
              {c.body}
            </p>
          </div>
        </div>
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-2 flex flex-col gap-2 rounded-[10px] border border-white/[0.08] bg-[rgba(20,21,23,0.7)] p-2.5"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder="Kommentar schreiben … (⌘↵ zum Senden)"
          className="resize-none bg-transparent text-[13px] leading-[1.5] text-ink-50 outline-none placeholder:text-ink-300"
        />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">⌘↵</span>
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-medium leading-none text-black transition-opacity disabled:opacity-30"
          >
            Senden
          </button>
        </div>
      </form>
    </div>
  );
}

const ACTIVITY_VERBS: Record<TodoActivityKind, string> = {
  created: 'hat das Todo erstellt',
  status_changed: 'hat den Status geändert',
  priority_changed: 'hat die Priorität geändert',
  due_changed: 'hat die Fälligkeit geändert',
  assigned: 'hat zugewiesen',
  unassigned: 'hat die Zuweisung entfernt',
  commented: 'hat kommentiert',
  subtask_added: 'hat eine Sub-Task hinzugefügt',
  subtask_completed: 'hat eine Sub-Task erledigt',
  subtask_removed: 'hat eine Sub-Task entfernt',
  snoozed: 'hat das Todo verschoben',
  claimed: 'hat das Todo übernommen',
  delegated: 'hat delegiert',
  delegation_accepted: 'hat die Delegation angenommen',
  delegation_rejected: 'hat die Delegation abgelehnt',
  auto_created: 'wurde automatisch erstellt',
  completed: 'hat erledigt',
  cancelled: 'hat abgebrochen',
};

function ActivityTab({ todo }: { todo: Todo }) {
  if (todo.activity.length === 0) {
    return <p className="text-[12.5px] text-ink-300">Keine Aktivität.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {todo.activity.map((a) => (
        <li key={a.id} className="flex gap-3 border-l-2 border-white/[0.06] pl-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[12.5px] font-medium leading-tight text-ink-50">
                {a.actorName ?? 'System'}
              </span>
              <span className="text-[12px] text-ink-300">{ACTIVITY_VERBS[a.kind]}</span>
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
              {new Date(a.createdAt).toLocaleString('de-DE', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
