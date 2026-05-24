'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/current-user';
import { disconnectGoogle } from '@/lib/auth/google-tokens';

export async function disconnectGoogleAction(): Promise<void> {
  const user = await requireUser();
  await disconnectGoogle(user.id);
  revalidatePath('/settings/integrations');
  // Redirect with a hint query so the panel can show a brief
  // "Verbindung getrennt" toast on the next render if we add one.
  redirect('/settings/integrations?disconnected=1');
}
