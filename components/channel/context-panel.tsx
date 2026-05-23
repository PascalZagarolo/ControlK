'use client';

import Link from 'next/link';
import { Avatar } from './avatar';
import type { Channel } from '@/lib/types';

const PINNED_ICON: Record<string, string> = {
  contract: '§',
  customer: '◉',
  vehicle: '⊞',
  todo: '✓',
  doc: '📄',
  thread: '↳',
  link: '🔗',
};

const STAGE_COLOR: Record<string, string> = {
  lead: '#5eb6ff',
  angebot: '#c084fc',
  verhandlung: '#ffb45e',
  gewonnen: '#5ee08a',
  verloren: '#ff8a8a',
  onboarding: '#5eb6ff',
  aktiv: '#5ee08a',
};

function fmtEur(cents?: number) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

function pinHref(p: { kind: string; targetId?: string; url?: string }): string {
  if (p.url) return p.url;
  if (!p.targetId) return '#';
  if (p.kind === 'contract') return `/vertraege/${p.targetId}`;
  if (p.kind === 'customer') return `/kunden/${p.targetId}`;
  if (p.kind === 'vehicle') return `/flotte/${p.targetId}`;
  if (p.kind === 'todo') return `/todos?todo=${p.targetId}`;
  return '#';
}

export function ContextPanel({
  channel,
  onClose,
}: {
  channel: Channel;
  onClose: () => void;
}) {
  const health = channel.health;
  const stage = channel.dealStage;

  return (
    <aside className="fixed right-4 top-[88px] z-30 hidden w-[320px] flex-col gap-3 overflow-y-auto rounded-[14px] border border-white/[0.08] bg-[rgba(14,15,18,0.92)] p-4 shadow-panel backdrop-blur-xl backdrop-saturate-150 lg:flex" style={{ maxHeight: 'calc(100vh - 112px)' }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Live-Kontext
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="flex h-6 w-6 items-center justify-center rounded-full text-ink-300 hover:bg-white/[0.06] hover:text-ink-50"
        >
          ✕
        </button>
      </div>

      {/* Channel-Health */}
      {health && (
        <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
              Channel-Health
            </span>
            <span
              className="font-mono text-[18px] tabular-nums leading-none"
              style={{
                color:
                  health.score >= 70 ? '#5ee08a' : health.score >= 40 ? '#ffd96a' : '#ff8a8a',
              }}
            >
              {health.score}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10.5px] text-ink-300">
            <span>Response: {Math.round(health.responseRate * 100)}%</span>
            {health.medianFirstReplyMinutes != null && (
              <span>
                Reply ⌀{' '}
                {health.medianFirstReplyMinutes < 60
                  ? `${health.medianFirstReplyMinutes}m`
                  : `${Math.round(health.medianFirstReplyMinutes / 60)}h`}
              </span>
            )}
            {health.staleThreadCount > 0 && (
              <span className="text-[#ffd96a]">{health.staleThreadCount} stale</span>
            )}
          </div>
          <div className="mt-2 flex items-end gap-[2px] h-4">
            {health.spark.map((n, i) => {
              const max = Math.max(1, ...health.spark);
              return (
                <span
                  key={i}
                  className="flex-1 rounded-[1px] bg-[#5eb6ff]/40"
                  style={{ height: `${Math.max(8, (n / max) * 100)}%` }}
                  title={`${n} Messages`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Linked Customer Card */}
      {channel.linkedCustomer && (
        <Link
          href={`/kunden/${channel.linkedCustomer.slug}`}
          className="group flex items-start gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
        >
          <Avatar
            initials={channel.linkedCustomer.initials}
            from={channel.linkedCustomer.from}
            to={channel.linkedCustomer.to}
            size={36}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium text-ink-50">
              {channel.linkedCustomer.name}
            </p>
            <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
              {channel.linkedCustomer.status}
              {channel.linkedCustomer.mrcCents != null &&
                channel.linkedCustomer.mrcCents > 0 &&
                ` · ${fmtEur(channel.linkedCustomer.mrcCents)} MRC`}
            </p>
          </div>
          <span className="font-mono text-[11px] text-ink-300 group-hover:text-ink-50">→</span>
        </Link>
      )}

      {/* Deal-Stage */}
      {stage && (
        <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Deal-Stage
          </span>
          <p
            className="mt-1 font-mono text-[14px] uppercase tracking-[0.3px]"
            style={{ color: STAGE_COLOR[stage] ?? '#9c9c9d' }}
          >
            {stage}
          </p>
        </div>
      )}

      {/* Pinned Items */}
      {channel.pinned.length > 0 && (
        <Section title={`Pinned · ${channel.pinned.length}`}>
          {channel.pinned.map((p) => (
            <Link
              key={p.id}
              href={pinHref(p)}
              className="group flex items-start gap-2 rounded-[8px] px-1.5 py-1.5 transition-colors hover:bg-white/[0.05]"
            >
              <span className="font-mono text-[12px] text-ink-300">
                {PINNED_ICON[p.kind] ?? '·'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] leading-tight text-ink-50">
                  {p.label}
                </span>
                <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.3px] text-ink-300">
                  {p.kind}
                </span>
              </span>
            </Link>
          ))}
        </Section>
      )}

      {/* Linked Deals (Contracts) */}
      {channel.linkedDeals.length > 0 && (
        <Section title="Verträge">
          {channel.linkedDeals.map((d) => (
            <Link
              key={d.id}
              href={`/vertraege/${d.id}`}
              className="group flex items-start gap-2 rounded-[8px] px-1.5 py-1.5 transition-colors hover:bg-white/[0.05]"
            >
              <span className="font-mono text-[12px] text-ink-300">§</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] leading-tight text-ink-50">
                  {d.title}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-ink-300">
                  {d.status} · {d.value}
                </span>
              </span>
            </Link>
          ))}
        </Section>
      )}

      {/* Members */}
      {channel.membersPreview.length > 0 && (
        <Section title={`Mitglieder · ${channel.members}`}>
          <div className="grid grid-cols-2 gap-1">
            {channel.membersPreview.map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-[8px] px-1.5 py-1"
              >
                <Avatar initials={m.initials} from={m.from} to={m.to} size={20} />
                <span className="truncate text-[12px] leading-tight text-ink-200">{m.name}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div className="mb-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
