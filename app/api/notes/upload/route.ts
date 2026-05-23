import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { getCurrentWorkspace } from '@/lib/db/current-workspace';
import { uploadBlob } from '@/lib/blob/upload';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Upload endpoint for note attachments — currently scoped to images. Wraps
 * Vercel Blob with auth + workspace-scoping. Returns { url } on success.
 *
 * Used as `editor.uploadFile` by BlockNote, which lets users paste/drop
 * images directly into the editor and reference them by public URL.
 *
 * Disabled with 503 if BLOB_READ_WRITE_TOKEN is not configured.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  const ws = await getCurrentWorkspace();
  if (!ws) return new NextResponse('No workspace', { status: 400 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no-file' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'mime-not-allowed' }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'too-large' }, { status: 413 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const path = `notes/${ws.id}/${user.id}/${Date.now()}.${ext}`;

  const result = await uploadBlob(path, file, {
    contentType: file.type,
    access: 'public',
  });
  if (!result) {
    return NextResponse.json({ error: 'blob-not-configured' }, { status: 503 });
  }

  return NextResponse.json({ url: result.url });
}
