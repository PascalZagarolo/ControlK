/**
 * Pricing — single source of truth for the /pricing page.
 *
 * Every price, tier, feature line, comparison cell, and FAQ entry lives
 * here so the page components stay dumb and the numbers move in one edit.
 * The deliberate design choice is FLAT, predictable pricing — no usage
 * metering, no AI credits, no add-ons except "more mailboxes / more seats"
 * as a value upgrade. Keep it that way.
 *
 * Founder-price mechanic: Solo is 29 € today and grandfathered for early
 * adopters. When the regular price kicks in, bump `solo.price.monthly` to
 * 39 and (optionally) drop `solo.founder`. That's the only edit needed —
 * the card, the comparison header, and the FAQ all read from here.
 */

export type BillingPeriod = 'monthly' | 'yearly';

export type TierId = 'free' | 'solo' | 'team';

export interface TierPrice {
  /** Base monthly price in EUR. 0 for Free. */
  monthly: number;
  /** Charged per seat (Team) — affects unit label + annual caption. */
  perSeat?: boolean;
}

export interface Feature {
  text: string;
  /**
   * De-emphasised line. Used for the AI mention on Solo, which the brief
   * wants as a quiet "und außerdem", never the headline value.
   */
  muted?: boolean;
}

export interface FounderNote {
  /** Regular price after the founder window (today's price is price.monthly). */
  regular: number;
}

export interface Tier {
  id: TierId;
  name: string;
  /** One-line positioning under the tier name. */
  tagline: string;
  price: TierPrice;
  /** The single highlighted tier (Solo): ring + glow, first on mobile. */
  highlighted?: boolean;
  /** The one yellow badge on the whole page, e.g. "Beliebt". */
  badge?: string;
  /** Grandfathering note rendered under the price (Solo only). */
  founder?: FounderNote;
  /** Lead line above the feature list, e.g. "Alles aus Free, plus:". */
  inheritsLabel?: string;
  features: Feature[];
  cta: TierCta;
}

export interface TierCta {
  label: string;
  /** Internal route (/sign-up) or a mailto: draft for the Team contact CTA. */
  href: string;
}

/** Two months free on annual billing → pay for 10, get 12. */
export const YEARLY_FREE_MONTHS = 2;
export const MONTHS_PER_YEAR = 12;
export const YEARLY_PAID_MONTHS = MONTHS_PER_YEAR - YEARLY_FREE_MONTHS; // 10

/** Annual total = monthly × 10 (two months free). */
export function annualTotal(monthly: number): number {
  return monthly * YEARLY_PAID_MONTHS;
}

/** Per-month equivalent when paying annually, rounded for display. */
export function annualPerMonth(monthly: number): number {
  return Math.round(annualTotal(monthly) / MONTHS_PER_YEAR);
}

export interface PriceView {
  /** Big number, e.g. "29 €", "≈ 24 €", "0 €". */
  amount: string;
  /** Unit suffix, e.g. " / Monat", " / Seat / Monat", or "" for Free. */
  unit: string;
  /** Sub-caption, e.g. "290 € / Jahr · 2 Monate gratis". */
  caption?: string;
  /** True when the amount is a rounded annual-equivalent (shows "≈"). */
  approximate?: boolean;
}

/**
 * Resolve the display strings for a tier at a given billing period.
 * Centralised so every "€"/"Monat"/"Seat" string is consistent.
 */
export function priceView(tier: Tier, period: BillingPeriod): PriceView {
  const { monthly, perSeat } = tier.price;
  const seat = perSeat ? ' / Seat' : '';

  if (monthly === 0) {
    return { amount: '0 €', unit: '', caption: 'Dauerhaft kostenlos' };
  }

  if (period === 'monthly') {
    return { amount: `${monthly} €`, unit: `${seat} / Monat` };
  }

  const total = annualTotal(monthly);
  return {
    amount: `≈ ${annualPerMonth(monthly)} €`,
    unit: `${seat} / Monat`,
    caption: `${total} €${seat} / Jahr · ${YEARLY_FREE_MONTHS} Monate gratis`,
    approximate: true,
  };
}

/** Mail draft for the Team "anfragen" CTA until self-serve billing exists. */
const TEAM_CONTACT_HREF =
  'mailto:hello@ctrlk.de' +
  '?subject=' +
  encodeURIComponent('Ctrl K — Team-Plan anfragen') +
  '&body=' +
  encodeURIComponent(
    'Hi Pascal,\n\nwir würden Ctrl K gern im Team nutzen.\n\n' +
      'Anzahl Seats: \nUnternehmen: \n\nViele Grüße'
  );

export const tiers: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Zum Ausprobieren.',
    price: { monthly: 0 },
    features: [
      { text: '1 verbundenes Gmail-Postfach' },
      { text: 'Morgen-Plan (Basis)' },
      { text: 'Zusagen-Erkennung limitiert (letzte 7 Tage / max. 5 aktive sichtbar)' },
      { text: 'Kundenzentrierte Inbox — nur Ansicht, kein Tagging' },
    ],
    cta: { label: 'Kostenlos starten', href: '/sign-up' },
  },
  {
    id: 'solo',
    name: 'Solo',
    tagline: 'Für Selbstständige, die mehrere Kunden parallel bedienen.',
    price: { monthly: 29 },
    highlighted: true,
    badge: 'Beliebt',
    founder: { regular: 39 },
    inheritsLabel: 'Alles aus Free, plus:',
    features: [
      { text: 'Bis zu 2 verbundene Gmail-Postfächer' },
      {
        text:
          'Volles Zusagen-Tracking — unbegrenzt, mit Fristen, Eskalation, Quell-Satz und Lernen aus deinen Korrekturen',
      },
      {
        text:
          'Volle kundenzentrierte Inbox — Tagging, „Wartet", „Nach Kunde", „Von Kunden"',
      },
      { text: 'Mail → Todo automatisch' },
      { text: 'Kalender-Integration im Plan' },
      { text: 'Und außerdem: AI-Drafts und Zusammenfassungen', muted: true },
    ],
    cta: { label: 'Solo starten', href: '/sign-up' },
  },
  {
    id: 'team',
    name: 'Team',
    tagline: 'Für kleine Agenturen und Beraterteams.',
    price: { monthly: 35, perSeat: true },
    inheritsLabel: 'Alles aus Solo, plus:',
    features: [
      { text: 'Pro Seat eigene verbundene Postfächer' },
      { text: 'Geteilte Kundenansicht: wer bearbeitet wen, wer wartet auf wen' },
      { text: 'Team-Übersicht: offene Zusagen über alle Seats' },
      { text: 'Zentrale Abrechnung' },
      { text: 'Priorisierter Support' },
    ],
    // TODO(billing): switch to { label: 'Team starten', href: '/sign-up?plan=team' }
    // once self-serve seat billing ships.
    cta: { label: 'Team anfragen', href: TEAM_CONTACT_HREF },
  },
];

/**
 * Feature-by-feature comparison. Only REAL features — every row maps to a
 * tier's actual capability above. A boolean cell renders as an included
 * dot / em-dash; a string cell renders verbatim.
 */
export interface ComparisonRow {
  label: string;
  /** Optional group heading rendered above this row. */
  group?: string;
  values: Record<TierId, string | boolean>;
}

export const comparisonRows: ComparisonRow[] = [
  {
    group: 'Postfächer & Plan',
    label: 'Verbundene Gmail-Postfächer',
    values: { free: '1', solo: '2', team: 'Pro Seat' },
  },
  {
    label: 'Morgen-Plan',
    values: { free: 'Basis', solo: 'Voll', team: 'Voll' },
  },
  {
    label: 'Kalender-Integration im Plan',
    values: { free: false, solo: true, team: true },
  },
  {
    group: 'Zusagen',
    label: 'Zusagen-Erkennung',
    values: { free: '7 Tage · max. 5', solo: 'Unbegrenzt', team: 'Unbegrenzt' },
  },
  {
    label: 'Fristen, Eskalation, Quell-Satz, Lernen aus Korrekturen',
    values: { free: false, solo: true, team: true },
  },
  {
    group: 'Inbox',
    label: 'Kundenzentrierte Inbox',
    values: { free: 'Nur Ansicht', solo: 'Voll', team: 'Voll' },
  },
  {
    label: 'Tagging — „Wartet", „Nach Kunde", „Von Kunden"',
    values: { free: false, solo: true, team: true },
  },
  {
    label: 'Mail → Todo automatisch',
    values: { free: false, solo: true, team: true },
  },
  {
    label: 'AI-Drafts & Zusammenfassungen',
    values: { free: false, solo: true, team: true },
  },
  {
    group: 'Team',
    label: 'Geteilte Kundenansicht',
    values: { free: false, solo: false, team: true },
  },
  {
    label: 'Team-Übersicht: offene Zusagen über alle Seats',
    values: { free: false, solo: false, team: true },
  },
  {
    label: 'Zentrale Abrechnung',
    values: { free: false, solo: false, team: true },
  },
  {
    label: 'Priorisierter Support',
    values: { free: false, solo: false, team: true },
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

export const faqs: FaqItem[] = [
  {
    q: 'Kann ich monatlich kündigen?',
    a: 'Ja, jederzeit zum Monatsende.',
  },
  {
    q: 'Was passiert mit dem Gründerpreis?',
    a: 'Wenn du jetzt einsteigst, bleibt dein Preis dauerhaft, auch wenn der Regulärpreis später steigt.',
  },
  {
    q: 'Brauche ich eine Kreditkarte für den Free-Tier?',
    a: 'Nein.',
  },
  {
    q: 'Unterstützt ihr Outlook?',
    a: 'Aktuell Gmail. Outlook ist auf der Roadmap.',
  },
];
