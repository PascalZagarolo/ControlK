import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Headline, MetaTag } from '@/components/ui/headline';
import { Panel } from '@/components/ui/panel';
import { TwoFactorSetup } from '@/components/auth/two-factor-setup';
import { currentUser } from '@/lib/auth/current-user';
import { listUserSessions } from '@/lib/auth/sessions';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/settings/security');

  const sessions = await listUserSessions(user.id);

  return (
    <div className="mx-auto w-full max-w-[760px] px-6 pb-32 pt-28">
      <Headline
        kicker="Einstellungen"
        title="Sicherheit"
        subtitle="Zwei-Faktor, aktive Sitzungen und Wiederherstellung."
        meta={
          <>
            <MetaTag highlight={user.totpEnabled}>
              2FA: {user.totpEnabled ? 'aktiv' : 'inaktiv'}
            </MetaTag>
          </>
        }
      />

      <div className="mt-10 flex flex-col gap-4">
        <Panel label="Zwei-Faktor-Authentifizierung">
          <TwoFactorSetup enabled={user.totpEnabled} />
        </Panel>

        <Panel label={`Aktive Sitzungen · ${sessions.length}`}>
          <ul className="flex flex-col gap-2.5">
            {sessions.map((sess) => (
              <li
                key={sess.id}
                className="rounded-[10px] border border-white/[0.04] bg-white/[0.02] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium leading-tight text-ink-50">
                      {parseUA(sess.userAgent) ?? 'Unbekanntes Gerät'}
                    </div>
                    <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
                      {sess.ipAddress ?? '—'}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] text-ink-300">
                    bis {sess.expiresAt.toLocaleDateString('de-DE')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel label="Konto">
          <div className="flex flex-col gap-2">
            <Link
              href="/settings/account"
              className="text-[13px] text-ink-50 transition-colors hover:text-[#5eb6ff]"
            >
              Konto-Einstellungen, Daten-Export & Löschung →
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function parseUA(ua: string | null): string | null {
  if (!ua) return null;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return ua.split(' ')[0];
}
