import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { previewInvite } from '@/lib/db/queries/workspace';
import { Avatar } from '@/components/channel/avatar';
import { InviteAcceptForm } from '@/components/workspace/invite-accept-form';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await previewInvite(token);
  const user = await currentUser();

  // Not logged in → preserve the token through sign-in, no matter the
  // invite status (so /sign-in shows the right UX even for a stale link;
  // we'll re-evaluate after return).
  if (!user) {
    redirect(`/sign-in?from=${encodeURIComponent(`/invite/${token}`)}`);
  }

  if (preview.status === 'not_found') {
    return (
      <InviteShell>
        <StateMessage
          kicker="Einladung"
          title="Diese Einladung existiert nicht."
          body="Möglicherweise wurde sie zurückgezogen oder der Link ist falsch."
          primary={{ label: 'Zurück zu Ctrl K', href: '/' }}
        />
      </InviteShell>
    );
  }

  if (preview.status === 'revoked') {
    return (
      <InviteShell>
        <StateMessage
          kicker="Einladung zurückgezogen"
          title="Diese Einladung wurde zurückgezogen."
          body="Bitte den Workspace-Owner um eine neue Einladung."
          primary={{ label: 'Zurück zu Ctrl K', href: '/' }}
        />
      </InviteShell>
    );
  }

  if (preview.status === 'expired') {
    return (
      <InviteShell>
        <StateMessage
          kicker="Einladung abgelaufen"
          title="Diese Einladung ist abgelaufen."
          body="Bitte den Workspace-Owner um eine neue Einladung."
          primary={{ label: 'Zurück zu Ctrl K', href: '/' }}
        />
      </InviteShell>
    );
  }

  if (preview.status === 'used_up') {
    return (
      <InviteShell>
        <StateMessage
          kicker="Einladung verbraucht"
          title="Diese Einladung wurde bereits verwendet."
          body="Falls das dein Account war, ist alles in Ordnung — du bist schon Mitglied."
          primary={{ label: 'Zu deinen Workspaces', href: '/' }}
        />
      </InviteShell>
    );
  }

  if (preview.status === 'workspace_archived') {
    return (
      <InviteShell>
        <StateMessage
          kicker="Workspace archiviert"
          title="Dieser Workspace ist archiviert."
          body="Der Workspace nimmt aktuell keine neuen Mitglieder auf."
          primary={{ label: 'Zurück zu Ctrl K', href: '/' }}
        />
      </InviteShell>
    );
  }

  // preview.status === 'ok'
  const { workspace, role, invitedByName, expiresAt, email } = preview;
  const emailMismatch = email && email.toLowerCase() !== user.email.toLowerCase();

  return (
    <InviteShell>
      <div className="flex flex-col items-center gap-4 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-6">
        {workspace.iconEmoji ? (
          <span className="flex h-16 w-16 items-center justify-center rounded-[14px] bg-white/[0.04] text-[32px]">
            {workspace.iconEmoji}
          </span>
        ) : (
          <Avatar
            initials={workspace.short}
            from={workspace.from}
            to={workspace.to}
            size={64}
          />
        )}
        <div className="text-center">
          <h1 className="text-[24px] font-medium leading-tight tracking-[-0.2px] text-ink-50">
            {workspace.name}
          </h1>
          {workspace.description && (
            <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-300">
              {workspace.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11.5px] text-ink-300">
          {workspace.memberCount != null && (
            <span>{workspace.memberCount} Member</span>
          )}
          {invitedByName && (
            <>
              <span>·</span>
              <span>
                Eingeladen von <span className="text-ink-100">{invitedByName}</span>
              </span>
            </>
          )}
        </div>

        <div className="my-2 flex w-full items-center gap-2">
          <span className="h-px flex-1 bg-white/[0.06]" />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.4px] text-ink-300">
            Rolle nach Beitritt
          </span>
          <span className="h-px flex-1 bg-white/[0.06]" />
        </div>

        <div className="rounded-full bg-white/[0.04] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3px] text-ink-100">
          {role}
        </div>

        {expiresAt && (
          <p className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            Gültig bis {new Date(expiresAt).toLocaleDateString('de-DE')}
          </p>
        )}

        {emailMismatch ? (
          <div className="w-full rounded-[10px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] p-3 text-[12px] text-[#ff8a8a]">
            ⚠ Diese Einladung ist für {email} bestimmt. Du bist als {user.email} eingeloggt.{' '}
            <Link href="/sign-out" className="underline">
              Abmelden
            </Link>{' '}
            und mit der richtigen Email neu einloggen.
          </div>
        ) : (
          <InviteAcceptForm token={token} />
        )}
      </div>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink-900">
      <div className="mx-auto flex max-w-[460px] flex-col gap-6 px-4 py-16 md:px-6">
        <div className="text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Ctrl K · Invite
          </span>
        </div>
        {children}
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          Ctrl K · Discord-Style Workspaces
        </p>
      </div>
    </div>
  );
}

function StateMessage({
  kicker,
  title,
  body,
  primary,
}: {
  kicker: string;
  title: string;
  body: string;
  primary: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-8 text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        {kicker}
      </span>
      <h1 className="text-[20px] font-medium leading-tight tracking-[-0.2px] text-ink-50">
        {title}
      </h1>
      <p className="text-[13.5px] leading-[1.55] text-ink-300">{body}</p>
      <Link
        href={primary.href}
        className="mt-2 inline-flex items-center rounded-[10px] border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-[13px] font-medium text-ink-50 transition-colors hover:bg-white/[0.08]"
      >
        {primary.label}
      </Link>
    </div>
  );
}
