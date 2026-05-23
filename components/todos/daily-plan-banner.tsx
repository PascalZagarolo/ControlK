'use client';

import { useMemo } from 'react';
import type { Todo } from '@/lib/types';

const PRIORITY_RANK = { urgent: 0, hoch: 1, mittel: 2, niedrig: 3 } as const;

export function DailyPlanBanner({
  todos,
  currentUserId,
  firstName,
}: {
  todos: Todo[];
  currentUserId: string;
  firstName: string;
}) {
  const stats = useMemo(() => computeStats(todos, currentUserId), [todos, currentUserId]);

  return (
    <div className="rounded-[14px] border border-white/[0.10] bg-[linear-gradient(180deg,#1a1c22_0%,#0e0f12_100%)] p-5 shadow-panel">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
          Daily Plan
        </span>
        <h2 className="text-[20px] font-medium leading-tight tracking-[-0.2px] text-ink-50">
          {stats.greeting(firstName)}
        </h2>
      </div>
      <p className="mt-2 max-w-[680px] text-[13.5px] leading-[1.55] text-ink-200">
        {stats.body}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Metric label="Heute" value={stats.todayCount} tone="blue" />
        <Metric label="Überfällig" value={stats.overdueCount} tone="red" />
        <Metric label="Urgent" value={stats.urgentCount} tone="red" />
        <Metric label="In Arbeit" value={stats.inProgressCount} tone="blue" />
        <Metric label="Erledigt heute" value={stats.doneTodayCount} tone="green" />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'red' | 'blue' | 'green' | 'neutral';
}) {
  const color =
    tone === 'red'
      ? 'text-[#ff8a8a]'
      : tone === 'blue'
        ? 'text-[#5eb6ff]'
        : tone === 'green'
          ? 'text-[#5ee08a]'
          : 'text-ink-50';
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">{label}</span>
      <span className={`text-[22px] font-medium leading-none ${value === 0 ? 'text-ink-300/60' : color}`}>
        {value}
      </span>
    </div>
  );
}

function computeStats(todos: Todo[], userId: string) {
  const now = Date.now();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday.getTime() + 86_400_000);

  const mine = todos.filter((t) => assigneeIdOf(t) === userId);
  const openMine = mine.filter((t) => t.status === 'offen' || t.status === 'in_arbeit');
  const overdueCount = openMine.filter(
    (t) => t.dueAt && new Date(t.dueAt).getTime() < startToday.getTime()
  ).length;
  const todayCount = openMine.filter((t) => {
    if (!t.dueAt) return false;
    const ts = new Date(t.dueAt).getTime();
    return ts >= startToday.getTime() && ts < startTomorrow.getTime();
  }).length;
  const urgentCount = openMine.filter((t) => t.priority === 'urgent').length;
  const inProgressCount = mine.filter((t) => t.status === 'in_arbeit').length;
  const doneTodayCount = mine.filter((t) => {
    if (t.status !== 'erledigt' || !t.completedAt) return false;
    const ts = new Date(t.completedAt).getTime();
    return ts >= startToday.getTime() && ts < startTomorrow.getTime();
  }).length;

  const greeting = (name: string) => {
    const hr = new Date().getHours();
    const prefix = hr < 11 ? 'Guten Morgen' : hr < 17 ? 'Hi' : 'Guten Abend';
    if (overdueCount === 0 && todayCount === 0 && urgentCount === 0)
      return `${prefix}, ${name}. Heute frei von Pflichten.`;
    if (overdueCount > 0)
      return `${prefix}, ${name}. ${overdueCount} Sache${overdueCount === 1 ? '' : 'n'} überfällig.`;
    if (urgentCount > 0) return `${prefix}, ${name}. ${urgentCount} urgent.`;
    return `${prefix}, ${name}. ${todayCount} Sache${todayCount === 1 ? '' : 'n'} heute.`;
  };

  const body =
    overdueCount > 0
      ? `Empfehlung: erst die überfälligen, dann das ${todayCount > 0 ? `Heute-Paket (${todayCount})` : 'Tagesgeschäft'}.`
      : todayCount > 0
        ? `Ein gut machbarer Tag. Fokus auf die ${todayCount} fälligen Items, alles andere kann warten.`
        : openMine.length > 0
          ? `Heute keine harten Deadlines. Idealer Tag für Aufholarbeit (${openMine.length} offen).`
          : 'Inbox-Zero im Todo-Sinne. Zeit für die proaktiven Sachen.';

  return { overdueCount, todayCount, urgentCount, inProgressCount, doneTodayCount, greeting, body };
}

function assigneeIdOf(t: Todo): string | undefined {
  return t.assignee?.id;
}
