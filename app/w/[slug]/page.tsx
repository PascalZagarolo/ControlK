import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, and, count } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { getPublicWorkspaceBySlug } from '@/lib/db/queries/workspace';
import { Avatar } from '@/components/channel/avatar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PublicHub({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getPublicWorkspaceBySlug(slug);
  if (!ws) notFound();

  const db = getDb();
  const [todoCount, channelCount, contractCount, vehicleCount, eventCount] = await Promise.all([
    db
      .select({ n: count() })
      .from(s.todos)
      .where(eq(s.todos.workspaceId, ws.id)),
    db
      .select({ n: count() })
      .from(s.channels)
      .where(eq(s.channels.workspaceId, ws.id)),
    db
      .select({ n: count() })
      .from(s.contracts)
      .where(eq(s.contracts.workspaceId, ws.id)),
    db
      .select({ n: count() })
      .from(s.vehicles)
      .where(eq(s.vehicles.workspaceId, ws.id)),
    db
      .select({ n: count() })
      .from(s.calendarEvents)
      .where(eq(s.calendarEvents.workspaceId, ws.id)),
  ]);

  const tint = `linear-gradient(140deg, ${ws.from}22 0%, ${ws.to}08 50%, transparent 100%)`;

  return (
    <div className="relative min-h-screen bg-ink-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[400px]"
        style={{ background: tint }}
      />
      <div className="relative mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-32 pt-16 md:px-6">
        <header className="flex flex-col gap-4">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            <Link href="/" className="hover:text-ink-50">
              uRent
            </Link>
            <span className="opacity-50">·</span>
            <Link href="/workspaces/discover" className="hover:text-ink-50">
              Discover
            </Link>
            <span className="opacity-50">·</span>
            <span>Public Workspace</span>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            {ws.iconEmoji ? (
              <span className="flex h-16 w-16 items-center justify-center rounded-[14px] bg-white/[0.04] text-[32px]">
                {ws.iconEmoji}
              </span>
            ) : (
              <Avatar initials={ws.short} from={ws.from} to={ws.to} size={64} />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.4px] text-ink-50">
                {ws.name}
              </h1>
              {ws.ownerName && (
                <p className="mt-1 text-[13px] text-ink-300">von {ws.ownerName}</p>
              )}
            </div>
          </div>

          {ws.description && (
            <p className="text-[14px] leading-[1.55] text-ink-200">{ws.description}</p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Member" value={String(ws.memberCount ?? 0)} />
            <Stat label="Todos" value={String(todoCount[0]?.n ?? 0)} />
            <Stat label="Channels" value={String(channelCount[0]?.n ?? 0)} />
            <Stat label="Events" value={String(eventCount[0]?.n ?? 0)} />
          </div>
        </header>

        <section className="flex flex-col gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Was hier verfügbar ist
          </p>
          <div className="flex flex-wrap gap-2">
            {(contractCount[0]?.n ?? 0) > 0 && (
              <Chip label={`${contractCount[0]?.n} Verträge`} color="#ffd96a" />
            )}
            {(vehicleCount[0]?.n ?? 0) > 0 && (
              <Chip label={`${vehicleCount[0]?.n} Fahrzeuge`} color="#c084fc" />
            )}
            {(channelCount[0]?.n ?? 0) > 0 && (
              <Chip label={`${channelCount[0]?.n} Channels`} color="#5eb6ff" />
            )}
            {(todoCount[0]?.n ?? 0) > 0 && (
              <Chip label={`${todoCount[0]?.n} Todos`} color="#5ee08a" />
            )}
          </div>
        </section>

        <section className="flex flex-col items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <p className="text-[14px] text-ink-100">
            Möchtest du diesen Workspace betreten?
          </p>
          <p className="text-[11.5px] leading-[1.55] text-ink-300">
            Frag den Owner nach einem Invite-Link — Public-Workspaces sind sichtbar, aber Membership ist invite-only.
          </p>
          <Link
            href="/sign-in"
            className="rounded-full bg-white px-4 py-2 text-[12.5px] font-medium leading-none text-black hover:bg-white/90"
          >
            Bei uRent anmelden
          </Link>
        </section>

        <footer className="mt-8 border-t border-white/[0.06] pt-6 text-center text-[11px] text-ink-300">
          Public Workspace · uRent ·{' '}
          <Link href="/" className="text-ink-100 hover:text-ink-50">
            zur Hauptseite
          </Link>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">{label}</p>
      <p className="mt-0.5 font-mono text-[18px] tabular-nums text-ink-50">{value}</p>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex h-6 items-center gap-1 rounded-full px-2.5 font-mono text-[10px] uppercase tracking-[0.3px]"
      style={{ background: `${color}1f`, color }}
    >
      {label}
    </span>
  );
}
