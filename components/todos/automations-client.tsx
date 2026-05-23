'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/channel/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTriggerInline,
} from '@/components/ui/select';
import { PriorityPill } from './todo-pill';
import {
  runRulesNow,
  setRuleAssignee,
  setRulePriority,
  toggleRule,
} from '@/lib/actions/automations';
import type { AutoRule, AutoRuleSlug, TodoPriority, TodoUser } from '@/lib/types';

const RULE_META: Record<
  AutoRuleSlug,
  { title: string; description: string; group: 'Verträge' | 'Kunden' | 'Flotte' }
> = {
  contract_starting_tomorrow: {
    group: 'Verträge',
    title: 'Übergabe-Vorbereitung am Vortag',
    description: 'Erzeugt ein Todo, wenn ein Vertrag morgen startet.',
  },
  contract_ending_in_14_days: {
    group: 'Verträge',
    title: 'Verlängerung anbieten — 14 Tage vor Auslauf',
    description: 'Frühwarnung für Bestandskunden-Retention.',
  },
  contract_ending_in_30_days: {
    group: 'Verträge',
    title: 'Verlängerung anbieten — 30 Tage vor Auslauf',
    description: 'Frühere Variante mit mehr Spielraum für Verhandlung.',
  },
  contract_lost_followup_90d: {
    group: 'Verträge',
    title: 'Wiedervorlage bei verlorenen Verträgen',
    description: 'Nach 90 Tagen ein "Nachfass-Versuch?"-Todo, falls Budget zurück ist.',
  },
  lead_stale_10d: {
    group: 'Kunden',
    title: 'Lead 10 Tage stumm',
    description: 'Sales-Nachfass wenn der Lead 10 Tage nichts gehört hat.',
  },
  lead_stale_30d: {
    group: 'Kunden',
    title: 'Lead 30 Tage stumm',
    description: 'Eskalation für lange ruhende Leads — Status-Check fällig.',
  },
  customer_inactive_30d: {
    group: 'Kunden',
    title: 'Aktiver Kunde 30 Tage inaktiv',
    description: 'Account-Health-Signal: aktiver Kunde meldet sich nicht.',
  },
  customer_onboarding_30d: {
    group: 'Kunden',
    title: '30-Tage-Onboarding-Check',
    description: 'Standard-Check-In nach dem ersten Monat eines neuen Kunden.',
  },
  vehicle_service_due: {
    group: 'Flotte',
    title: 'Inspektion / HU fällig',
    description: 'Wartung planen, bevor das Fahrzeug im Standby steckt.',
  },
};

const GROUPS: Array<{ key: 'Verträge' | 'Kunden' | 'Flotte'; sub: string }> = [
  { key: 'Verträge', sub: 'Lifecycle-Events des Vertrags-Bestands.' },
  { key: 'Kunden', sub: 'Pipeline-Hygiene und Account-Health.' },
  { key: 'Flotte', sub: 'Wartung und Verfügbarkeits-Signale.' },
];

export function AutomationsClient({
  rules,
  members,
}: {
  rules: AutoRule[];
  members: TodoUser[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [running, setRunning] = useState<{ created: number } | null>(null);

  const onRunNow = () => {
    setRunning(null);
    start(async () => {
      const res = await runRulesNow();
      if (res.ok) {
        setRunning({ created: res.created });
        router.refresh();
      }
    });
  };

  const rulesBySlug = new Map(rules.map((r) => [r.slug, r]));

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pb-32 pt-28">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.4px] text-ink-300">
          Einstellungen
        </span>
        <h1 className="text-[32px] font-medium leading-[1.1] tracking-[-0.4px] text-ink-50 md:text-[36px]">
          Auto-Todos
        </h1>
        <p className="max-w-[640px] text-[14.5px] leading-[1.6] text-ink-200">
          Lass uRent für dich mitdenken. Aktive Regeln erzeugen automatisch Todos aus
          Vertrags-/Kunden-/Flotten-Events — du kriegst Sachen auf den Schirm, an die du
          sonst nicht gedacht hättest.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRunNow}
            disabled={pending}
            className="rounded-full bg-white px-4 py-2 text-[12.5px] font-medium leading-none text-black transition-opacity hover:bg-white/90 disabled:opacity-40"
          >
            {pending ? 'Läuft …' : 'Regeln jetzt prüfen'}
          </button>
          {running && (
            <span className="font-mono text-[11px] uppercase tracking-[0.3px] text-ink-300">
              {running.created === 0
                ? 'Keine neuen Todos erzeugt.'
                : `${running.created} neue Todos erzeugt.`}
            </span>
          )}
          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
            Cron läuft stündlich
          </span>
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-6">
        {GROUPS.map((group) => {
          const items = (Object.keys(RULE_META) as AutoRuleSlug[]).filter(
            (s) => RULE_META[s].group === group.key
          );
          return (
            <section key={group.key} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <h2 className="text-[15px] font-medium text-ink-50">{group.key}</h2>
                <span className="text-[12.5px] text-ink-300">{group.sub}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((slug) => {
                  const rule = rulesBySlug.get(slug);
                  if (!rule) return null;
                  return (
                    <RuleRow key={slug} rule={rule} members={members} onChanged={() => router.refresh()} />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  members,
  onChanged,
}: {
  rule: AutoRule;
  members: TodoUser[];
  onChanged: () => void;
}) {
  const meta = RULE_META[rule.slug];
  const [pending, start] = useTransition();

  const onToggle = (checked: boolean) => {
    start(async () => {
      await toggleRule(rule.slug, checked);
      onChanged();
    });
  };
  const onAssigneeChange = (id: string) => {
    start(async () => {
      await setRuleAssignee(rule.slug, id || null);
      onChanged();
    });
  };
  const onPriorityChange = (p: TodoPriority) => {
    start(async () => {
      await setRulePriority(rule.slug, p);
      onChanged();
    });
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-[12px] border bg-[rgba(20,21,23,0.5)] p-4 transition-colors ${
        rule.enabled ? 'border-white/[0.10]' : 'border-white/[0.04]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-[13.5px] font-medium leading-tight ${rule.enabled ? 'text-ink-50' : 'text-ink-200'}`}>
              {meta.title}
            </h3>
            {rule.lastRunAt && (
              <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                zuletzt:{' '}
                {new Date(rule.lastRunAt).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-300">{meta.description}</p>
        </div>
        <ToggleSwitch checked={rule.enabled} disabled={pending} onChange={onToggle} />
      </div>

      {rule.enabled && (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
          <div className="inline-flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
              Zuweisung
            </span>
            <Select
              value={rule.defaultAssignee?.id ?? '__none__'}
              onValueChange={(v) => onAssigneeChange(v === '__none__' ? '' : v)}
              disabled={pending}
            >
              <SelectTriggerInline>
                <span className="flex items-center gap-1.5">
                  {rule.defaultAssignee ? (
                    <>
                      <Avatar
                        initials={rule.defaultAssignee.initials}
                        from={rule.defaultAssignee.from}
                        to={rule.defaultAssignee.to}
                        size={16}
                      />
                      <span>{rule.defaultAssignee.name}</span>
                    </>
                  ) : (
                    <span className="text-ink-300">Owner</span>
                  )}
                </span>
              </SelectTriggerInline>
              <SelectContent>
                <SelectItem value="__none__">Owner</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
              Priorität
            </span>
            <Select
              value={rule.defaultPriority}
              onValueChange={(v) => onPriorityChange(v as TodoPriority)}
              disabled={pending}
            >
              <SelectTriggerInline>
                <span className="flex items-center gap-1.5">
                  <PriorityPill priority={rule.defaultPriority} />
                  <span>{rule.defaultPriority}</span>
                </span>
              </SelectTriggerInline>
              <SelectContent>
                <SelectItem value="niedrig">niedrig</SelectItem>
                <SelectItem value="mittel">mittel</SelectItem>
                <SelectItem value="hoch">hoch</SelectItem>
                <SelectItem value="urgent">urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-[#5ee08a]/30' : 'bg-white/[0.08]'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full transition-transform duration-200 ${
          checked ? 'translate-x-[22px] bg-[#5ee08a]' : 'translate-x-[2px] bg-white/60'
        }`}
      />
    </button>
  );
}
