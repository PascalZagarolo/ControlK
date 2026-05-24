import { currentUser } from '@/lib/auth/current-user';
import { getCurrentWorkspace, listUserWorkspaces } from '@/lib/db/current-workspace';
import { listNotifications } from '@/lib/db/queries/notifications';
import { WorkspaceSwitcher } from './workspace-switcher';
import { NavTabs } from './nav-tabs';
import { NotificationsBell } from './notifications-bell';

export async function Header() {
  const user = await currentUser();
  if (!user) return null;

  const [active, workspaces, notifications] = await Promise.all([
    getCurrentWorkspace(),
    listUserWorkspaces(),
    listNotifications(user.id, 12),
  ]);

  if (!active) return null;

  const activeScope = (active.scope === 'private' ? 'private' : 'business') as
    | 'business'
    | 'private';

  return (
    <header
      className="absolute left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[#1F1F23] px-2 py-1.5 backdrop-blur-xl backdrop-saturate-150"
      style={{ background: 'rgba(17, 17, 20, 0.55)' }}
    >
      <WorkspaceSwitcher
        active={{
          id: active.id,
          slug: active.slug,
          name: active.name,
          short: active.short,
          from: active.fromColor,
          to: active.toColor,
          scope: activeScope,
        }}
        workspaces={workspaces.map((w) => ({
          id: w.id,
          slug: w.slug,
          name: w.name,
          short: w.short,
          from: w.fromColor,
          to: w.toColor,
          scope: (w.scope === 'private' ? 'private' : 'business') as
            | 'business'
            | 'private',
        }))}
      />
      <span aria-hidden className="mx-1 h-4 w-px bg-[#1F1F23]" />
      <NavTabs scope={activeScope} />
      <span aria-hidden className="mx-1 h-4 w-px bg-[#1F1F23]" />
      <NotificationsBell initial={notifications} />
    </header>
  );
}
