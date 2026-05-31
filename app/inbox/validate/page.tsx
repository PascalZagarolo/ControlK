import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { CommitmentValidationClient } from '@/components/inbox/commitment-validation-client';

export const dynamic = 'force-dynamic';

/**
 * SCHRITT 0 — Wedge validation harness. Not linked from the main nav on
 * purpose: it's an internal measurement tool, not a product surface.
 */
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/inbox/validate');
  return <CommitmentValidationClient />;
}
