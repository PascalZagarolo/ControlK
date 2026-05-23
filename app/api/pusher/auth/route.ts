import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { authorizeChannel, pusherEnabled } from '@/lib/realtime/pusher-server';

export async function POST(request: Request) {
  if (!pusherEnabled()) return new NextResponse('Pusher not configured', { status: 503 });
  const user = await currentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const body = await request.formData();
  const socketId = String(body.get('socket_id') ?? '');
  const channel = String(body.get('channel_name') ?? '');
  if (!socketId || !channel) return new NextResponse('Bad request', { status: 400 });

  // Presence channels need user identity
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

  // Private channels just need auth
  if (channel.startsWith('private-')) {
    const auth = authorizeChannel(socketId, channel);
    if (!auth) return new NextResponse('Pusher init failed', { status: 500 });
    return NextResponse.json(auth);
  }

  // Public channels don't need auth — Pusher shouldn't be hitting this.
  return new NextResponse('Not a private/presence channel', { status: 400 });
}
