import Link from 'next/link';
import { listPublicWorkspaces } from '@/lib/db/queries/workspace';
import { Avatar } from '@/components/channel/avatar';
import { Headline, MetaTag } from '@/components/ui/headline';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const workspaces = await listPublicWorkspaces();

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 pb-32 pt-28 md:px-6">
      <Headline
        kicker="Discover"
        title="Public Workspaces"
        subtitle="Öffentliche Workspaces — als Inspiration oder Demo. Klicken öffnet die Public-Hub-Seite."
        meta={<MetaTag highlight>{workspaces.length} verfügbar</MetaTag>}
      />

      {workspaces.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-white/[0.10] bg-white/[0.01] py-16 text-center">
          <p className="text-[14px] text-ink-300">Noch keine Public-Workspaces.</p>
          <p className="mt-1 text-[12px] text-ink-300">
            Du kannst deinen eigenen Workspace in den Settings auf „public" stellen.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <Link
              key={w.id}
              href={`/w/${w.slug}`}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
                style={{
                  background: `linear-gradient(90deg, ${w.from} 0%, ${w.to}66 60%, transparent 100%)`,
                }}
              />
              <div className="flex items-start gap-3">
                {w.iconEmoji ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/[0.04] text-[20px]">
                    {w.iconEmoji}
                  </span>
                ) : (
                  <Avatar initials={w.short} from={w.from} to={w.to} size={40} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium leading-tight text-ink-50">
                    {w.name}
                  </p>
                  {w.ownerName && (
                    <p className="mt-0.5 text-[11.5px] text-ink-300">
                      von {w.ownerName}
                    </p>
                  )}
                </div>
              </div>
              {w.description && (
                <p className="line-clamp-3 text-[12px] leading-[1.5] text-ink-300">
                  {w.description}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                <span>{w.memberCount ?? 0} Member</span>
                {w.template && <span>{w.template}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
