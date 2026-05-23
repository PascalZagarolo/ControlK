'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Headline, MetaTag, MetaDivider } from '@/components/ui/headline';
import { FilterPills } from '@/components/ui/filter-pills';
import { Avatar } from '@/components/channel/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTriggerInline,
} from '@/components/ui/select';
import {
  Modal,
  ModalActions,
  ModalError,
  ModalField,
  ModalInput,
  ModalPrimary,
  ModalSecondary,
  ModalTextarea,
} from '@/components/ui/modal';
import { InviteModal } from './invite-modal';
import {
  archiveWorkspace,
  deleteWorkspace,
  leaveWorkspace,
  removeMember,
  transferOwnership,
  unarchiveWorkspace,
  updateMemberRole,
  updateWorkspace,
} from '@/lib/actions/workspace';
import {
  canEditWorkspace,
  canInvite,
  canKick,
  canChangeRole,
  canTransferOwnership,
  canDeleteWorkspace,
} from '@/lib/auth/permissions';
import type {
  WorkspaceActivityEntry,
  WorkspaceActivityKind,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from '@/lib/types';

const TABS = ['Allgemein', 'Members', 'Invites', 'Audit-Log', 'Danger'] as const;
type Tab = (typeof TABS)[number];

type Workspace = {
  id: string;
  slug: string;
  name: string;
  short: string;
  from: string;
  to: string;
  description?: string;
  iconEmoji?: string;
  timezone?: string;
  isPublic?: boolean;
};

const ROLE_OPTIONS: WorkspaceRole[] = ['admin', 'member', 'guest'];

const ACTIVITY_VERB: Record<WorkspaceActivityKind, string> = {
  workspace_created: 'hat den Workspace erstellt',
  member_joined: 'ist beigetreten',
  member_left: 'hat den Workspace verlassen',
  member_kicked: 'wurde entfernt',
  role_changed: 'hat die Rolle geändert',
  invite_created: 'hat einen Invite-Link erstellt',
  invite_redeemed: 'hat einen Invite eingelöst',
  invite_revoked: 'hat einen Invite widerrufen',
  settings_changed: 'hat Settings geändert',
  ownership_transferred: 'hat Ownership übertragen',
  workspace_archived: 'hat den Workspace archiviert',
  workspace_unarchived: 'hat den Workspace reaktiviert',
};

export function WorkspaceSettingsClient({
  workspace,
  myRole,
  myUserId,
  members,
  invites,
  activity,
}: {
  workspace: Workspace;
  myRole: WorkspaceRole;
  myUserId: string;
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  activity: WorkspaceActivityEntry[];
}) {
  const [tab, setTab] = useState<Tab>('Allgemein');
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 pb-32 pt-28 md:px-6">
      <Headline
        kicker="Workspace-Settings"
        title={workspace.name}
        subtitle={`Deine Rolle: ${myRole} · ${members.length} Member`}
        meta={
          <>
            <MetaTag highlight>{members.length} Member</MetaTag>
            {invites.filter((i) => !i.revokedAt).length > 0 && (
              <>
                <MetaDivider />
                <MetaTag>{invites.filter((i) => !i.revokedAt).length} aktive Invites</MetaTag>
              </>
            )}
          </>
        }
        trailing={
          canInvite(myRole) && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12.5px] font-medium leading-none text-ink-50 transition-colors hover:border-white/[0.18] hover:bg-white/[0.06]"
            >
              + Member einladen
            </button>
          )
        }
      />

      <FilterPills options={TABS} value={tab} onChange={setTab} />

      {tab === 'Allgemein' && (
        <GeneralTab workspace={workspace} canEdit={canEditWorkspace(myRole)} />
      )}
      {tab === 'Members' && (
        <MembersTab
          workspaceId={workspace.id}
          members={members}
          myRole={myRole}
          myUserId={myUserId}
        />
      )}
      {tab === 'Invites' && (
        <InvitesTab
          invites={invites}
          canInvite={canInvite(myRole)}
          onOpen={() => setInviteOpen(true)}
        />
      )}
      {tab === 'Audit-Log' && <ActivityTab activity={activity} />}
      {tab === 'Danger' && (
        <DangerTab
          workspace={workspace}
          myRole={myRole}
          myUserId={myUserId}
          members={members}
        />
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        existing={invites}
      />
    </div>
  );
}

function GeneralTab({ workspace, canEdit }: { workspace: Workspace; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description ?? '');
  const [iconEmoji, setIconEmoji] = useState(workspace.iconEmoji ?? '');
  const [isPublic, setIsPublic] = useState(!!workspace.isPublic);

  const save = () => {
    setError(null);
    start(async () => {
      const res = await updateWorkspace({
        workspaceId: workspace.id,
        patch: {
          name,
          description,
          iconEmoji,
          isPublic,
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-4">
      {!canEdit && (
        <div className="rounded-[8px] border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[12.5px] text-ink-300">
          Du hast keine Edit-Berechtigung für diese Workspace.
        </div>
      )}
      {error && (
        <div className="rounded-[8px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] px-3 py-2 text-[12.5px] text-[#ff8a8a]">
          {error}
        </div>
      )}
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
          className="block w-full rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] text-ink-50 outline-none focus:border-white/[0.20] disabled:opacity-50"
        />
      </Field>
      <Field label="Beschreibung">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={!canEdit}
          className="block w-full resize-none rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[14px] leading-[1.55] text-ink-50 outline-none focus:border-white/[0.20] disabled:opacity-50"
        />
      </Field>
      <Field label="Icon (Emoji)">
        <input
          value={iconEmoji}
          onChange={(e) => setIconEmoji(e.target.value.slice(0, 4))}
          disabled={!canEdit}
          maxLength={4}
          className="block w-24 rounded-[8px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-center text-[18px] outline-none focus:border-white/[0.20] disabled:opacity-50"
        />
      </Field>
      <Field
        label="Public-Workspace"
        hint="Wenn aktiv: Workspace ist auf /workspaces/discover sichtbar."
      >
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-100">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            disabled={!canEdit}
          />
          Workspace ist öffentlich auffindbar
        </label>
      </Field>
      {canEdit && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-[8px] bg-white px-4 py-2 text-[13px] font-medium leading-none text-black disabled:opacity-40"
          >
            {pending ? 'Speichere …' : 'Speichern'}
          </button>
        </div>
      )}
    </div>
  );
}

function MembersTab({
  workspaceId,
  members,
  myRole,
  myUserId,
}: {
  workspaceId: string;
  members: WorkspaceMember[];
  myRole: WorkspaceRole;
  myUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="overflow-hidden rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.06] text-left font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            <th className="px-3 py-2">Member</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Rolle</th>
            <th className="px-3 py-2">Beigetreten</th>
            <th className="px-3 py-2 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isMe = m.userId === myUserId;
            const canKickThis = canKick(myRole, m.role) && !isMe;
            const canChangeThis =
              !isMe &&
              m.role !== 'owner' &&
              canChangeRole(myRole, m.role, m.role === 'admin' ? 'member' : 'admin');
            return (
              <tr
                key={m.userId}
                className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
              >
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2.5">
                    <Avatar
                      initials={m.initials}
                      from={m.from}
                      to={m.to}
                      size={24}
                    />
                    <span className="font-medium text-ink-50">
                      {m.name} {isMe && <span className="text-ink-300">(du)</span>}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 text-ink-300">{m.email}</td>
                <td className="px-3 py-2">
                  {canChangeThis ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        start(async () => {
                          await updateMemberRole({
                            workspaceId,
                            targetUserId: m.userId,
                            newRole: v as WorkspaceRole,
                          });
                          router.refresh();
                        })
                      }
                      disabled={pending}
                    >
                      <SelectTriggerInline>
                        <span>{m.role}</span>
                      </SelectTriggerInline>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span
                      className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[10px] uppercase tracking-[0.3px]"
                      style={{
                        background:
                          m.role === 'owner'
                            ? 'rgba(255, 180, 94, 0.18)'
                            : 'rgba(255, 255, 255, 0.06)',
                        color: m.role === 'owner' ? '#ffb45e' : '#e6e7ec',
                      }}
                    >
                      {m.role}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.3px] text-ink-300">
                  {new Date(m.joinedAt).toLocaleDateString('de-DE')}
                </td>
                <td className="px-3 py-2 text-right">
                  {canKickThis && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`${m.name} wirklich entfernen?`)) return;
                        start(async () => {
                          await removeMember({ workspaceId, targetUserId: m.userId });
                          router.refresh();
                        });
                      }}
                      className="rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-ink-300 hover:border-[#ff8a8a]/30 hover:text-[#ff8a8a]"
                    >
                      Entfernen
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InvitesTab({
  invites,
  canInvite,
  onOpen,
}: {
  invites: WorkspaceInvite[];
  canInvite: boolean;
  onOpen: () => void;
}) {
  if (invites.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.01] py-12 text-center text-[13px] text-ink-300">
        Noch keine Invites.{' '}
        {canInvite && (
          <button type="button" onClick={onOpen} className="text-ink-100 underline">
            Ersten Invite erstellen
          </button>
        )}
      </div>
    );
  }
  const active = invites.filter((i) => !i.revokedAt);
  const revoked = invites.filter((i) => i.revokedAt);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
          Aktive Invites · {active.length}
        </p>
        {active.length === 0 && (
          <p className="rounded-[8px] border border-dashed border-white/[0.08] bg-white/[0.01] py-4 text-center text-[11.5px] text-ink-300">
            Keine aktiven Invites.
          </p>
        )}
        {active.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-200">
              {inv.role}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200">
              {inv.token.slice(0, 12)}…
            </span>
            {inv.email && (
              <span className="truncate font-mono text-[10px] text-ink-300">{inv.email}</span>
            )}
            <span className="font-mono text-[10px] text-ink-300">
              {inv.usedCount}
              {inv.maxUses > 0 ? `/${inv.maxUses}` : ''} used
            </span>
            {inv.expiresAt && (
              <span className="font-mono text-[10px] text-ink-300">
                bis {new Date(inv.expiresAt).toLocaleDateString('de-DE')}
              </span>
            )}
          </div>
        ))}
      </div>
      {revoked.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
            Widerrufen · {revoked.length}
          </p>
          {revoked.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.01] px-3 py-2 opacity-60"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
                {inv.role}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-300 line-through">
                {inv.token.slice(0, 12)}…
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.3px] text-[#ff8a8a]">
                widerrufen
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ activity }: { activity: WorkspaceActivityEntry[] }) {
  if (activity.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.01] py-12 text-center text-[13px] text-ink-300">
        Keine Aktivität — alles ist neu.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {activity.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2"
        >
          {a.actor && (
            <Avatar
              initials={a.actor.initials}
              from={a.actor.from}
              to={a.actor.to}
              size={22}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-ink-100">
              <span className="font-medium text-ink-50">{a.actor?.name ?? 'System'}</span>{' '}
              <span className="text-ink-300">{ACTIVITY_VERB[a.kind]}</span>
              {a.targetUser && (
                <>
                  {' · '}
                  <span className="font-medium text-ink-50">{a.targetUser.name}</span>
                </>
              )}
            </p>
            {a.payload && Object.keys(a.payload).length > 0 && (
              <p className="mt-0.5 font-mono text-[10px] text-ink-300">
                {JSON.stringify(a.payload).slice(0, 120)}
              </p>
            )}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3px] text-ink-300">
            {new Date(a.createdAt).toLocaleString('de-DE', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

function DangerTab({
  workspace,
  myRole,
  myUserId,
  members,
}: {
  workspace: Workspace;
  myRole: WorkspaceRole;
  myUserId: string;
  members: WorkspaceMember[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {myRole !== 'owner' && (
        <DangerCard
          title="Workspace verlassen"
          description="Du verlierst Zugriff auf alle Daten in diesem Workspace."
          actionLabel="Verlassen"
          danger
          onAction={() => {
            if (!confirm(`Workspace „${workspace.name}" verlassen?`)) return;
            start(async () => {
              await leaveWorkspace(workspace.id);
              router.push('/');
              router.refresh();
            });
          }}
          pending={pending}
        />
      )}
      {canTransferOwnership(myRole) && (
        <DangerCard
          title="Ownership übertragen"
          description="Mache einen anderen Member zum Owner. Du wirst zu Admin."
          actionLabel="Übertragen"
          onAction={() => setTransferOpen(true)}
        />
      )}
      {myRole === 'owner' && (
        <DangerCard
          title="Workspace archivieren"
          description="Read-only-Modus. Du kannst ihn später wieder reaktivieren."
          actionLabel="Archivieren"
          onAction={() => {
            if (!confirm(`Workspace „${workspace.name}" archivieren?`)) return;
            start(async () => {
              await archiveWorkspace(workspace.id);
              router.refresh();
            });
          }}
          pending={pending}
        />
      )}
      {canDeleteWorkspace(myRole) && (
        <DangerCard
          title="Workspace endgültig löschen"
          description="Alle Daten (Channels, Todos, Verträge, Kunden, Flotte, Termine) werden unwiderruflich gelöscht."
          actionLabel="Löschen"
          danger
          onAction={() => setDeleteOpen(true)}
        />
      )}

      {transferOpen && (
        <TransferModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          candidates={members.filter((m) => m.userId !== myUserId)}
        />
      )}

      {deleteOpen && (
        <DeleteWorkspaceModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
        />
      )}
    </div>
  );
}

function DangerCard({
  title,
  description,
  actionLabel,
  onAction,
  danger,
  pending,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  danger?: boolean;
  pending?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-[12px] border bg-white/[0.02] p-4 ${
        danger ? 'border-[#ff8a8a]/25' : 'border-white/[0.08]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className="text-[13.5px] font-medium leading-tight"
          style={{ color: danger ? '#ff8a8a' : '#e6e7ec' }}
        >
          {title}
        </p>
        <p className="mt-1 text-[12px] leading-[1.45] text-ink-300">{description}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={pending}
        className={`shrink-0 rounded-[8px] border px-3 py-1.5 text-[12px] font-medium ${
          danger
            ? 'border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.06] text-[#ff8a8a] hover:bg-[#ff8a8a]/[0.12]'
            : 'border-white/[0.08] bg-white/[0.03] text-ink-100 hover:bg-white/[0.06]'
        } disabled:opacity-40`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function TransferModal({
  open,
  onClose,
  workspaceId,
  workspaceName,
  candidates,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  candidates: WorkspaceMember[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState(candidates[0]?.userId ?? '');
  const [confirmName, setConfirmName] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Ownership"
      title="Owner-Rolle übertragen"
      maxWidth={500}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (confirmName !== workspaceName) {
            setError('Workspace-Name zur Bestätigung eintippen.');
            return;
          }
          start(async () => {
            const res = await transferOwnership({
              workspaceId,
              newOwnerId: pick,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        <p className="text-[12.5px] leading-[1.5] text-ink-300">
          Du wirst nach der Übertragung zu Admin. Der neue Owner kann den Workspace löschen.
        </p>
        <ModalField label="Neuer Owner">
          <Select value={pick} onValueChange={setPick}>
            <SelectTriggerInline>
              <span>{candidates.find((c) => c.userId === pick)?.name ?? '— wählen —'}</span>
            </SelectTriggerInline>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.userId} value={c.userId}>
                  {c.name} · {c.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ModalField>
        <ModalField
          label={`Tippe „${workspaceName}" zur Bestätigung`}
        >
          <ModalInput
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
        </ModalField>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <ModalPrimary pending={pending}>Übertragen</ModalPrimary>
        </ModalActions>
      </form>
    </Modal>
  );
}

function DeleteWorkspaceModal({
  open,
  onClose,
  workspaceId,
  workspaceName,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Endgültig löschen"
      title={`Workspace „${workspaceName}" löschen`}
      maxWidth={500}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (confirmName !== workspaceName) {
            setError('Workspace-Name zur Bestätigung eintippen.');
            return;
          }
          start(async () => {
            const res = await deleteWorkspace(workspaceId);
            if (!res.ok) {
              setError(res.error);
              return;
            }
            onClose();
            router.push('/');
            router.refresh();
          });
        }}
        className="flex flex-col gap-4"
      >
        {error && <ModalError>{error}</ModalError>}
        <div className="rounded-[10px] border border-[#ff8a8a]/30 bg-[#ff8a8a]/[0.05] p-3 text-[12.5px] text-[#ff8a8a]">
          ⚠ Unwiderruflich. Alle Daten (Channels, Todos, Verträge, Kunden, Flotte, Termine, Invites)
          werden gelöscht.
        </div>
        <ModalField label={`Tippe „${workspaceName}" zur Bestätigung`}>
          <ModalInput value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </ModalField>
        <ModalActions>
          <ModalSecondary onClick={onClose}>Abbrechen</ModalSecondary>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[8px] bg-[#ff8a8a] px-4 py-2 text-[13px] font-medium text-black disabled:opacity-40"
          >
            {pending ? 'Lösche …' : 'Endgültig löschen'}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[0.4px] text-ink-300">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-ink-300">{hint}</p>}
    </div>
  );
}
