import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { getAISettingsSummary } from '@/lib/actions/user-settings';
import { AIKeyForm } from './ai-key-form';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/settings/ai');
  const summary = await getAISettingsSummary();

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 pb-32 pt-28 md:px-6">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        <Link href="/settings/account" className="hover:text-ink-50">
          ← Settings
        </Link>
        <span className="opacity-50">·</span>
        <span>AI</span>
      </div>

      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          BYOK · Bring your own key
        </span>
        <h1 className="mt-1 text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
          AI-Schlüssel verwalten
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-200">
          Du kannst deinen eigenen OpenAI-Key hinterlegen — dann gehen alle
          AI-Calls direkt an dein OpenAI-Konto, ohne Limit und ohne Vercel-
          Gateway-Markup. Der Key wird mit AES-256-GCM verschlüsselt
          gespeichert und nur server-seitig entschlüsselt.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Status
        </span>
        <ul className="flex flex-col gap-1.5 text-[12.5px]">
          <li>
            {summary.hasUserKey ? (
              <span className="text-[#5ee08a]">✓ Eigener OpenAI-Key hinterlegt</span>
            ) : (
              <span className="text-ink-300">∅ Kein eigener Key gespeichert</span>
            )}
          </li>
          <li>
            {summary.serverKeyConfigured ? (
              <span className="text-ink-200">
                ✓ Server-Fallback aktiv (AI_GATEWAY_API_KEY oder OPENAI_API_KEY gesetzt)
              </span>
            ) : (
              <span className="text-[#ff8a8a]">
                ! Kein Server-Fallback — ohne eigenen Key gibt es keine AI.
              </span>
            )}
          </li>
          <li>
            {summary.encryptionConfigured ? (
              <span className="text-ink-200">✓ Verschlüsselung konfiguriert</span>
            ) : (
              <span className="text-[#ff8a8a]">
                ! APP_ENCRYPTION_KEY fehlt — BYOK speichert nicht.
              </span>
            )}
          </li>
        </ul>
      </section>

      <AIKeyForm
        hasKey={summary.hasUserKey}
        preferredModel={summary.preferredModel}
        canSave={summary.encryptionConfigured}
      />

      <section className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-5 text-[12px] leading-[1.55] text-ink-300">
        <p className="font-medium text-ink-100">Wie wir das speichern</p>
        <p className="mt-2">
          Der Schlüssel wird mit AES-256-GCM verschlüsselt und in der Datenbank
          abgelegt. Der Master-Key kommt aus der ENV-Variable
          <code className="ml-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-ink-100">
            APP_ENCRYPTION_KEY
          </code>
          . Wer den hat, kann theoretisch entschlüsseln — sprich: das ist ein
          Server-Operator-Risiko, kein Drittparteien-Risiko. Du kannst den Key
          jederzeit löschen — die Verschlüsselung ist nicht reversibel bei
          Verlust des Master-Keys.
        </p>
      </section>
    </div>
  );
}
