import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
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
  if (!preview) notFound();

  const user = await currentUser();

  if (!user) {
    // Redirect to sign-in with the invite token preserved
    redirect(`/sign-in?from=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const { workspace, role, invitedByName, expiresAt, email } = preview;
  const emailMismatch = email && email.toLowerCase() !== user.email.toLowerCase();

  return (
    <div className="min-h-screen bg-ink-900">
      <div className="mx-auto flex max-w-[460px] flex-col gap-6 px-4 py-16 md:px-6">
        <div className="text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            uRent · Invite
          </span>
        </div>

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
              ⚠ Dieser Invite ist für {email} bestimmt. Du bist als {user.email} eingeloggt.{' '}
              <Link href="/sign-out" className="underline">
                Abmelden
              </Link>{' '}
              und mit der richtigen Email neu einloggen.
            </div>
          ) : (
            <InviteAcceptForm token={token} />
          )}
        </div>

        <p className="text-center font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
          uRent · Discord-Style Workspaces
        </p>
      </div>
    </div>
  );
}
