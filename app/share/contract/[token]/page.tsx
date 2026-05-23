import { notFound } from 'next/navigation';
import Link from 'next/link';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { ContractSignBlock } from '@/components/contracts/contract-sign-block';
import { STATUS_META } from '@/components/contracts/status-pill';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function fmtEur(cents?: number | null) {
  if (cents == null) return '—';
  return `€${(cents / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
}

export default async function PublicContractPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();

  const link = await db.query.contractShareLinks.findFirst({
    where: and(
      eq(s.contractShareLinks.token, token),
      or(isNull(s.contractShareLinks.expiresAt), gt(s.contractShareLinks.expiresAt, new Date()))!
    ),
    with: {
      contract: {
        with: {
          customer: true,
          vehicle: true,
        },
      },
      createdBy: true,
    },
  });
  if (!link) notFound();

  await db
    .update(s.contractShareLinks)
    .set({
      viewCount: sql`${s.contractShareLinks.viewCount} + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(s.contractShareLinks.id, link.id));

  const c = link.contract as any;
  const meta = STATUS_META[c.status as keyof typeof STATUS_META];

  return (
    <div className="min-h-screen bg-ink-900">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 pb-32 pt-16 md:px-6">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            <Link href="/" className="hover:text-ink-50">
              uRent
            </Link>
            <span className="opacity-50">·</span>
            <span>Vertrag</span>
            {link.expiresAt && (
              <>
                <span className="opacity-50">·</span>
                <span>bis {new Date(link.expiresAt).toLocaleDateString('de-DE')}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-[12px] text-[24px]"
              style={{ background: `${meta.color}1f`, color: meta.color }}
            >
              §
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex h-5 items-center gap-1 rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
                  style={{ background: `${meta.color}1f`, color: meta.color }}
                >
                  {meta.label}
                </span>
                {c.acceptedAt && (
                  <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[#5ee08a]/[0.15] px-2 font-mono text-[10px] uppercase tracking-[0.3px] text-[#5ee08a]">
                    ✓ Akzeptiert
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-[30px] font-medium leading-[1.1] tracking-[-0.4px] text-ink-50">
                {c.title}
              </h1>
              {c.customer?.name && (
                <p className="mt-1 text-[13px] text-ink-300">◉ {c.customer.name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Kpi label="Wert" value={fmtEur(c.valueCents)} />
            <Kpi
              label="Start"
              value={c.startsAt ? new Date(c.startsAt).toLocaleDateString('de-DE') : '—'}
            />
            <Kpi
              label="Ende"
              value={c.endsAt ? new Date(c.endsAt).toLocaleDateString('de-DE') : '—'}
            />
          </div>
        </header>

        {c.vehicle?.plate && (
          <section>
            <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
              Fahrzeug
            </h2>
            <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <p className="font-mono text-[14px] font-medium text-ink-50">{c.vehicle.plate}</p>
              <p className="mt-0.5 text-[12px] text-ink-300">{c.vehicle.model}</p>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-6">
          {(c.body ?? []).length === 0 ? (
            <p className="text-[12.5px] text-ink-300">— Kein Vertragstext —</p>
          ) : (
            (c.body as any[]).map((section, i) => (
              <div key={i}>
                <h3 className="mb-2 text-[16px] font-medium tracking-[-0.2px] text-ink-50">
                  {section.heading}
                </h3>
                <div className="flex flex-col gap-2 text-[13.5px] leading-[1.6] text-ink-200">
                  {section.paragraphs.map((p: string, j: number) => (
                    <p key={j} className="whitespace-pre-line">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        {link.allowSignature === 1 && (
          <ContractSignBlock
            contractId={c.id}
            shareToken={token}
            alreadySigned={!!c.acceptedAt}
            signedName={c.acceptedByName ?? undefined}
            signedAt={c.acceptedAt?.toISOString()}
          />
        )}

        <footer className="mt-8 border-t border-white/[0.06] pt-6 text-center text-[11px] text-ink-300">
          Read-only Vertrag · von <span className="text-ink-100">{link.createdBy?.name ?? '—'}</span> geteilt ·{' '}
          <Link href="/" className="text-ink-100 hover:text-ink-50">
            uRent
          </Link>
        </footer>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">{label}</p>
      <p className="mt-0.5 font-mono text-[15px] tabular-nums text-ink-50">{value}</p>
    </div>
  );
}
