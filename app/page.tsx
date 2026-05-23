import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { listChannels } from '@/lib/db/queries/channels';
import { listCustomers } from '@/lib/db/queries/customers';
import { listContracts } from '@/lib/db/queries/contracts';
import { listVehicles } from '@/lib/db/queries/vehicles';
import { listCalendarEvents } from '@/lib/db/queries/calendar';
import { listTodoGroups } from '@/lib/db/queries/todo-groups';
import { listWorkspaceMembers } from '@/lib/db/queries/members';
import { Hero } from '@/components/hero/hero';
import { CardsCarousel } from '@/components/quick-access/cards-carousel';

export default async function Page() {
  const user = await currentUser();
  if (!user) return null;
  const ws = await requireCurrentWorkspace();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const [channels, customers, contracts, vehicles, events, todoGroups, members] = await Promise.all([
    listChannels(ws.id),
    listCustomers(ws.id),
    listContracts(ws.id),
    listVehicles(ws.id),
    listCalendarEvents(ws.id, from, to),
    listTodoGroups(ws.id),
    listWorkspaceMembers(ws.id),
  ]);

  const firstName = user.name.split(' ')[0] || user.name;

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-900">
      <Hero firstName={firstName} />
      <CardsCarousel
        channels={channels}
        customers={customers}
        contracts={contracts}
        vehicles={vehicles}
        events={events}
        todoGroups={todoGroups}
        members={members}
      />
    </div>
  );
}
