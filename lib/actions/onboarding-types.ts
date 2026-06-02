// Serialisable types shared between the onboarding server actions and the
// client flow. Kept out of the 'use server' module so the client component
// can import them without pulling server-only code over the RSC boundary.

import type { MorningPlan } from '@/lib/morning-plan/types';

/** A slim, serialisable plan row for the first-scan preview. */
export type OnboardingPlanItem = {
  key: string;
  /** Locked-caps kicker, e.g. "Zusage · heute fällig" (foyer vocabulary). */
  kicker: string;
  title: string;
  /** WHY it's here — the source sentence or waiting time. */
  reason: string;
  /** Deadline/age sub-label, e.g. "fällig heute". Null when none. */
  timing: string | null;
  /** Tentative commitments render as a question, never asserted. */
  isQuestion: boolean;
  /** Theme accent hex for the left rail (sand/gold = due, red = overdue …). */
  accent: string;
};

/** A real inbound sender offered for the optional "als Kunde markieren" tap. */
export type OnboardingScanSender = {
  name: string;
  email: string;
  ageDays: number;
};

/** Result of the step-3 first scan — honest about both filled and empty days. */
export type OnboardingScanResult =
  | {
      ok: true;
      connectionState: 'ready' | 'first_scan' | 'not_connected';
      /** Honest counts of what was actually read/derived. */
      scan: { mailsRead: number; commitmentsFound: number };
      plan: {
        summaryLine: string;
        items: OnboardingPlanItem[];
        collision: string | null;
        isCalm: boolean;
        stats: MorningPlan['stats'];
      };
      senders: OnboardingScanSender[];
    }
  | { ok: false; reason: 'not_connected' | 'no_scope' | 'auth' | 'error' };
