import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { loadInboxDetailContext, resolveSyncedGmailIds } from '@/lib/db/queries/inbox-detail';
import { getValidGoogleAccessToken, getGoogleConnection } from '@/lib/auth/google-tokens';
import {
  GmailAuthError,
  getFullMessage,
  listThreadMessages,
  type GmailFullBody,
  type GmailThreadMessage,
} from '@/lib/google/gmail';
import { isSenderTaggedForUser } from '@/lib/db/queries/clients';
import { InboxDetailClient } from './inbox-detail-client';
import { InboxContextRail } from './inbox-context-rail';
import { ThreadStrip, type ThreadRow } from './thread-strip';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/inbox/${id}`);
  const ws = await requireCurrentWorkspace();
  const db = getDb();

  // userId filter ensures a member in a shared workspace can't open
  // another member's mail by URL-guessing the id.
  const item = await db.query.inboxItems.findFirst({
    where: and(
      eq(s.inboxItems.id, id),
      eq(s.inboxItems.workspaceId, ws.id),
      eq(s.inboxItems.userId, user.id)
    ),
  });
  if (!item) notFound();

  // Parallel: full email body from Gmail + auto-link rails from DB +
  // thread metadata. Body is the slow path (~200-400ms); context and
  // thread land in <50ms each. Promise.all keeps TTFB at the body
  // fetch's latency, not the sum.
  const [body, context, threadMessages, senderTagged] = await Promise.all([
    fetchBody(user.id, item.sourceType, item.sourceId).catch(() => null),
    loadInboxDetailContext(ws.id, user.id, item.id, item.senderEmail),
    fetchThread(user.id, item.sourceType, item.sourceThreadId).catch(
      () => [] as GmailThreadMessage[]
    ),
    isSenderTaggedForUser(ws.id, user.id, item.senderEmail).catch(() => false),
  ]);

  // Resolve thread message ids to local inbox rows so each row can
  // link into our own /inbox/[id] route where possible.
  const idMap = await resolveSyncedGmailIds(
    ws.id,
    user.id,
    threadMessages.map((t) => t.id)
  ).catch(() => new Map<string, string>());

  // Whether replying-by-send is unlocked (gmail.send granted). Drives the
  // reply panel: "Senden" vs. a just-in-time consent link.
  const canSend = await getGoogleConnection(user.id)
    .then((c) => !!c && c.scopes.includes('https://www.googleapis.com/auth/gmail.send'))
    .catch(() => false);

  const threadRows: ThreadRow[] = threadMessages
    .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    .map((t) => ({
      gmailId: t.id,
      localId: idMap.get(t.id) ?? null,
      from: t.from,
      snippet: t.snippet,
      receivedAt: t.receivedAt.toISOString(),
      isRead: t.isRead,
      isCurrent: t.id === item.sourceId,
    }));

  return (
    <div className="mx-auto flex w-full max-w-[1200px] gap-8 px-4 pb-32 pt-24 md:px-6">
      <main className="min-w-0 flex-1">
        <InboxDetailClient
          item={{
            id: item.id,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
            senderName: item.senderName,
            senderEmail: item.senderEmail,
            subject: item.subject,
            receivedAt: new Date(item.receivedAt).toISOString(),
            isRead: item.isRead,
            preview: item.preview,
            direction: item.direction,
          }}
          body={body}
          canSend={canSend}
          alreadyCustomer={context.customer != null}
          senderTagged={senderTagged}
          threadStrip={
            threadRows.length > 1 ? (
              <ThreadStrip rows={threadRows} threadId={item.sourceThreadId ?? null} />
            ) : null
          }
        />
      </main>
      <aside className="hidden w-[340px] shrink-0 lg:block">
        <InboxContextRail context={context} />
      </aside>
    </div>
  );
}

async function fetchBody(
  userId: string,
  sourceType: string,
  sourceId: string
): Promise<GmailFullBody | null> {
  if (sourceType !== 'email_gmail') return null;
  const token = await getValidGoogleAccessToken(userId);
  if (!token) return null;
  try {
    return await getFullMessage(token, sourceId);
  } catch (e) {
    // Auth error → token got revoked between auth and fetch. Let the
    // client render the metadata-only fallback.
    if (e instanceof GmailAuthError) return null;
    throw e;
  }
}

async function fetchThread(
  userId: string,
  sourceType: string,
  threadId: string | null
): Promise<GmailThreadMessage[]> {
  if (sourceType !== 'email_gmail' || !threadId) return [];
  const token = await getValidGoogleAccessToken(userId);
  if (!token) return [];
  try {
    return await listThreadMessages(token, threadId);
  } catch (e) {
    if (e instanceof GmailAuthError) return [];
    throw e;
  }
}
