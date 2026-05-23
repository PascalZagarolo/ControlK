import type { Todo, TodoGroup } from '@/lib/types';

export type BriefInput = {
  firstName: string;
  now?: Date;
  todos: Todo[];
  groups: TodoGroup[];
  currentUserId: string;
};

export type BriefSection =
  | { kind: 'overdue'; items: Todo[] }
  | { kind: 'today'; items: Todo[] }
  | { kind: 'blocked'; items: Todo[] }
  | { kind: 'silent-customers'; entries: { name: string; days: number }[] }
  | { kind: 'expiring-contracts'; entries: { title: string; days: number }[] }
  | { kind: 'stale-groups'; entries: { name: string; staleRatio: number }[] };

export type Brief = {
  greeting: string;
  intro: string;
  sections: BriefSection[];
  totalRiskCents: number;
};

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return 'Spät noch wach';
  if (h < 11) return 'Guten Morgen';
  if (h < 14) return 'Guten Mittag';
  if (h < 18) return 'Hallo';
  return 'Guten Abend';
}

function isToday(iso: string, ref: Date) {
  const d = new Date(iso);
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return d >= start && d < end;
}

function isOverdue(t: Todo, ref: Date) {
  if (!t.dueAt) return false;
  if (t.status !== 'offen' && t.status !== 'in_arbeit') return false;
  return new Date(t.dueAt).getTime() < ref.getTime();
}

export function buildBrief(input: BriefInput): Brief {
  const now = input.now ?? new Date();
  const open = input.todos.filter(
    (t) => t.status === 'offen' || t.status === 'in_arbeit'
  );
  const mine = open.filter((t) => t.assignee?.id === input.currentUserId);
  const todayMine = mine.filter((t) => t.dueAt && isToday(t.dueAt, now));
  const overdueMine = mine.filter((t) => isOverdue(t, now));
  const blockedMine = mine.filter((t) => (t.blockers?.length ?? 0) > 0);

  const silent = new Map<string, { name: string; days: number }>();
  for (const t of open) {
    const days = t.context?.customerSilentDays ?? null;
    if (
      t.links.customer &&
      days != null &&
      days >= 14 &&
      t.context?.customerStatus === 'aktiv'
    ) {
      const prev = silent.get(t.links.customer.id);
      if (!prev || prev.days < days) {
        silent.set(t.links.customer.id, { name: t.links.customer.name, days });
      }
    }
  }

  const expiring = new Map<string, { title: string; days: number }>();
  for (const t of open) {
    const days = t.context?.contractDaysToEnd ?? null;
    if (t.links.contract && days != null && days >= 0 && days <= 14) {
      const prev = expiring.get(t.links.contract.id);
      if (!prev || prev.days > days) {
        expiring.set(t.links.contract.id, { title: t.links.contract.title, days });
      }
    }
  }

  const stale = input.groups.filter(
    (g) => g.health && g.health.staleRatio >= 0.4 && g.openCount >= 3
  );

  const totalRiskCents = mine.reduce(
    (acc, t) => acc + (t.forecastImpact?.valueCents ?? 0),
    0
  );

  let intro = '';
  if (mine.length === 0) {
    intro = 'Du hast aktuell keine offenen Items. Schöner Moment für eine Kaffeepause.';
  } else {
    const parts: string[] = [];
    parts.push(`Heute warten ${mine.length} Items auf dich`);
    if (todayMine.length > 0) parts.push(`davon ${todayMine.length} mit Fälligkeit heute`);
    if (overdueMine.length > 0) parts.push(`${overdueMine.length} überfällig`);
    intro = parts.join(', ') + '.';
    if (totalRiskCents > 0) {
      const eur = Math.round(totalRiskCents / 100).toLocaleString('de-DE');
      intro += ` Insgesamt hängen ${eur} Euro an Pipeline an deinen Aufgaben.`;
    }
  }

  const sections: BriefSection[] = [];
  if (overdueMine.length > 0) sections.push({ kind: 'overdue', items: overdueMine });
  if (todayMine.length > 0) sections.push({ kind: 'today', items: todayMine });
  if (blockedMine.length > 0) sections.push({ kind: 'blocked', items: blockedMine });
  if (silent.size > 0)
    sections.push({
      kind: 'silent-customers',
      entries: Array.from(silent.values()).sort((a, b) => b.days - a.days),
    });
  if (expiring.size > 0)
    sections.push({
      kind: 'expiring-contracts',
      entries: Array.from(expiring.values()).sort((a, b) => a.days - b.days),
    });
  if (stale.length > 0)
    sections.push({
      kind: 'stale-groups',
      entries: stale.map((g) => ({ name: g.name, staleRatio: g.health!.staleRatio })),
    });

  return {
    greeting: `${greeting(now)}, ${input.firstName}`,
    intro,
    sections,
    totalRiskCents,
  };
}

/**
 * Turn the structured brief into a single narrative paragraph suitable for TTS.
 */
export function briefToScript(brief: Brief): string {
  const lines: string[] = [];
  lines.push(`${brief.greeting}. ${brief.intro}`);
  for (const sec of brief.sections) {
    if (sec.kind === 'overdue') {
      const top = sec.items.slice(0, 3).map((t) => t.title).join(', ');
      lines.push(`Zuerst die überfälligen Items: ${top}.`);
    }
    if (sec.kind === 'today') {
      const top = sec.items.slice(0, 4).map((t) => t.title).join(', ');
      lines.push(`Heute fällig: ${top}.`);
    }
    if (sec.kind === 'blocked') {
      lines.push(
        `${sec.items.length} Items sind blockiert — entweder Snooze auf den Trigger oder Blocker auflösen.`
      );
    }
    if (sec.kind === 'silent-customers') {
      const top = sec.entries.slice(0, 3);
      const names = top
        .map((c) => `${c.name} seit ${c.days} Tagen`)
        .join(', ');
      lines.push(`Diese Kunden warten auf ein Lebenszeichen: ${names}.`);
    }
    if (sec.kind === 'expiring-contracts') {
      const top = sec.entries.slice(0, 3);
      const items = top.map((c) => `${c.title} in ${c.days} Tagen`).join(', ');
      lines.push(`Verträge laufen aus: ${items}.`);
    }
    if (sec.kind === 'stale-groups') {
      const names = sec.entries
        .slice(0, 3)
        .map((g) => g.name)
        .join(', ');
      lines.push(`Folgende Gruppen stauben zu: ${names}. Vielleicht Zeit für ein Aufräumen.`);
    }
  }
  if (brief.sections.length === 0) {
    lines.push('Sonst nichts Dringendes. Schöner Tag.');
  } else {
    lines.push('Das war dein Brief. Viel Erfolg.');
  }
  return lines.join(' ');
}
