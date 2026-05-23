import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getWorkspacePlan } from '@/lib/billing/gate';
import { PLANS, priceLabel, type PlanTier } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/settings/billing');
  const ws = await requireCurrentWorkspace();
  const currentPlan = await getWorkspacePlan(ws.id);
  const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-8 px-4 pb-32 pt-28 md:px-6">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        <Link href="/settings/account" className="hover:text-ink-50">
          ← Settings
        </Link>
        <span className="opacity-50">·</span>
        <span>Billing</span>
      </div>

      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Plan & Abrechnung
        </span>
        <h1 className="mt-1 text-[28px] font-medium leading-[1.15] tracking-[-0.3px] text-ink-50">
          {ws.name} ist auf{' '}
          <span className="text-[#5eb6ff]">{PLANS[currentPlan].name}</span>.
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-200">
          Faires Pricing — kein Feature-Gating von Permissions oder API. Nur
          Quotas. Ehrlich.
        </p>
        {!stripeEnabled && (
          <p className="mt-3 rounded-[8px] border border-[#ffd96a]/25 bg-[#ffd96a]/[0.05] px-3 py-2 text-[12px] text-[#ffd96a]">
            Stripe noch nicht konfiguriert — STRIPE_SECRET_KEY und Price-IDs
            fehlen. Upgrade-Buttons sind deaktiviert.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['free', 'solo', 'team'] as PlanTier[]).map((key) => {
          const plan = PLANS[key];
          const isCurrent = key === currentPlan;
          return (
            <div
              key={key}
              className={`flex flex-col gap-3 rounded-[14px] border p-4 ${
                isCurrent
                  ? 'border-[#5eb6ff]/45 bg-[#5eb6ff]/[0.06]'
                  : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              <div>
                <p className="text-[16px] font-medium text-ink-50">{plan.name}</p>
                <p className="text-[11.5px] text-ink-300">{plan.tagline}</p>
                <p className="mt-2 font-mono text-[12px] text-ink-100">
                  {priceLabel(plan)}
                </p>
              </div>
              <ul className="flex flex-col gap-1 text-[11.5px] text-ink-200">
                <li>
                  {plan.features.maxWorkspaces === 0
                    ? 'Workspaces unbegrenzt'
                    : `${plan.features.maxWorkspaces} Workspaces`}
                </li>
                <li>
                  {plan.features.maxNotes === 0
                    ? 'Notes unbegrenzt'
                    : `${plan.features.maxNotes} Notes`}
                </li>
                <li>{(plan.features.monthlyAiTokens / 1000).toFixed(0)}k AI-Tokens / Monat</li>
                <li>{plan.features.maxStorageMb} MB Storage</li>
                {plan.features.supportsTeamMembers && <li>Team-Members + Roles</li>}
                {plan.features.euHostingGuaranteed && <li>EU-Hosting (Frankfurt)</li>}
                {plan.features.prioritySupport && <li>Priority-Support</li>}
              </ul>
              <div className="mt-auto pt-2">
                {isCurrent ? (
                  <span className="inline-block rounded-full bg-[#5eb6ff]/[0.12] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-[#5eb6ff]">
                    Aktiver Plan
                  </span>
                ) : stripeEnabled ? (
                  <button
                    type="button"
                    disabled
                    className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium leading-none text-black disabled:opacity-50"
                    title="Stripe-Integration wird in Sprint I.2 aktiviert"
                  >
                    Upgrade auf {plan.name}
                  </button>
                ) : (
                  <span className="font-mono text-[10px] text-ink-300">
                    Stripe nicht konfiguriert
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-5 text-[12px] leading-[1.55] text-ink-300">
        <p className="font-medium text-ink-100">Was wir nicht hinter Paywall stecken</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Permissions — Row-Level / Field-Level immer voll</li>
          <li>Public API + Webhooks — sobald implementiert, alle Pläne</li>
          <li>EU-Hosting — auch im Free-Tier</li>
          <li>BYOK AI — kein Markup, eigene OpenAI-Kosten</li>
        </ul>
      </section>
    </div>
  );
}
