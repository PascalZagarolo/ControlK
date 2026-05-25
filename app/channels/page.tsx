import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { ensureDefaultChannelExists } from '@/lib/db/workspace-templates';
import { listChannels } from '@/lib/db/queries/channels';

/**
 * /channels is a redirect shell. The actual Channels surface is the
 * two-column layout at /channels/[slug]; the bare index just decides
 * which channel to land on.
 *
 * Behaviour:
 *   1. Personal workspace (scope='private') → redirect to /. Channels
 *      don't exist there at all (NavTabs already hides the tab; this
 *      catches direct URL access).
 *   2. Shared workspace with channels → prefer "general" slug, else
 *      the first channel alphabetically (matches sidebar sort).
 *   3. Shared workspace with NO channels → seed #general on the fly
 *      and redirect. This shouldn't fire after migration 0032 + the
 *      ensureDefaultChannelExists call in createWorkspace, but it's
 *      a self-healing failsafe for any edge case (e.g. a member who
 *      removed every channel without realising).
 */
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/channels');
  const ws = await requireCurrentWorkspace();

  if (ws.scope === 'private') {
    redirect('/');
  }

  let channels = await listChannels(ws.id);
  if (channels.length === 0) {
    await ensureDefaultChannelExists(ws.id, user.id);
    channels = await listChannels(ws.id);
  }
  if (channels.length === 0) {
    // True failsafe: even after seeding nothing came back (DB issue).
    // Fall back to foyer so the user isn't stuck.
    redirect('/');
  }

  const preferred =
    channels.find((c) => c.slug === 'general')?.slug ?? channels[0].slug;
  redirect(`/channels/${preferred}`);
}
