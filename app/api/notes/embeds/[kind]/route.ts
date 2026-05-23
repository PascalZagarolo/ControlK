import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { getCurrentWorkspace } from '@/lib/db/current-workspace';
import { listTodos } from '@/lib/db/queries/todos';
import { listTodoGroups } from '@/lib/db/queries/todo-groups';
import { buildBrief, briefToScript } from '@/lib/brief/build-script';
import { listCustomers } from '@/lib/db/queries/customers';
import { listContracts } from '@/lib/db/queries/contracts';
import { getFleetOccupancyForecast } from '@/lib/db/queries/fleet-occupancy';

/**
 * Live-embed data endpoint for the Notes editor. The custom LiveEmbed block
 * fetches `/api/notes/embeds/<kind>` on mount and re-renders with the result.
 *
 * Each kind returns a small, embed-shaped payload:
 *   - `brief`    today's daily brief, condensed
 *   - `pipeline` sales pipeline: customers by status × open contracts
 *   - `fleet`    vehicle utilization next 7 days
 *
 * All payloads include a `freshAt` ISO timestamp so the user can see when
 * the snapshot was last pulled (server-rendered live).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
  const ws = await getCurrentWorkspace();
  if (!ws) return NextResponse.json({ ok: false, error: 'no-workspace' });

  const freshAt = new Date().toISOString();

  if (kind === 'brief') {
    const [todos, groups] = await Promise.all([listTodos(ws.id, user.id), listTodoGroups(ws.id)]);
    const brief = buildBrief({
      firstName: user.name.split(' ')[0] || user.name,
      todos,
      groups,
      currentUserId: user.id,
    });
    return NextResponse.json({
      ok: true,
      freshAt,
      title: 'Daily Brief',
      brief,
      script: briefToScript(brief),
    });
  }

  if (kind === 'pipeline') {
    const [customers, contracts] = await Promise.all([
      listCustomers(ws.id),
      listContracts(ws.id),
    ]);
    const byStatus = {
      lead: customers.filter((c) => c.status === 'lead'),
      aktiv: customers.filter((c) => c.status === 'aktiv'),
      inaktiv: customers.filter((c) => c.status === 'inaktiv'),
    };
    const openContracts = contracts.filter((c) => c.status !== 'storniert' && c.status !== 'vorlage');
    return NextResponse.json({
      ok: true,
      freshAt,
      title: 'Sales Pipeline',
      stages: [
        { key: 'lead', label: 'Leads', count: byStatus.lead.length, samples: byStatus.lead.slice(0, 3).map((c) => c.name) },
        { key: 'aktiv', label: 'Aktive Kunden', count: byStatus.aktiv.length, samples: byStatus.aktiv.slice(0, 3).map((c) => c.name) },
        { key: 'inaktiv', label: 'Inaktiv', count: byStatus.inaktiv.length, samples: byStatus.inaktiv.slice(0, 3).map((c) => c.name) },
      ],
      openContractCount: openContracts.length,
    });
  }

  if (kind === 'fleet') {
    const days = await getFleetOccupancyForecast(ws.id, 7);
    if (days.length === 0)
      return NextResponse.json({
        ok: true,
        freshAt,
        title: 'Flotten-Status',
        empty: true,
      });
    const avgUtil = days.reduce((a, b) => a + b.utilization, 0) / days.length;
    const peakDay = days.reduce((a, b) => (b.utilization > a.utilization ? b : a));
    return NextResponse.json({
      ok: true,
      freshAt,
      title: 'Flotten-Status · 7 Tage',
      avgUtilization: avgUtil,
      totalVehicles: days[0].totalCount,
      peakDay: { date: peakDay.date, utilization: peakDay.utilization, markup: peakDay.recommendedMarkupPct },
      days,
    });
  }

  return NextResponse.json({ ok: false, error: 'unknown-kind' }, { status: 400 });
}
