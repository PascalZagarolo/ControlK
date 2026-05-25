import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getPersonProfile } from '@/lib/db/queries/person-profile';
import { PersonTimeline } from './person-timeline';
import { PersonRail } from './person-rail';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function Page({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email: rawParam } = await params;
  const email = decodeURIComponent(rawParam).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) notFound();

  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/people/${encodeURIComponent(email)}`);
  const ws = await requireCurrentWorkspace();

  const profile = await getPersonProfile(ws.id, user.id, email);

  // If there's truly nothing — no emails AND no customer match — it's
  // either a stale link or an address we've never seen. Render an
  // empty profile instead of 404; the user might want to seed a
  // contact from here later.

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-32 pt-24 md:px-6">
      <Link
        href="/inbox"
        className="mb-6 inline-flex items-center gap-1 text-[13px] text-[#A1A1AA] transition-colors hover:text-[#FAFAFA]"
      >
        <span aria-hidden>←</span>
        <span>Inbox</span>
      </Link>

      <ProfileHeader profile={profile} />

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <main className="min-w-0 flex-1">
          <PersonTimeline emails={profile.emails} />
        </main>
        <aside className="w-full shrink-0 lg:w-[320px]">
          <PersonRail
            customer={profile.customer}
            todos={profile.todos}
            notes={profile.notes}
          />
        </aside>
      </div>
    </div>
  );
}

function ProfileHeader({
  profile,
}: {
  profile: Awaited<ReturnType<typeof getPersonProfile>>;
}) {
  const { customer, displayName, email, stats } = profile;
  const initials = customer
    ? customer.initials
    : initialsFromName(displayName || email);

  return (
    <header className="flex flex-col gap-5 border-b border-[#1F1F23] pb-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[15px] font-medium leading-none text-white"
          style={
            customer
              ? {
                  background: `linear-gradient(135deg, ${customer.fromColor}, ${customer.toColor})`,
                }
              : { background: 'rgba(255,255,255,0.06)' }
          }
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-[24px] font-medium leading-tight tracking-[-0.015em] text-[#FAFAFA]">
              {displayName}
            </h1>
            {customer && (
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-300">
                {customer.status}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-ink-300">
            <a
              href={`mailto:${email}`}
              className="hover:text-ink-100"
            >
              {email}
            </a>
            {customer?.contactRole && (
              <>
                <span aria-hidden className="mx-2 text-ink-400">·</span>
                <span>{customer.contactRole}</span>
              </>
            )}
            {customer && (
              <>
                <span aria-hidden className="mx-2 text-ink-400">·</span>
                <Link
                  href={`/kunden/${customer.id}`}
                  className="text-ink-200 underline decoration-white/20 underline-offset-2 hover:text-ink-50"
                >
                  Kunden-Detail
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 text-[12.5px]">
        <Stat label="Mails insgesamt" value={String(stats.totalMessages)} />
        <Stat
          label="Ungelesen von ihnen"
          value={String(stats.unreadFromThem)}
          accent={stats.unreadFromThem > 0 ? '#E8B86D' : undefined}
        />
        <Stat
          label="Du wartest auf Antwort"
          value={String(stats.awaitingFromYou)}
          accent={stats.awaitingFromYou > 0 ? '#E8B86D' : undefined}
        />
        <Stat
          label="Letzter Kontakt"
          value={
            stats.lastTouchpointAt
              ? formatRel(stats.lastTouchpointAt)
              : 'noch nie'
          }
        />
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col">
      <span
        className="text-[18px] font-medium leading-tight"
        style={{ color: accent ?? '#FAFAFA' }}
      >
        {value}
      </span>
      <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-300">
        {label}
      </span>
    </div>
  );
}

function initialsFromName(value: string): string {
  const parts = value.trim().split(/[\s.@]+/).filter(Boolean);
  return (
    ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? ''))
      .toUpperCase()
      .slice(0, 2)
  );
}

function formatRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 60) return `vor ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h}h`;
  const d = Math.round(h / 24);
  if (d < 14) return `vor ${d}d`;
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
