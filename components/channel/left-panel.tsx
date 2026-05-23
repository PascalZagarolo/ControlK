'use client';

import Link from 'next/link';
import { Avatar } from './avatar';
import type { Channel, DealRadarInsight } from '@/lib/types';

export function LeftPanel({
  channel,
  onClose,
}: {
  channel: Channel;
  onClose: () => void;
}) {
  return (
    <aside className="fixed left-4 top-[88px] z-30 hidden w-[320px] flex-col gap-3 lg:flex">
      <DealRadarSection items={channel.dealRadar} />
      <QuickActions />
      <ConnectedChannelsSection channel={channel} />
      <PresenceSection channel={channel} />
      <button
        type="button"
        onClick={onClose}
        className="ml-2 mt-1 self-start font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300 transition-colors hover:text-ink-50"
      >
        Panel ausblenden
      </button>
    </aside>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-white/[0.08] bg-[rgba(14,15,18,0.85)] p-4 shadow-panel backdrop-blur-xl backdrop-saturate-150">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        {label}
      </div>
      {children}
    </section>
  );
}

function DealRadarSection({ items }: { items: DealRadarInsight[] }) {
  return (
    <Panel label="Deal Radar">
      <div className="flex flex-col gap-2.5">
        {items.map((i) => (
          <RadarItem key={i.id} item={i} />
        ))}
      </div>
    </Panel>
  );
}

function RadarItem({ item }: { item: DealRadarInsight }) {
  return (
    <div className="rounded-[10px] border border-white/[0.04] bg-white/[0.02] p-3 transition-colors duration-150 hover:border-white/[0.10] hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <KindDot kind={item.kind} />
          <span className="text-[12.5px] font-medium leading-tight text-ink-50">{item.title}</span>
        </div>
        {item.value && (
          <span
            className={`shrink-0 font-mono text-[11px] font-medium leading-none ${
              item.trend === 'up'
                ? 'text-[#5ee08a]'
                : item.trend === 'down'
                  ? 'text-[#ff8a8a]'
                  : 'text-ink-200'
            }`}
          >
            {item.value}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-[1.5] text-ink-300">{item.detail}</p>
    </div>
  );
}

function KindDot({ kind }: { kind: DealRadarInsight['kind'] }) {
  const color =
    kind === 'forecast'
      ? '#5ee08a'
      : kind === 'momentum'
        ? '#5eb6ff'
        : kind === 'stuck'
          ? '#ff8a8a'
          : '#c084fc';
  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
    />
  );
}

function QuickActions() {
  const actions = [
    { label: 'Deal aus Thread', icon: <PlusIcon /> },
    { label: 'Kunde verknüpfen', icon: <LinkIcon /> },
    { label: 'Vertrag erstellen', icon: <DocIcon /> },
    { label: 'Termin planen', icon: <CalendarIcon /> },
  ];
  return (
    <Panel label="Schnellaktionen">
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => console.log('action:', a.label)}
            className="flex items-center gap-2 rounded-[8px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left text-[11.5px] leading-tight text-ink-200 transition-colors duration-150 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-ink-50"
          >
            <span className="shrink-0 text-ink-300">{a.icon}</span>
            <span className="truncate">{a.label}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ConnectedChannelsSection({ channel }: { channel: Channel }) {
  if (channel.connectedChannels.length === 0) return null;
  return (
    <Panel label="Verbundene Channels">
      <div className="flex flex-col gap-1.5">
        {channel.connectedChannels.map((c) => (
          <Link
            key={c.slug}
            href={`/channels/${c.slug}`}
            className="block rounded-[10px] border border-white/[0.04] bg-white/[0.02] p-3 transition-colors duration-150 hover:border-white/[0.12] hover:bg-white/[0.05]"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] leading-none text-ink-200">#</span>
              <span className="text-[12.5px] font-medium leading-none text-ink-50">{c.name}</span>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-[1.5] text-ink-300">{c.reason}</p>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function PresenceSection({ channel }: { channel: Channel }) {
  const online = channel.membersPreview.filter((m) => m.online);
  const offline = channel.membersPreview.filter((m) => !m.online);
  return (
    <Panel label={`Wer ist live · ${online.length}`}>
      <div className="flex flex-col gap-1">
        {online.map((m, i) => (
          <PresenceRow key={'on' + i} name={m.name} initials={m.initials} from={m.from} to={m.to} online />
        ))}
        {offline.length > 0 && (
          <>
            <div className="mt-2 px-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
              Offline
            </div>
            {offline.slice(0, 3).map((m, i) => (
              <PresenceRow key={'off' + i} name={m.name} initials={m.initials} from={m.from} to={m.to} />
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}

function PresenceRow({
  name,
  initials,
  from,
  to,
  online,
}: {
  name: string;
  initials: string;
  from: string;
  to: string;
  online?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] px-1.5 py-1 transition-colors duration-150 hover:bg-white/[0.04]">
      <div className="relative">
        <Avatar initials={initials} from={from} to={to} size={22} />
        {online && (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#0e0f12] bg-[#5ee08a]"
            aria-label="online"
          />
        )}
      </div>
      <span className={`truncate text-[12px] leading-tight ${online ? 'text-ink-50' : 'text-ink-300'}`}>
        {name}
      </span>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07L11 5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07L13 19" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}
