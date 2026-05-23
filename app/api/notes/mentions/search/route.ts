import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { getCurrentWorkspace } from '@/lib/db/current-workspace';
import { listChannels } from '@/lib/db/queries/channels';
import { listCustomers } from '@/lib/db/queries/customers';
import { listContracts } from '@/lib/db/queries/contracts';
import { listVehicles } from '@/lib/db/queries/vehicles';

export type MentionCandidate = {
  kind: 'customer' | 'contract' | 'vehicle' | 'channel';
  id: string;
  label: string;
  subtitle?: string;
  status?: string;
};

/**
 * Cheap workspace-scoped index for the @-mention autocomplete inside notes.
 * Ranks by simple prefix-then-substring match; falls back to first 8 of each
 * kind when the query is empty so the menu always shows something useful.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ hits: [] });
  const ws = await getCurrentWorkspace();
  if (!ws) return NextResponse.json({ hits: [] });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  const [customers, contracts, vehicles, channels] = await Promise.all([
    listCustomers(ws.id),
    listContracts(ws.id),
    listVehicles(ws.id),
    listChannels(ws.id),
  ]);

  const all: MentionCandidate[] = [
    ...customers.map((c) => ({
      kind: 'customer' as const,
      id: c.id,
      label: c.name,
      subtitle: c.industry || undefined,
      status: c.status,
    })),
    ...contracts.map((c) => ({
      kind: 'contract' as const,
      id: c.id,
      label: c.title,
      subtitle: c.customerName ?? undefined,
      status: c.status,
    })),
    ...vehicles.map((v) => ({
      kind: 'vehicle' as const,
      id: v.id,
      label: v.plate,
      subtitle: v.model,
      status: v.status,
    })),
    ...channels.map((c) => ({
      kind: 'channel' as const,
      id: c.slug, // channels: route by slug
      label: `#${c.name}`,
      subtitle: c.topic || undefined,
    })),
  ];

  let hits: MentionCandidate[];
  if (!q) {
    // No query → return a few of each kind so the menu isn't empty
    hits = all.slice(0, 24);
  } else {
    hits = all
      .map((h) => {
        const lbl = h.label.toLowerCase();
        const sub = (h.subtitle ?? '').toLowerCase();
        let score = 0;
        if (lbl === q) score += 100;
        if (lbl.startsWith(q)) score += 50;
        if (lbl.includes(q)) score += 25;
        if (sub.includes(q)) score += 8;
        return { hit: h, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((s) => s.hit);
  }

  return NextResponse.json({ hits });
}
