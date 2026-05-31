import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { AIPanel } from '@/components/notes/ai-panel';
import { NoteEditorSkeleton } from '@/components/notes/note-editor-skeleton';
import { FreshGate } from './fresh-gate';
import { ExistingNoteBody } from './existing-note-body';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?from=/notes/${id}`);
  const ws = await requireCurrentWorkspace();

  const workspaceScope = (ws as any).scope === 'private' ? 'private' : 'business';
  const aiEnabled = !!(process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-32 pt-28 md:px-6">
      <AIPanel enabled={aiEnabled} />

      {/* FreshGate (client) decides instantly: a just-created note opens with
          an empty editor immediately; any other id falls through to the
          server-streamed existing body below. */}
      <FreshGate noteId={id} workspaceScope={workspaceScope}>
        <Suspense fallback={<NoteEditorSkeleton />}>
          <ExistingNoteBody
            workspaceId={ws.id}
            userId={user.id}
            noteId={id}
            workspaceScope={workspaceScope}
          />
        </Suspense>
      </FreshGate>
    </div>
  );
}
