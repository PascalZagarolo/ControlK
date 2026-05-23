import { currentUser } from '@/lib/auth/current-user';
import { getCurrentWorkspace, listUserWorkspaces } from '@/lib/db/current-workspace';
import { listNotifications } from '@/lib/db/queries/notifications';
import { WorkspaceSwitcher } from './workspace-switcher';
import { NavTabs } from './nav-tabs';
import { ProfileMenu } from './profile-menu';
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
    <header className="absolute left-1/2 top-3 z-50 flex h-[52px] -translate-x-1/2 items-center gap-8 rounded-[14px] border border-white/[0.08] bg-[rgba(12,13,15,0.78)] px-4 shadow-panel backdrop-blur-xl backdrop-saturate-150">
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
      <NavTabs scope={activeScope} />
      <div className="flex items-center gap-1">
        <NotificationsBell initial={notifications} />
        <ProfileMenu
          name={user.name}
          email={user.email}
          initials={user.initials}
          from={user.avatarFrom}
          to={user.avatarTo}
        />
      </div>
    </header>
  );
}
