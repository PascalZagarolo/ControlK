'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/channel/avatar';
import { KIND_META } from './event-color';
import {
  addChecklistItem,
  deleteCalendarEvent,
  deleteRecurringSeries,
  removeChecklistItem,
  rescheduleEvent,
  toggleChecklistItem,
  toggleEventComplete,
  updateCalendarEvent,
} from '@/lib/actions/calendar';
import type { CalendarEvent, CalendarEventKind } from '@/lib/types';

const KINDS: CalendarEventKind[] = ['handover', 'return', 'internal', 'maintenance'];

export function EventDetailDrawer({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [newItem, setNewItem] = useState('');
  const [editTitle, setEditTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(event.title);

  useEffect(() => {
    setTitleDraft(event.title);
  }, [event.title]);

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
  const meta = KIND_META[event.kind];
  const s = new Date(event.startsAt);
  const en = new Date(event.endsAt);
  const checklistDone = event.checklist.filter((c) => c.done).length;
  const checklistProgress =
    event.checklist.length > 0 ? checklistDone / event.checklist.length : 0;

  return (
    <div className="fixed inset-0 z-[150]">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <aside
        ref={ref}
        className="absolute bottom-0 right-0 top-0 flex w-[min(560px,100vw)] flex-col overflow-y-auto border-l border-white/[0.08] bg-[rgba(14,15,18,0.97)] shadow-panel backdrop-blur-xl"
      >
        <div className="flex items-start gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.3px]"
                style={{ background: `${meta.color}1f`, color: meta.color }}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </span>
              {event.autoSpawnSource && (
                <span className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
                  · auto · {event.autoSpawnSource}
                </span>
              )}
              {event.recurringGroupId && (
                <span className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
                  · recurring · {event.recurringRule}
                </span>
              )}
            </div>
            {editTitle ? (
              <input
                value={titleDraft}
                autoFocus
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => {
                  setEditTitle(false);
                  if (titleDraft.trim() && titleDraft !== event.title) {
                    start(async () => {
                      await updateCalendarEvent({
                        eventId: event.id,
                        patch: { title: titleDraft },
                      });
                      refresh();
                    });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                  if (e.key === 'Escape') {
                    setTitleDraft(event.title);
                    setEditTitle(false);
                  }
                }}
                className="mt-1.5 w-full rounded-[6px] border border-white/[0.18] bg-white/[0.04] px-2 py-1 text-[17px] font-medium leading-snug text-ink-50 outline-none focus:border-white/[0.30]"
              />
            ) : (
              <h2
                onClick={() => setEditTitle(true)}
                className="mt-1.5 cursor-text text-[19px] font-medium leading-snug tracking-[-0.2px] text-ink-50 hover:underline decoration-white/20"
                title="Klick zum Bearbeiten"
              >
                {event.title}
              </h2>
            )}
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

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-3">
          <KindSelect
            value={event.kind}
            onChange={(k) =>
              start(async () => {
                await updateCalendarEvent({ eventId: event.id, patch: { kind: k } });
                refresh();
              })
            }
          />
          <TimeInput
            label="Start"
            value={event.startsAt}
            onChange={(iso) =>
              start(async () => {
                await updateCalendarEvent({
                  eventId: event.id,
                  patch: { startsAtIso: iso },
                });
                refresh();
              })
            }
          />
          <TimeInput
            label="Ende"
            value={event.endsAt}
            onChange={(iso) =>
              start(async () => {
                await updateCalendarEvent({
                  eventId: event.id,
                  patch: { endsAtIso: iso },
                });
                refresh();
              })
            }
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await toggleEventComplete(event.id);
                refresh();
              })
            }
            className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 hover:border-[#5ee08a]/30 hover:text-[#5ee08a]"
          >
            {event.completedAt ? '↺ Reopen' : '✓ Done'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm('Event löschen?')) return;
              start(async () => {
                await deleteCalendarEvent(event.id);
                onClose();
                refresh();
              });
            }}
            className="ml-auto rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[11.5px] text-ink-300 hover:border-[#ff8a8a]/30 hover:text-[#ff8a8a]"
          >
            Löschen
          </button>
        </div>

        {/* Recurring action */}
        {event.recurringGroupId && (
          <div className="border-b border-white/[0.06] px-5 py-2">
            <button
              type="button"
              onClick={() => {
                if (!confirm('Ganze Serie löschen?')) return;
                start(async () => {
                  await deleteRecurringSeries(event.recurringGroupId!);
                  onClose();
                  refresh();
                });
              }}
              className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-[#ff8a8a] hover:underline"
            >
              · Ganze Serie löschen
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 flex-col gap-5 px-5 py-4">
          {/* Time meta */}
          <Section title="Zeit">
            <p className="text-[13px] text-ink-100">
              {s.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            <p className="mt-1 font-mono text-[12px] text-ink-300">
              {s.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {en.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              {' · '}
              {Math.round((en.getTime() - s.getTime()) / 60_000)} min
            </p>
          </Section>

          {/* Linked entities */}
          <Section title="Verknüpfungen">
            <div className="flex flex-col gap-1.5">
              {event.linkedCustomerId && event.linkedCustomerName && (
                <LinkRow
                  href={`/kunden/${event.linkedCustomerId}`}
                  icon={<Avatar
                    initials={event.linkedCustomerInitials ?? '?'}
                    from={event.linkedCustomerFrom ?? '#5eb6ff'}
                    to={event.linkedCustomerTo ?? '#0369a1'}
                    size={20}
                  />}
                  label="Kunde"
                  value={event.linkedCustomerName}
                />
              )}
              {event.linkedVehicleId && event.linkedVehiclePlate && (
                <LinkRow
                  href={`/flotte/${event.linkedVehicleExternalId ?? event.linkedVehicleId}`}
                  icon="⊞"
                  label="Fahrzeug"
                  value={`${event.linkedVehiclePlate}${event.linkedVehicleModel ? ' · ' + event.linkedVehicleModel : ''}`}
                />
              )}
              {event.linkedContractId && event.linkedContractTitle && (
                <LinkRow
                  href={`/vertraege/${event.linkedContractId}`}
                  icon="§"
                  label="Vertrag"
                  value={event.linkedContractTitle}
                />
              )}
              {!event.linkedCustomerId && !event.linkedVehicleId && !event.linkedContractId && (
                <p className="text-[12.5px] text-ink-300">Keine Verknüpfungen.</p>
              )}
            </div>
          </Section>

          {/* Location */}
          {event.location && (
            <Section title="Ort">
              <p className="text-[13px] text-ink-100">⌖ {event.location}</p>
            </Section>
          )}

          {/* Description */}
          {event.detail && (
            <Section title="Notiz">
              <p className="whitespace-pre-line text-[13px] leading-[1.55] text-ink-200">
                {event.detail}
              </p>
            </Section>
          )}

          {/* Checklist */}
          <Section
            title={`Checkliste · ${checklistDone}/${event.checklist.length}`}
            extra={
              event.checklist.length > 0 && (
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#5ee08a]"
                    style={{ width: `${checklistProgress * 100}%` }}
                  />
                </div>
              )
            }
          >
            <div className="flex flex-col gap-1">
              {event.checklist.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2 rounded-[6px] px-1.5 py-1 hover:bg-white/[0.03]"
                >
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await toggleChecklistItem({ eventId: event.id, itemId: item.id });
                        refresh();
                      })
                    }
                    className={`flex h-[16px] w-[16px] items-center justify-center rounded-[4px] border ${
                      item.done
                        ? 'border-[#5ee08a] bg-[#5ee08a]/15'
                        : 'border-white/[0.18] hover:border-white/[0.40]'
                    }`}
                  >
                    {item.done && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#5ee08a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`flex-1 text-[13px] ${
                      item.done ? 'text-ink-300 line-through' : 'text-ink-50'
                    }`}
                  >
                    {item.label}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        await removeChecklistItem({ eventId: event.id, itemId: item.id });
                        refresh();
                      })
                    }
                    className="opacity-0 transition-opacity hover:text-[#ff8a8a] group-hover:opacity-100"
                  >
                    <span className="font-mono text-[11px] text-ink-300">×</span>
                  </button>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newItem.trim()) return;
                  start(async () => {
                    await addChecklistItem({ eventId: event.id, label: newItem });
                    setNewItem('');
                    refresh();
                  });
                }}
                className="flex items-center gap-2 pt-1"
              >
                <input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Neuer Schritt …"
                  className="flex-1 rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[12.5px] text-ink-50 outline-none focus:border-white/[0.18]"
                />
                <button
                  type="submit"
                  disabled={!newItem.trim() || pending}
                  className="rounded-[6px] bg-white px-2 py-1.5 text-[11.5px] font-medium text-black disabled:opacity-30"
                >
                  +
                </button>
              </form>
            </div>
          </Section>

          {/* Created by */}
          {event.createdBy && (
            <Section title="Erstellt">
              <div className="flex items-center gap-2">
                <Avatar
                  initials={event.createdBy.initials}
                  from={event.createdBy.from}
                  to={event.createdBy.to}
                  size={20}
                />
                <span className="text-[12.5px] text-ink-200">{event.createdBy.name}</span>
              </div>
            </Section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

function KindSelect({
  value,
  onChange,
}: {
  value: CalendarEventKind;
  onChange: (k: CalendarEventKind) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CalendarEventKind)}
      className="cursor-pointer rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11.5px] text-ink-200 outline-none hover:bg-white/[0.05]"
    >
      {KINDS.map((k) => (
        <option key={k} value={k}>
          {KIND_META[k].label}
        </option>
      ))}
    </select>
  );
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const v = value ? value.slice(0, 16) : '';
  return (
    <label className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
      {label}
      <input
        type="datetime-local"
        value={v}
        onChange={(e) => onChange(new Date(e.target.value).toISOString())}
        className="rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11.5px] text-ink-50 outline-none hover:bg-white/[0.05]"
      />
    </label>
  );
}

function LinkRow({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode | string;
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
