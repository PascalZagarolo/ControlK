/**
 * Erst-Onboarding nach Anmeldung.
 *
 * Reached only by signed-in users whose `onboardingCompletedAt` is still
 * null (the foyer redirects them here; existing users were backfilled as
 * completed in migration 0051, so they never see this).
 *
 * Three short, value-oriented steps:
 *   1. Aufgabe spiegeln — which problem do you want under control (messaging
 *      personalisation only, NO persona feature-split).
 *   2. Solo oder Team — the only real segmentation; maps to workspace.scope.
 *   3. Gmail verbinden + erster Scan — the Aha-moment: read sent mail for
 *      commitments + inbox triage, then land on the real Morgen-Plan.
 *
 * The whole flow is a focused full-screen takeover; the OnboardingClient
 * handles step navigation + the server actions.
 */

import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { fetchGmailConnectionState } from '@/lib/foyer/gmail-state';
import { OnboardingClient } from '@/components/onboarding/onboarding-client';
import type { OnboardingFocus } from '@/lib/actions/onboarding';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Einrichten',
  robots: { index: false, follow: false },
};

const FOCI = new Set(['commitments', 'response_time', 'morning_chaos', 'all']);

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/onboarding');
  if (user.onboardingCompleted) redirect('/');

  const [gmail, sp] = await Promise.all([
    fetchGmailConnectionState(user.id),
    searchParams,
  ]);

  const initialFocus =
    user.onboardingFocus && FOCI.has(user.onboardingFocus)
      ? (user.onboardingFocus as OnboardingFocus)
      : null;

  return (
    <OnboardingClient
      userName={user.name.split(' ')[0] || user.name}
      initialFocus={initialFocus}
      gmailConnected={gmail.connected}
      justConnected={sp.connected === '1'}
    />
  );
}
