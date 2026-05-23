import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { Avatar } from '@/components/channel/avatar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PublicChannelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const link = await db.query.channelShareLinks.findFirst({
    where: and(
      eq(s.channelShareLinks.token, token),
      or(isNull(s.channelShareLinks.expiresAt), gt(s.channelShareLinks.expiresAt, new Date()))!
    ),
    with: { channel: true, createdBy: true },
  });
  if (!link) notFound();

  await db
    .update(s.channelShareLinks)
    .set({
      viewCount: sql`${s.channelShareLinks.viewCount} + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(s.channelShareLinks.id, link.id));

  const channel = link.channel as any;
  const onlyPins = link.onlyAnnouncements === 1;

  const [pins, messages] = await Promise.all([
    db.query.channelPinnedItems.findMany({
      where: eq(s.channelPinnedItems.channelId, channel.id),
      orderBy: [asc(s.channelPinnedItems.position)],
    }),
    onlyPins
      ? Promise.resolve([] as any[])
      : db.query.messages.findMany({
          where: and(eq(s.messages.channelId, channel.id), isNull(s.messages.parentId)),
          orderBy: [desc(s.messages.createdAt)],
          limit: 50,
          with: { author: true },
        }),
  ]);

  return (
    <div className="min-h-screen bg-ink-900">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-32 pt-16 md:px-6">
        <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            <Link href="/" className="hover:text-ink-50">
              uRent
            </Link>
            <span className="opacity-50">·</span>
            <span>Channel</span>
            {link.expiresAt && (
              <>
                <span className="opacity-50">·</span>
                <span>bis {new Date(link.expiresAt).toLocaleDateString('de-DE')}</span>
              </>
            )}
          </div>
          <h1 className="text-[32px] font-medium leading-[1.1] tracking-[-0.4px] text-ink-50">
            <span className="text-ink-300">#</span>
            {channel.name}
          </h1>
          {channel.topic && (
            <p className="text-[13.5px] leading-[1.55] text-ink-200">{channel.topic}</p>
          )}
          <p className="font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
            Read-only · geteilt von {link.createdBy?.name ?? '—'}
            {onlyPins && ' · nur Pins'}
          </p>
        </header>

        {pins.length > 0 && (
          <section>
            <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              Pinned · {pins.length}
            </h2>
            <div className="flex flex-col gap-1.5">
              {pins.map((p: any) => (
                <div
                  key={p.id}
                  className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                    {p.kind}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-50">{p.label}</p>
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block font-mono text-[10.5px] text-[#5eb6ff] hover:underline"
                    >
                      {p.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {!onlyPins && messages.length > 0 && (
          <section>
            <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              Letzte Nachrichten · {messages.length}
            </h2>
            <div className="flex flex-col gap-4">
              {messages.reverse().map((m: any) => (
                <div key={m.id} className="flex gap-3">
                  <Avatar
                    initials={m.author?.initials ?? '?'}
                    from={m.author?.avatarFrom ?? '#5eb6ff'}
                    to={m.author?.avatarTo ?? '#0369a1'}
                    size={28}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-ink-50">
                        {m.author?.name ?? 'Unbekannt'}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                        {new Date(m.createdAt).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[13.5px] leading-[1.6] text-ink-200">
                      {m.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {pins.length === 0 && messages.length === 0 && (
          <div className="rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.01] py-12 text-center text-[13px] text-ink-300">
            Channel ist noch leer.
          </div>
        )}

        <footer className="mt-8 border-t border-white/[0.06] pt-6 text-center text-[11px] text-ink-300">
          Read-only · uRent ·{' '}
          <Link href="/" className="text-ink-100 hover:text-ink-50">
            zur Hauptseite
          </Link>
        </footer>
      </div>
    </div>
  );
}
