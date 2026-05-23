import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { listUserWorkspaces } from '@/lib/db/current-workspace';
import { listChannels } from '@/lib/db/queries/channels';
import { listCustomers } from '@/lib/db/queries/customers';
import { listContracts } from '@/lib/db/queries/contracts';
import { listVehicles } from '@/lib/db/queries/vehicles';
import type { SearchHit } from '@/lib/types';

/**
 * Aggregates a search index across ALL workspaces the user is a member of.
 * Each hit includes a `workspace` tag so the CmdK UI can render a badge and
 * the user knows which workspace the result belongs to.
 *
 * Results that live in non-active workspaces still link to the entity-specific
 * route — switching the workspace happens on click via setActiveWorkspaceCookie
 * (handled by the entity page's server action chain).
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ hits: [] });

  const workspaces = await listUserWorkspaces();

  const allHits: SearchHit[] = [];

  for (const ws of workspaces) {
    const wsBadge = {
      slug: ws.slug,
      name: ws.name,
      short: ws.short,
      from: ws.fromColor,
      to: ws.toColor,
      scope: (ws.scope === 'private' ? 'private' : 'business') as
        | 'business'
        | 'private',
    };

    const [channels, customers, contracts, vehicles] = await Promise.all([
      listChannels(ws.id),
      listCustomers(ws.id),
      listContracts(ws.id),
      listVehicles(ws.id),
    ]);

    for (const c of channels) {
      allHits.push({
        id: `${ws.slug}-channel-${c.slug}`,
        kind: 'channel',
        title: `#${c.name}`,
        subtitle: c.topic || `${c.members} Mitglieder`,
        url: `/channels/${c.slug}`,
        workspace: wsBadge,
      });
    }
    for (const c of customers) {
      allHits.push({
        id: `${ws.slug}-customer-${c.id}`,
        kind: 'customer',
        title: c.name,
        subtitle: `${c.industry || '—'} · ${c.activeContracts} Verträge`,
        url: `/kunden/${c.id}`,
        workspace: wsBadge,
      });
    }
    for (const c of contracts) {
      allHits.push({
        id: `${ws.slug}-contract-${c.id}`,
        kind: 'contract',
        title: c.title,
        subtitle:
          c.status === 'vorlage' ? 'Vorlage' : `${c.customerName ?? '—'} · ${c.value}`,
        url: `/vertraege/${c.id}`,
        workspace: wsBadge,
      });
    }
    for (const v of vehicles) {
      allHits.push({
        id: `${ws.slug}-vehicle-${v.id}`,
        kind: 'vehicle',
        title: v.model,
        subtitle: `${v.plate} · ${v.status} · ${v.location}`,
        url: `/flotte/${v.id}`,
        workspace: wsBadge,
      });
    }
  }

  return NextResponse.json({ hits: allHits });
}
