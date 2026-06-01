import {
  type BillingPeriod,
  type Feature,
  type Tier,
  priceView,
} from '@/lib/pricing';
import { CTA } from '@/components/marketing/primitives';

/** Crisp inline tick — indigo when included, dimmed for the muted line. */
function Tick({ muted }: { muted?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={`mt-0.5 shrink-0 ${muted ? 'text-ink-500' : 'text-accent'}`}
    >
      <path
        d="M2.5 7.5L5.5 10.5L11.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeatureRow({ feature }: { feature: Feature }) {
  return (
    <li className="flex gap-2.5 py-[5px]">
      <Tick muted={feature.muted} />
      <span
        className={`text-[14px] leading-[1.5] ${
          feature.muted ? 'text-ink-300' : 'text-ink-200'
        }`}
      >
        {feature.text}
      </span>
    </li>
  );
}

/**
 * Eine Pricing-Tier-Card. Rein präsentational — der Billing-Zeitraum kommt
 * von außen, damit der Preis auf den Toggle reagiert. Card-Chrome spiegelt
 * den Landing-Standard (rounded-2xl, accent-soft für den Highlight).
 */
export function PricingCard({
  tier,
  period,
}: {
  tier: Tier;
  period: BillingPeriod;
}) {
  const price = priceView(tier, period);
  const highlighted = !!tier.highlighted;

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 sm:p-7 ${
        highlighted
          ? 'border-accent/30 bg-accent-soft'
          : 'border-white/[0.07] bg-white/[0.015]'
      }`}
    >
      {highlighted && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-16 mx-auto h-40 max-w-[280px]"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 0%, rgba(139,127,255,0.18) 0%, rgba(139,127,255,0) 70%)',
          }}
        />
      )}

      {/* Header: name + the single yellow badge */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[19px] font-medium text-ink-50">{tier.name}</h3>
        {tier.badge && (
          <span className="shrink-0 rounded-full border border-accent-yellow/30 bg-accent-yellow/10 px-2.5 py-0.5 text-[11px] font-medium tracking-[0.01em] text-accent-yellow">
            {tier.badge}
          </span>
        )}
      </div>

      <p className="mt-2 text-[13.5px] leading-[1.5] text-ink-300">{tier.tagline}</p>

      {/* Price */}
      <div className="mt-6">
        <div className="flex flex-wrap items-baseline gap-1.5">
          <span className="font-display text-[40px] font-semibold leading-none tracking-[-0.02em] text-ink-50">
            {price.amount}
          </span>
          {price.unit && <span className="text-[14px] text-ink-300">{price.unit}</span>}
        </div>
        <div className="mt-2 min-h-[17px]">
          {price.caption && (
            <span className="text-[12.5px] text-ink-300">{price.caption}</span>
          )}
        </div>
      </div>

      {/* Founder-price note — a real grandfathering promise, no countdown */}
      {tier.founder && (
        <p className="mt-4 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2.5 text-[12px] leading-[1.5] text-ink-200">
          <span className="font-medium text-accent">Gründerpreis</span> — für Early
          Adopters dauerhaft gelockt. Späterer Regulärpreis: {tier.founder.regular} €.
        </p>
      )}

      {/* Features */}
      <div className="mt-6 border-t border-white/[0.07] pt-5">
        {tier.inheritsLabel && (
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-300">
            {tier.inheritsLabel}
          </p>
        )}
        <ul className="flex flex-col">
          {tier.features.map((f) => (
            <FeatureRow key={f.text} feature={f} />
          ))}
        </ul>
      </div>

      {/* Spacer pins the CTA to the bottom across equal-height cards */}
      <div className="grow" />

      <div className="mt-7">
        <CTA
          href={tier.cta.href}
          variant={highlighted ? 'primary' : 'ghost'}
          className="w-full"
        >
          {tier.cta.label}
        </CTA>
      </div>
    </div>
  );
}
