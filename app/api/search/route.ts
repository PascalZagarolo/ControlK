import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { getCurrentWorkspace } from '@/lib/db/current-workspace';
import { listChannels } from '@/lib/db/queries/channels';
import { listCustomers } from '@/lib/db/queries/customers';
import { listContracts } from '@/lib/db/queries/contracts';
import { listVehicles } from '@/lib/db/queries/vehicles';
import { listNotesTree } from '@/lib/db/queries/notes';
import type { SearchHit } from '@/lib/types';

const ACTIONS: SearchHit[] = [
  { id: 'a-new-contract', kind: 'action', title: 'Neuer Vertrag', subtitle: 'Aus Vorlage erstellen', url: '/vertraege' },
  { id: 'a-new-customer', kind: 'action', title: 'Neuer Kunde', subtitle: 'CRM-Eintrag anlegen', url: '/kunden' },
  { id: 'a-new-event', kind: 'action', title: 'Termin planen', subtitle: 'Übergabe / Rückgabe / intern', url: '/kalender' },
  { id: 'a-fleet-report', kind: 'action', title: 'Auslastungs-Report', subtitle: 'Flotten-Verfügbarkeit prüfen', url: '/flotte' },
  { id: 'a-inbox', kind: 'action', title: 'Posteingang öffnen', subtitle: 'Mentions, Threads, DMs', url: '/inbox' },
  { id: 'a-security', kind: 'action', title: 'Sicherheit & 2FA', subtitle: 'Konto-Schutz', url: '/settings/security' },
];

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ hits: [] });
  const ws = await getCurrentWorkspace();
  if (!ws) return NextResponse.json({ hits: ACTIONS });

  const [channels, customers, contracts, vehicles, notes] = await Promise.all([
    listChannels(ws.id),
    listCustomers(ws.id),
    listContracts(ws.id),
    listVehicles(ws.id),
    listNotesTree(ws.id, user.id),
  ]);

  const hits: SearchHit[] = [
    ...channels.map<SearchHit>((c) => ({
      id: `channel-${c.slug}`,
      kind: 'channel',
      title: `#${c.name}`,
      subtitle: c.topic || `${c.members} Mitglieder`,
      url: `/channels/${c.slug}`,
    })),
    ...customers.map<SearchHit>((c) => ({
      id: `customer-${c.id}`,
      kind: 'customer',
      title: c.name,
      subtitle: `${c.industry || '—'} · ${c.activeContracts} Verträge`,
      url: `/kunden/${c.id}`,
    })),
    ...contracts.map<SearchHit>((c) => ({
      id: `contract-${c.id}`,
      kind: 'contract',
      title: c.title,
      subtitle:
        c.status === 'vorlage' ? 'Vorlage' : `${c.customerName ?? '—'} · ${c.value}`,
      url: `/vertraege/${c.id}`,
    })),
    ...vehicles.map<SearchHit>((v) => ({
      id: `vehicle-${v.id}`,
      kind: 'vehicle',
      title: v.model,
      subtitle: `${v.plate} · ${v.status} · ${v.location}`,
      url: `/flotte/${v.id}`,
    })),
    ...notes
      .filter((n) => !n.archived && !n.isTemplate)
      .map<SearchHit>((n) => ({
        id: `note-${n.id}`,
        kind: 'note',
        title: `${n.icon ? n.icon + ' ' : ''}${n.title}`,
        subtitle: n.childCount > 0 ? `${n.childCount} Unter-Notizen` : undefined,
        url: `/notes/${n.id}`,
      })),
    ...ACTIONS,
  ];

  return NextResponse.json({ hits });
}
