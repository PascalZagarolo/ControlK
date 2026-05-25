import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { triggerEvent } from '@/lib/realtime/pusher-server';

/**
 * Inbound email webhook — receives parsed emails from an external provider
 * (e.g. Resend Inbound, Cloudmailin, Postmark Inbound) and turns them into
 * channel messages.
 *
 * Routing convention:
 *   Recipient address pattern: `<channelSlug>.<workspaceSlug>@<your-domain>`
 *   Example: `flotte.muller-vermietung@inbox.urent.app`
 *   → Message lands in channel #flotte of workspace muller-vermietung.
 *
 * Customer linking:
 *   If the From address matches any `customer_contacts.email`, the message
 *   author is set to the workspace owner but the body is prefixed with the
 *   contact's display info so it's clear it came from outside.
 *
 * Security:
 *   - Provider must POST with HMAC-SHA256 signature in `x-urent-signature`
 *     header, using the shared secret env var INBOUND_EMAIL_SECRET.
 *   - If the env var is not set, the route refuses all requests (503).
 *
 * Expected JSON payload (provider-agnostic shape):
 *   { from: string, to: string, subject?: string, text?: string, html?: string }
 *
 * For Resend Inbound, the native payload shape is similar — adapt the field
 * mapping in `parsePayload` below if your provider differs.
 */

type ParsedEmail = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

function parsePayload(raw: any): ParsedEmail | null {
  if (!raw || typeof raw !== 'object') return null;
  const from = String(raw.from ?? raw.From ?? raw.envelope?.from ?? '').trim();
  const to = String(raw.to ?? raw.To ?? raw.envelope?.to ?? '').trim();
  const subject = String(raw.subject ?? raw.Subject ?? '').trim();
  const text = String(raw.text ?? raw.TextBody ?? raw.body?.text ?? '').trim();
  if (!from || !to || (!text && !subject)) return null;
  return { from, to, subject, text };
}

function extractAddress(field: string): string {
  // "Name <addr@host>" → "addr@host"; pure "addr@host" → unchanged
  const m = field.match(/<([^>]+)>/);
  return (m ? m[1] : field).trim().toLowerCase();
}

function parseRecipient(addr: string): { channelSlug: string; workspaceSlug: string } | null {
  const local = addr.split('@')[0];
  if (!local) return null;
  // channelSlug.workspaceSlug  → split on the LAST dot
  const idx = local.lastIndexOf('.');
  if (idx <= 0 || idx >= local.length - 1) return null;
  const channelSlug = local.slice(0, idx).toLowerCase();
  const workspaceSlug = local.slice(idx + 1).toLowerCase();
  return { channelSlug, workspaceSlug };
}

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) return false;
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!process.env.INBOUND_EMAIL_SECRET) {
    return new NextResponse('Inbound email not configured', { status: 503 });
  }

  const raw = await req.text();
  const sig = req.headers.get('x-urent-signature');
  if (!verifySignature(raw, sig)) {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  let payload: ParsedEmail | null;
  try {
    payload = parsePayload(JSON.parse(raw));
  } catch {
    return new NextResponse('Bad JSON', { status: 400 });
  }
  if (!payload) return new NextResponse('Unparseable payload', { status: 400 });

  const recipient = parseRecipient(extractAddress(payload.to));
  if (!recipient) {
    return NextResponse.json({ accepted: false, reason: 'unroutable-recipient' });
  }

  const db = getDb();
  const workspace = await db.query.workspaces.findFirst({
    where: eq(s.workspaces.slug, recipient.workspaceSlug),
  });
  if (!workspace) {
    return NextResponse.json({ accepted: false, reason: 'workspace-not-found' });
  }

  const channel = await db.query.channels.findFirst({
    where: and(
      eq(s.channels.workspaceId, workspace.id),
      eq(s.channels.slug, recipient.channelSlug)
    ),
  });
  if (!channel) {
    return NextResponse.json({ accepted: false, reason: 'channel-not-found' });
  }

  // Match the From-address to a known customer contact (best-effort)
  const fromAddr = extractAddress(payload.from);
  const contact = await db.query.customerContacts.findFirst({
    where: eq(s.customerContacts.email, fromAddr),
    with: { customer: true },
  });
  const knownContactInWs =
    contact?.customer?.workspaceId === workspace.id ? contact : null;

  const senderLabel = knownContactInWs
    ? `📨 ${knownContactInWs.name} (${knownContactInWs.customer.name})`
    : `📨 ${payload.from}`;

  const body = [
    `${senderLabel}`,
    payload.subject ? `**${payload.subject}**` : '',
    '',
    payload.text || '(kein Text-Body)',
  ]
    .filter(Boolean)
    .join('\n');

  const [msg] = await db
    .insert(s.messages)
    .values({
      channelId: channel.id,
      authorId: workspace.ownerId, // surrogate author — provider-agnostic
      body,
    })
    .returning();

  // Best-effort live refresh for connected clients
  try {
    await triggerEvent(`private-channel-${channel.id}`, 'message.new', {
      id: msg.id,
      source: 'email-inbound',
    });
  } catch {}

  return NextResponse.json({
    accepted: true,
    channel: channel.slug,
    workspace: workspace.slug,
    matchedCustomer: knownContactInWs?.customer?.id ?? null,
  });
}
