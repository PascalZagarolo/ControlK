import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { currentUser } from '@/lib/auth/current-user';
import { authorizeChannel, pusherEnabled } from '@/lib/realtime/pusher-server';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';

/**
 * Membership-gated Pusher channel auth.
 *
 * Pusher uses this endpoint to authorise subscriptions to `private-*` and
 * `presence-*` channels. The endpoint MUST verify that the requesting user
 * has actual access to whatever the channel represents — otherwise any
 * logged-in user could subscribe to another workspace's realtime stream.
 *
 * Supported channel name patterns:
 *
 *   private-channel-{channelId}                    — channel messages, reactions
 *   private-channel-{channelId}-anything           — reserved namespace, channel-scoped
 *   private-workspace-{workspaceId}-todos          — workspace-scoped todo events
 *   private-workspace-{workspaceId}-anything       — reserved namespace, workspace-scoped
 *   presence-channel-{channelId}                   — presence (members in channel)
 *   presence-channel-{channelId}-typing            — presence typing indicator
 *
 * Anything else returns 400. Drift in channel-naming is fail-closed, not
 * fail-open: if you add a new pattern, register it here AND add the
 * corresponding membership check.
 */

type AccessCheck =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 404 | 400; reason: string };

async function resolveAccess(
  userId: string,
  channelName: string
): Promise<AccessCheck> {
  const db = getDb();

  // Strip leading prefix so the resource pattern matching is uniform.
  // We've already filtered for private-/presence- in the caller.
  const stripped = channelName.replace(/^(private-|presence-)/, '');

  // Channel-scoped: "channel-{uuid}" or "channel-{uuid}-{suffix}"
  const channelMatch = stripped.match(
    /^channel-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(-.*)?$/i
  );
  if (channelMatch) {
    const channelId = channelMatch[1];
    const channel = await db.query.channels.findFirst({
      where: eq(s.channels.id, channelId),
      columns: { workspaceId: true },
    });
    if (!channel) return { ok: false, status: 404, reason: 'channel not found' };
    const member = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(s.workspaceMembers.workspaceId, channel.workspaceId),
        eq(s.workspaceMembers.userId, userId)
      ),
      columns: { role: true },
    });
    if (!member) return { ok: false, status: 403, reason: 'not a workspace member' };
    return { ok: true };
  }

  // Workspace-scoped: "workspace-{uuid}-{suffix}"
  const workspaceMatch = stripped.match(
    /^workspace-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(-.*)?$/i
  );
  if (workspaceMatch) {
    const workspaceId = workspaceMatch[1];
    const member = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(s.workspaceMembers.workspaceId, workspaceId),
        eq(s.workspaceMembers.userId, userId)
      ),
      columns: { role: true },
    });
    if (!member) return { ok: false, status: 403, reason: 'not a workspace member' };
    return { ok: true };
  }

  // Unrecognised pattern. Fail-closed.
  return { ok: false, status: 400, reason: 'unknown channel pattern' };
}

export async function POST(request: Request) {
  if (!pusherEnabled()) return new NextResponse('Pusher not configured', { status: 503 });
  const user = await currentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const body = await request.formData();
  const socketId = String(body.get('socket_id') ?? '');
  const channel = String(body.get('channel_name') ?? '');
  if (!socketId || !channel) return new NextResponse('Bad request', { status: 400 });

  // Public channels shouldn't be hitting this endpoint at all — Pusher only
  // calls it for private-/presence-. Reject so we never accidentally grant
  // access to something we don't gate.
  if (!channel.startsWith('private-') && !channel.startsWith('presence-')) {
    return new NextResponse('Not a private/presence channel', { status: 400 });
  }

  const access = await resolveAccess(user.id, channel);
  if (!access.ok) {
    return new NextResponse(access.reason, { status: access.status });
  }

  // Presence channels need user identity; private channels just need auth.
  if (channel.startsWith('presence-')) {
    const auth = authorizeChannel(socketId, channel, {
      user_id: user.id,
      user_info: {
        name: user.name,
        initials: user.initials,
        from: user.avatarFrom,
        to: user.avatarTo,
      },
    });
    if (!auth) return new NextResponse('Pusher init failed', { status: 500 });
    return NextResponse.json(auth);
  }

  const auth = authorizeChannel(socketId, channel);
  if (!auth) return new NextResponse('Pusher init failed', { status: 500 });
  return NextResponse.json(auth);
}
