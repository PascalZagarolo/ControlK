import { redirect } from 'next/navigation';
import { Headline } from '@/components/ui/headline';
import { Panel } from '@/components/ui/panel';
import { currentUser } from '@/lib/auth/current-user';
import { DeleteAccountForm, ExportTrigger } from '@/components/auth/account-tools';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/settings/account');

  return (
    <div className="mx-auto w-full max-w-[760px] px-6 pb-32 pt-28">
      <Headline
        kicker="Einstellungen"
        title="Konto"
        subtitle="Daten-Export und Konto-Löschung — GDPR-konform."
      />

      <div className="mt-10 flex flex-col gap-4">
        <Panel label="Profil">
          <dl className="flex flex-col gap-3">
            <Row label="Name">{user.name}</Row>
            <Row label="E-Mail">
              <span className="font-mono">{user.email}</span>
              {!user.emailVerified && (
                <span className="ml-2 rounded-full bg-[#ffd96a]/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.3px] text-[#ffd96a]">
                  unverifiziert
                </span>
              )}
            </Row>
          </dl>
        </Panel>

        <Panel label="Daten-Export (Art. 20 DSGVO)">
          <p className="mb-3 text-[13px] leading-[1.55] text-ink-200">
            Exportiere alle Daten deines Kontos als JSON. Enthält Profil, Workspace-Mitgliedschaften,
            Nachrichten und Benachrichtigungen.
          </p>
          <ExportTrigger />
        </Panel>

        <Panel label="Konto löschen (Art. 17 DSGVO)">
          <DeleteAccountForm />
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">{label}</dt>
      <dd className="text-[13px] text-ink-50">{children}</dd>
    </div>
  );
}
