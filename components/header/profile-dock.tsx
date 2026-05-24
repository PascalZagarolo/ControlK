import { currentUser } from '@/lib/auth/current-user';
import { ProfileMenu } from './profile-menu';

/**
 * Bottom-left anchor for the user's avatar + account menu.
 *
 * Renders independently of the Header's top-center dock so the profile
 * stays reachable even when there is no active workspace (e.g. right
 * after sign-up before the workspace bootstrap finishes, or if the
 * workspace becomes unavailable). The only gate is "is anyone signed
 * in"; everything else (workspace, nav, notifications) lives in the
 * top dock and may render or not on its own terms.
 */
export async function ProfileDock() {
  const user = await currentUser();
  if (!user) return null;

  return (
    <div
      className="fixed bottom-5 left-5 z-50"
      style={{
        // The avatar trigger itself rounds to a circle; we don't add
        // background/border here so the dock blends into whatever page
        // sits below it. The ring on the trigger gives it its edge.
      }}
    >
      <ProfileMenu
        placement="top"
        size={36}
        name={user.name}
        email={user.email}
        initials={user.initials}
        from={user.avatarFrom}
        to={user.avatarTo}
      />
    </div>
  );
}
