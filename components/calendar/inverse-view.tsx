'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  bootstrapInverseCalendar,
  muteStandstill,
  snoozeStandstill,
  acknowledgeStandstill,
} from '@/lib/actions/inverse-calendar';
import type { StandstillRow } from '@/lib/db/queries/inverse-calendar';
import { FollowUpDraftModal } from './follow-up-draft-modal';

type EntityFilter = 'all' | 'person' | 'customer' | 'channel' | 'note' | 'project';
type SortMode = 'importance' | 'duration' | 'alphabetical';

const FILTER_LABEL: Record<EntityFilter, string> = {
  all: 'Alle',
  person: 'Personen',
  customer: 'Kunden',
  channel: 'Channels',
  note: 'Notizen',
  project: 'Projekte',
};

const SEVERITY_LABEL = {
  kritisch: 'KRITISCH',
  auffaellig: 'AUFFÄLLIG',
  normal: '',
} as const;

const SEVERITY_DOT: Record<'kritisch' | 'auffaellig', string> = {
  kritisch: '#FF8A5C',
  auffaellig: '#E8B86D',
};

export function InverseView({
  standstills,
  hasActivity,
}: {
  standstills: StandstillRow[];
  hasActivity: boolean;
}) {
  const [filter, setFilter] = useState<EntityFilter>('all');
  const [sort, setSort] = useState<SortMode>('importance');
  const [draftFor, setDraftFor] = useState<StandstillRow | null>(null);

  const counts = useMemo(() => {
    const c: Record<EntityFilter, number> = {
      all: standstills.length,
      person: 0,
      customer: 0,
      channel: 0,
      note: 0,
      project: 0,
    };
    for (const r of standstills) c[r.entityType] += 1;
    return c;
  }, [standstills]);

  const visible = useMemo(() => {
    let list =
      filter === 'all'
        ? standstills
        : standstills.filter((r) => r.entityType === filter);
    list = [...list].sort((a, b) => {
      // Acknowledged rows always sink to the bottom regardless of sort mode
      if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
      if (sort === 'duration') return b.daysSilent - a.daysSilent;
      if (sort === 'alphabetical')
        return a.entityDisplayName.localeCompare(b.entityDisplayName);
      return b.importanceScore - a.importanceScore;
    });
    return list;
  }, [standstills, filter, sort]);

  const groups = useMemo(() => {
    const kritisch: StandstillRow[] = [];
    const auffaellig: StandstillRow[] = [];
    for (const r of visible) {
      if (r.severity === 'kritisch') kritisch.push(r);
      else if (r.severity === 'auffaellig') auffaellig.push(r);
    }
    return { kritisch, auffaellig };
  }, [visible]);

  return (
    <div className="h-full overflow-y-auto bg-ink-900">
      <div className="mx-auto w-full max-w-[760px] px-6 py-8">
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
            Inverse
          </p>
          <h1 className="mt-1 text-[22px] font-medium leading-tight text-ink-50">
            Stillstand · Vergessenes · Was ruht
          </h1>
        </div>

        {!hasActivity ? (
          <BootstrapEmpty />
        ) : standstills.length === 0 ? (
          <AllFlowingEmpty />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {(['all', 'person', 'customer', 'channel', 'note', 'project'] as EntityFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition-colors ${
                    f === filter
                      ? 'bg-white/[0.08] text-ink-50'
                      : 'bg-white/[0.025] text-ink-300 hover:bg-white/[0.05] hover:text-ink-100'
                  }`}
                >
                  <span>{FILTER_LABEL[f]}</span>
                  {counts[f] > 0 && (
                    <span className="font-mono text-[10px] text-ink-300">
                      {counts[f]}
                    </span>
                  )}
                </button>
              ))}
              <span className="ml-auto inline-flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
                  Sortiert nach
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="rounded-md bg-white/[0.04] px-2 py-1 text-[11.5px] text-ink-100 outline-none focus:bg-white/[0.07]"
                >
                  <option value="importance">Wichtigkeit</option>
                  <option value="duration">Dauer</option>
                  <option value="alphabetical">Alphabet</option>
                </select>
              </span>
            </div>

            <SeveritySection
              label={SEVERITY_LABEL.kritisch}
              hint="seit über 2× deinem üblichen Rhythmus"
              rows={groups.kritisch}
              onDraft={setDraftFor}
            />
            <SeveritySection
              label={SEVERITY_LABEL.auffaellig}
              hint="seit 1-2× deinem üblichen Rhythmus"
              rows={groups.auffaellig}
              onDraft={setDraftFor}
            />

            <div className="mt-12 text-center text-[11px] text-ink-300">
              <Link
                href="/settings/inverse-calendar"
                className="underline-offset-2 hover:underline"
              >
                Stumm geschaltete Entitäten verwalten
              </Link>
            </div>
          </>
        )}
      </div>

      {draftFor && (
        <FollowUpDraftModal
          thresholdId={draftFor.id}
          recipientEmail={draftFor.entityId}
          recipientName={draftFor.entityDisplayName}
          onClose={() => setDraftFor(null)}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
function SeveritySection({
  label,
  hint,
  rows,
  onDraft,
}: {
  label: string;
  hint: string;
  rows: StandstillRow[];
  onDraft: (r: StandstillRow) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-8 flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-300">
          {label}
        </h2>
        <span className="text-[11px] italic text-ink-300/70">· {hint}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <StandstillCard key={r.id} row={r} onDraft={onDraft} />
        ))}
      </ul>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────
function StandstillCard({
  row,
  onDraft,
}: {
  row: StandstillRow;
  onDraft: (r: StandstillRow) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [acked, setAcked] = useState(row.acknowledged);
  const [vanished, setVanished] = useState(false);

  const dot = row.severity === 'kritisch'
    ? SEVERITY_DOT.kritisch
    : row.severity === 'auffaellig'
      ? SEVERITY_DOT.auffaellig
      : '#52525B';

  const stillness = row.entityType === 'channel' ? 'Tage ohne Aktivität' : 'Tage stumm';
  const lastInteractionLabel = row.lastInteractionAt
    ? `Letzter Kontakt: ${new Date(row.lastInteractionAt).toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
      })}`
    : 'Bisher kein registrierter Kontakt';

  const rhythmLabel =
    row.medianDaysBetween && row.medianDaysBetween > 0
      ? `Üblicher Rhythmus: alle ~${Math.round(row.medianDaysBetween)} Tage`
      : 'Noch kein gelernter Rhythmus';

  const onSnooze = () => {
    start(async () => {
      const res = await snoozeStandstill(row.id, 7);
      if (res.ok) {
        setVanished(true);
        router.refresh();
      }
    });
  };

  const onMute = () => {
    if (
      !confirm(
        `${row.entityDisplayName} nicht mehr in Stillstand anzeigen? Du kannst das in den Einstellungen rückgängig machen.`
      )
    )
      return;
    start(async () => {
      const res = await muteStandstill(row.id);
      if (res.ok) {
        setVanished(true);
        router.refresh();
      }
    });
  };

  const onFollowUp = () => {
    if (row.entityType === 'channel') {
      // Channels open directly; entity_id is the channel UUID, but we
      // don't have the slug here. Send to /channels for now.
      start(async () => {
        await acknowledgeStandstill(row.id);
        setAcked(true);
        router.refresh();
      });
      window.open('/channels', '_self');
      return;
    }
    if (row.entityType === 'person') {
      // AI-Draft flow: open the modal; acknowledgement happens when the
      // user actually copies or opens Gmail from inside the modal.
      onDraft(row);
      return;
    }
    // Other entity types (customer/project/note) — just acknowledge
    // for now. Dedicated nav comes in Phase 4c.
    start(async () => {
      await acknowledgeStandstill(row.id);
      setAcked(true);
      router.refresh();
    });
  };

  if (vanished) return null;

  return (
    <li
      className={`flex flex-col gap-2 rounded-[10px] border border-[#1F1F23] bg-[#0E0E11] p-4 transition-opacity ${
        acked ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: dot }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[14.5px] font-medium leading-tight text-ink-50">
              {row.entityDisplayName}
            </span>
            <span className="shrink-0 font-mono text-[12.5px] text-ink-300">
              <span className="text-ink-100">{row.daysSilent}</span> {stillness}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-tight text-ink-300">
            {lastInteractionLabel}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-ink-300/70">
            {rhythmLabel} · {row.totalInteractions} Interaktionen
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-5">
        <button
          type="button"
          onClick={onFollowUp}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md bg-[#E8B86D]/[0.18] px-2.5 py-1 text-[11.5px] font-medium text-[#E8B86D] transition-opacity hover:bg-[#E8B86D]/[0.28] disabled:opacity-50"
        >
          {row.entityType === 'channel' ? 'Channel öffnen' : 'Nachfassen'}
        </button>
        <button
          type="button"
          onClick={onSnooze}
          disabled={pending}
          className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11.5px] text-ink-200 transition-colors hover:border-white/[0.16] hover:text-ink-50 disabled:opacity-50"
        >
          Snoozen 7d
        </button>
        <button
          type="button"
          onClick={onMute}
          disabled={pending}
          className="rounded-md px-2.5 py-1 text-[11.5px] text-ink-300 transition-colors hover:text-[#ff8a8a] disabled:opacity-50"
        >
          Egal
        </button>
      </div>
    </li>
  );
}

// ───────────────────────────────────────────────────────────────
function BootstrapEmpty() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ activity: number; entities: number; entered: number } | null>(
    null
  );

  const onRun = () => {
    setError(null);
    start(async () => {
      const res = await bootstrapInverseCalendar();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone({ activity: res.activity, entities: res.entities, entered: res.entered });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] px-8 py-16 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-300">
        Erste Initialisierung
      </p>
      <h2 className="text-[18px] font-medium text-ink-50">
        Inverse Calendar braucht erst Daten zum Lernen.
      </h2>
      <p className="max-w-[440px] text-[13px] leading-[1.55] text-ink-300">
        Ich gehe einmalig durch deine Kalender-Events, Inbox-Mails,
        Channel-Nachrichten und Notiz-Mentions. Daraus baue ich für jede Person,
        jeden Kunden und jeden Channel einen gelernten Rhythmus. Danach erkennt
        das System Stillstände automatisch.
      </p>
      {error && <p className="text-[12px] text-[#ff8a8a]">{error}</p>}
      {done ? (
        <p className="text-[12.5px] text-[#5FCFA8]">
          ✓ {done.activity} Interaktionen, {done.entities} Entitäten gelernt,
          {' '}
          {done.entered} im Stillstand erkannt.
        </p>
      ) : (
        <button
          type="button"
          onClick={onRun}
          disabled={pending}
          className="rounded-md bg-[#E8B86D]/[0.18] px-4 py-2 text-[13px] font-medium text-[#E8B86D] transition-opacity hover:bg-[#E8B86D]/[0.28] disabled:opacity-50"
        >
          {pending ? 'Lerne deine Rhythmen …' : 'Inverse Calendar starten'}
        </button>
      )}
    </div>
  );
}

function AllFlowingEmpty() {
  return (
    <div className="mt-12 flex flex-col items-center gap-2 text-center">
      <h2 className="text-[18px] italic text-ink-100">Alles im Fluss.</h2>
      <p className="max-w-[420px] text-[13px] italic leading-[1.55] text-ink-300">
        Keine vergessenen Beziehungen, keine ruhenden Channels. Du bleibst gut
        in Verbindung.
      </p>
    </div>
  );
}
