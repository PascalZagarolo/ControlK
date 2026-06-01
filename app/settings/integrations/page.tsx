import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import {
  INTEGRATIONS,
  isIntegrationConfigured,
  type IntegrationMeta,
} from '@/lib/integrations/registry';
import { getGoogleConnection } from '@/lib/auth/google-tokens';
import { GmailConnection } from './gmail-connection';
import { CalendarConnection } from './calendar-connection';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/settings/integrations');

  const googleConnection = await getGoogleConnection(user.id);

  const items = INTEGRATIONS.map((meta) => ({
    meta,
    configured: isIntegrationConfigured(meta.key),
  }));

  const groups = {
    calendar: items.filter((i) => i.meta.category === 'calendar'),
    chat: items.filter((i) => i.meta.category === 'chat'),
    dev: items.filter((i) => i.meta.category === 'dev'),
    project: items.filter((i) => i.meta.category === 'project'),
  };

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-4 pb-32 pt-28 md:px-6">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        <Link href="/settings/account" className="hover:text-ink-50">
          ← Settings
        </Link>
        <span className="opacity-50">·</span>
        <span>Integrationen</span>
      </div>

      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Native Integrationen
        </span>
        <h1 className="mt-1 text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
          Tiefe Integrationen, kein Zapier.
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-200">
          uRent baut nativ in deine wichtigsten externen Tools — Two-Way-Sync
          statt generischer Webhooks. Aktuell stehen die Slots; die einzelnen
          Integrationen werden sequenziell aktiviert (Roadmap in{' '}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-ink-100">
            ARCHITECTURE.md
          </code>
          , Sprint G).
        </p>
      </div>

      <GmailConnection connection={googleConnection} />
      <CalendarConnection connection={googleConnection} />

      {(['calendar', 'chat', 'dev', 'project'] as const).map((cat) => (
        <section key={cat} className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.4px] text-ink-300">
            {cat === 'calendar'
              ? 'Kalender'
              : cat === 'chat'
                ? 'Chat'
                : cat === 'dev'
                  ? 'Developer'
                  : 'Projekt-Tools'}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {groups[cat].map(({ meta, configured }) => (
              <Card key={meta.key} meta={meta} configured={configured} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Card({ meta, configured }: { meta: IntegrationMeta; configured: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.04] text-[20px]">
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium leading-tight text-ink-50">{meta.label}</p>
          <p className="mt-0.5 text-[11.5px] leading-[1.5] text-ink-300">{meta.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {meta.ready ? (
          configured ? (
            <Link
              href={`/api/integrations/${meta.key}/connect`}
              className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium leading-none text-black hover:bg-white/90"
            >
              Verbinden
            </Link>
          ) : (
            <span className="rounded-full border border-[#ffd96a]/30 bg-[#ffd96a]/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.3px] text-[#ffd96a]">
              ENV-Vars fehlen
            </span>
          )
        ) : (
          <span className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            Demnächst
          </span>
        )}
        {meta.envHints && (
          <span
            className="font-mono text-[10px] text-ink-300"
            title={meta.envHints.join('\n')}
          >
            {meta.envHints.length} env vars
          </span>
        )}
      </div>
    </div>
  );
}
