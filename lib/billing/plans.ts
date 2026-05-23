/**
 * Plan catalogue. The numbers here are the public-facing source of truth —
 * settings/billing renders directly from this, Stripe product IDs map by key.
 *
 * Honest gating principle from the brief: NEVER gate Permissions, API, or
 * basic functionality. Quotas (Notes count, AI tokens) are fair. Features
 * that scale with team-size (admin, sharing) are NOT paywalled.
 */

export type PlanTier = 'free' | 'solo' | 'team';

export type PlanFeatures = {
  /** Hard caps that trigger UI warnings + block creation */
  maxWorkspaces: number; // 0 = unlimited
  maxNotes: number;
  maxStorageMb: number;
  /** AI: how many tokens/month bundled with the server fallback key
   * (ignored when user supplies their own via BYOK). */
  monthlyAiTokens: number;
  /** Multi-user features */
  supportsTeamMembers: boolean;
  euHostingGuaranteed: boolean;
  prioritySupport: boolean;
};

export type Plan = {
  key: PlanTier;
  name: string;
  pricePerSeatCents: number;
  minSeats: number;
  tagline: string;
  features: PlanFeatures;
  stripePriceId?: string; // populated from env at runtime
};

export const PLANS: Record<PlanTier, Plan> = {
  free: {
    key: 'free',
    name: 'Free',
    pricePerSeatCents: 0,
    minSeats: 1,
    tagline: 'Für Solo-User die anfangen',
    features: {
      maxWorkspaces: 3,
      maxNotes: 100,
      maxStorageMb: 100,
      monthlyAiTokens: 10_000,
      supportsTeamMembers: false,
      euHostingGuaranteed: true,
      prioritySupport: false,
    },
  },
  solo: {
    key: 'solo',
    name: 'Solo',
    pricePerSeatCents: 800,
    minSeats: 1,
    tagline: 'Für Profis die produktiv sind',
    features: {
      maxWorkspaces: 0,
      maxNotes: 0,
      maxStorageMb: 5_000,
      monthlyAiTokens: 200_000,
      supportsTeamMembers: false,
      euHostingGuaranteed: true,
      prioritySupport: false,
    },
  },
  team: {
    key: 'team',
    name: 'Team',
    pricePerSeatCents: 1200,
    minSeats: 2,
    tagline: 'Für Teams ab zwei Personen',
    features: {
      maxWorkspaces: 0,
      maxNotes: 0,
      maxStorageMb: 50_000,
      monthlyAiTokens: 500_000,
      supportsTeamMembers: true,
      euHostingGuaranteed: true,
      prioritySupport: true,
    },
  },
};

const TIER_RANK: Record<PlanTier, number> = { free: 0, solo: 1, team: 2 };

export function isAtLeast(actual: PlanTier, minimum: PlanTier): boolean {
  return TIER_RANK[actual] >= TIER_RANK[minimum];
}

export function priceLabel(plan: Plan): string {
  if (plan.pricePerSeatCents === 0) return 'kostenlos';
  const eur = (plan.pricePerSeatCents / 100).toFixed(0);
  return `€${eur} / Member · Monat`;
}
