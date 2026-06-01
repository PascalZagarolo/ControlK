'use client';

/**
 * Customer-centric inbox UI — three lenses (Schritt 5). Additive to the
 * chronological /inbox view. Each row links into the existing /inbox/[id]
 * detail (where Mail→Todo + tagging live), so this view owns no mail state.
 */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ClientGroup, ClientMailRow, WaitingRow } from '@/lib/db/queries/clients';

type View = 'nach_kunde' | 'wartet' | 'von_kunden';

const VIEW_LABEL: Record<View, string> = {
  nach_kunde: 'Nach Kunde',
  wartet: 'Wartet',
  von_kunden: 'Von Kunden',
};

function waitColor(days: number): string {
  if (days >= 7) return '#ff8a8a';
  if (days >= 4) return '#E8B86D';
  return '#9c9c9d';
}

export function ClientsInboxClient({
  view,
  groups,
  waiting,
  clientMail,
  tagCount,
}: {
  view: View;
  groups: { clients: ClientGroup[]; other: ClientGroup | null };
  waiting: WaitingRow[];
  clientMail: ClientMailRow[];
  tagCount: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const setView = (next: View) => {
    const params = new URLSearchParams(sp.toString());
    params.set('view', next);
    router.push(`/inbox/clients?${params.toString()}`);
  };

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6 px-4 pb-32 pt-24 md:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#52525B]">
              Kunden-Inbox
            </span>
            <p className="text-[13px] text-[#A1A1AA]">
              {tagCount} {tagCount === 1 ? 'getaggter Kontakt' : 'getaggte Kontakte'} ·
              rauschfrei über die Triage
            </p>
          </div>
          <Link
            href="/inbox"
            className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] text-ink-200 transition-colors hover:bg-white/[0.05] hover:text-ink-50"
          >
            Chronologisch →
          </Link>
        </div>

        {/* View switch */}
        <nav className="flex items-center gap-0.5 self-start rounded-full border border-white/[0.06] bg-white/[0.02] p-0.5">
          {(['nach_kunde', 'wartet', 'von_kunden'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
                view === v ? 'bg-white/[0.08] text-[#FAFAFA]' : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
              }`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </nav>
      </header>

      {view === 'nach_kunde' && <NachKunde groups={groups} />}
      {view === 'wartet' && <Wartet rows={waiting} />}
      {view === 'von_kunden' && <VonKunden rows={clientMail} hasTags={tagCount > 0} />}
    </div>
  );
}

// ── B1 ───────────────────────────────────────────────────────────────

function NachKunde({ groups }: { groups: { clients: ClientGroup[]; other: ClientGroup | null } }) {
  const { clients, other } = groups;
  if (clients.length === 0 && !other) {
    return (
      <EmptyHint
        title="Noch keine Mails."
        sub="Sobald Mail synchronisiert ist, erscheinen deine Kunden hier gruppiert."
      />
    );
  }
  if (clients.length === 0) {
    return (
      <>
        <EmptyHint
          title="Noch keine Kunden getaggt."
          sub={'Öffne eine Mail und „Als Kunde markieren" — dann sammeln sich die Threads hier.'}
        />
        {other && <GroupCard group={other} />}
      </>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {clients.map((g) => (
        <GroupCard key={g.key} group={g} />
      ))}
      {other && <GroupCard key="__other__" group={other} muted />}
    </ul>
  );
}

function GroupCard({ group, muted = false }: { group: ClientGroup; muted?: boolean }) {
  return (
    <li
      className={`rounded-[12px] border bg-white/[0.015] px-4 py-3 ${
        muted ? 'border-white/[0.04]' : 'border-[#1F1F23]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-medium"
          style={{
            background: group.isClient ? 'rgba(94,224,138,0.12)' : 'rgba(255,255,255,0.04)',
            color: group.isClient ? '#5ee08a' : '#9c9c9d',
          }}
        >
          {group.isClient ? '◉' : '·'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium text-ink-50">{group.displayName}</span>
            {group.needsReply && (
              <span className="rounded-full bg-[#5E9EFF]/[0.12] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2px] text-[#5E9EFF]">
                braucht Antwort
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-300">
            <span>{group.totalCount} {group.totalCount === 1 ? 'Mail' : 'Mails'}</span>
            {group.unreadCount > 0 && (
              <>
                <span aria-hidden className="text-ink-300/50">·</span>
                <span className="text-[#E8B86D]">{group.unreadCount} ungelesen</span>
              </>
            )}
            {group.openCommitments > 0 && (
              <>
                <span aria-hidden className="text-ink-300/50">·</span>
                <span className="text-[#5ee08a]">
                  {group.openCommitments} offene {group.openCommitments === 1 ? 'Zusage' : 'Zusagen'}
                </span>
              </>
            )}
            <span aria-hidden className="text-ink-300/50">·</span>
            <span>zuletzt {relDays(group.latestReceivedAt)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

// ── B2 ───────────────────────────────────────────────────────────────

function Wartet({ rows }: { rows: WaitingRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyHint
        title="Niemand wartet auf dich."
        sub="Keine ungelesenen 1:1-Mails offen. Marketing & No-Reply zählen hier bewusst nicht mit."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/inbox/${r.id}`}
            className="flex items-center gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.015] px-4 py-3 transition-colors hover:border-white/[0.14] hover:bg-white/[0.03]"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: waitColor(r.waitingDays) }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium text-ink-50">
                  {r.clientName ?? r.senderName}
                </span>
                {r.isClient && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.2px] text-[#5ee08a]">
                    Kunde
                  </span>
                )}
              </div>
              <span className="mt-0.5 block truncate text-[12px] text-ink-300">
                {r.subject ?? '(kein Betreff)'}
              </span>
            </div>
            <span
              className="shrink-0 font-mono text-[11px] tabular-nums"
              style={{ color: waitColor(r.waitingDays) }}
            >
              {r.waitingDays === 0 ? 'heute' : `wartet ${r.waitingDays} ${r.waitingDays === 1 ? 'Tag' : 'Tage'}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── B3 ───────────────────────────────────────────────────────────────

function VonKunden({ rows, hasTags }: { rows: ClientMailRow[]; hasTags: boolean }) {
  if (!hasTags) {
    return (
      <EmptyHint
        title="Noch keine Kunden getaggt."
        sub="Markiere Absender als Kunden — dann zeigt diese Ansicht nur deren Mail, frei von Newslettern."
      />
    );
  }
  if (rows.length === 0) {
    return <EmptyHint title="Von deinen Kunden kam zuletzt nichts." sub="Sobald ein getaggter Kunde schreibt, erscheint es hier." />;
  }
  return (
    <ul className="flex flex-col">
      {rows.map((r, i) => (
        <li key={r.id} className={i === 0 ? '' : 'border-t border-white/[0.04]'}>
          <Link
            href={`/inbox/${r.id}`}
            className="grid grid-cols-[160px_1fr_64px] items-baseline gap-4 px-1 py-3 transition-colors hover:bg-white/[0.02]"
          >
            <span className={`truncate text-[13px] ${r.isRead ? 'text-ink-200' : 'font-medium text-ink-50'}`}>
              {r.clientName}
            </span>
            <span className="min-w-0">
              <span className={`block truncate text-[13.5px] ${r.isRead ? 'text-ink-200' : 'text-ink-50'}`}>
                {r.subject ?? '(kein Betreff)'}
              </span>
              {r.preview && (
                <span className="mt-0.5 block truncate text-[12px] text-[#71717A]">{r.preview}</span>
              )}
            </span>
            <span className="justify-self-end font-mono text-[10.5px] uppercase text-[#52525B]">
              {relDays(r.receivedAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ── shared ───────────────────────────────────────────────────────────

function EmptyHint({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[16px] border border-white/[0.06] bg-white/[0.015] py-16 text-center">
      <p className="text-[14.5px] font-medium text-ink-100">{title}</p>
      <p className="max-w-[44ch] text-[12.5px] leading-[1.6] text-ink-300">{sub}</p>
    </div>
  );
}

function relDays(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return 'heute';
  if (d === 1) return 'gestern';
  if (d < 14) return `vor ${d}d`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}
