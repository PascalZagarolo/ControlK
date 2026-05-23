import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicWorkspaceBySlug } from '@/lib/db/queries/workspace';
import { BookingForm } from './booking-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getPublicWorkspaceBySlug(slug);
  if (!ws) notFound();
  if (ws.scope === 'private') notFound();

  const tint = `linear-gradient(140deg, ${ws.from}22 0%, ${ws.to}08 50%, transparent 100%)`;

  return (
    <div className="relative min-h-screen bg-ink-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[400px]"
        style={{ background: tint }}
      />
      <div className="relative mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pb-32 pt-16 md:px-6">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          <Link href={`/w/${ws.slug}`} className="hover:text-ink-50">
            ← {ws.name}
          </Link>
          <span className="opacity-50">·</span>
          <span>Termin buchen</span>
        </div>
        <header className="flex flex-col gap-2">
          <h1 className="text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
            Termin buchen
          </h1>
          <p className="text-[14px] leading-[1.55] text-ink-300">
            Sag uns kurz worum es geht — {ws.ownerName ?? 'der Workspace-Owner'} meldet
            sich zur Bestätigung.
          </p>
        </header>

        <BookingForm slug={ws.slug} />

        <footer className="mt-4 border-t border-white/[0.06] pt-4 text-center text-[10.5px] text-ink-300">
          Powered by uRent · public booking
        </footer>
      </div>
    </div>
  );
}
