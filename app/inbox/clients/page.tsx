import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import {
  getClientGroups,
  listClientMail,
  listWaitingOnYou,
  listContactTags,
} from '@/lib/db/queries/clients';
import { ClientsInboxClient } from './clients-inbox-client';

export const dynamic = 'force-dynamic';

type Search = { view?: string };

function parseView(raw: string | undefined): 'nach_kunde' | 'wartet' | 'von_kunden' {
  if (raw === 'wartet') return 'wartet';
  if (raw === 'von_kunden') return 'von_kunden';
  return 'nach_kunde';
}

/**
 * Customer-centric inbox — three lenses (Schritt 5), ADDITIVE to the
 * chronological /inbox view (which stays untouched):
 *   B1 "Nach Kunde"  · B2 "Wartet"  · B3 "Von Kunden"
 *
 * All three resolve a sender as a client via lightweight contact_tags OR the
 * CRM, and stay noise-free by consuming the Prompt-1 triage gate. Nothing
 * here re-implements triage/commitments — it consumes them.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?from=/inbox/clients');
  const ws = await requireCurrentWorkspace();
  const view = parseView((await searchParams).view);

  const [groups, waiting, clientMail, tags] = await Promise.all([
    view === 'nach_kunde' ? getClientGroups(ws.id, user.id).catch(() => ({ clients: [], other: null })) : Promise.resolve({ clients: [], other: null }),
    view === 'wartet' ? listWaitingOnYou(ws.id, user.id).catch(() => []) : Promise.resolve([]),
    view === 'von_kunden' ? listClientMail(ws.id, user.id).catch(() => []) : Promise.resolve([]),
    listContactTags(ws.id, user.id).catch(() => []),
  ]);

  return (
    <ClientsInboxClient
      view={view}
      groups={groups}
      waiting={waiting}
      clientMail={clientMail}
      tagCount={tags.length}
    />
  );
}
