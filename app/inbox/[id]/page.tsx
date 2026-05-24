import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { loadInboxDetailContext } from '@/lib/db/queries/inbox-detail';
import { getValidGoogleAccessToken } from '@/lib/auth/google-tokens';
import { GmailAuthError, getFullMessage, type GmailFullBody } from '@/lib/google/gmail';
import { InboxDetailClient } from './inbox-detail-client';
import { InboxContextRail } from './inbox-context-rail';

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

  const item = await db.query.inboxItems.findFirst({
    where: and(
      eq(s.inboxItems.id, id),
      eq(s.inboxItems.workspaceId, ws.id)
    ),
  });
  if (!item) notFound();

  // Parallel: full email body from Gmail + auto-link rails from DB.
  // The body fetch is the slow path (~200-400ms round-trip); the
  // context queries usually return in <50ms. Promise.all keeps the
  // page TTFB at body-fetch latency, not the sum of both.
  const [body, context] = await Promise.all([
    fetchBody(user.id, item.sourceType, item.sourceId).catch(() => null),
    loadInboxDetailContext(ws.id, item.id, item.senderEmail),
  ]);

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
          }}
          body={body}
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
