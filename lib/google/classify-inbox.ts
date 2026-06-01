import 'server-only';

import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import type { ParsedGmailMessage } from './gmail';
import { triageMessage } from '@/lib/triage/classify';
import { noiseToInboxCategory } from '@/lib/triage/inbox-mapping';
import type { TriageInput } from '@/lib/triage/types';

// Domains that always classify as "shipping" regardless of Gmail's
// own label. Covers the German top-five carriers + Amazon's logistics
// notifications. Kept short on purpose — long dictionaries rot fast.
const SHIPPING_DOMAINS = new Set<string>([
  'dhl.de',
  'dhl.com',
  'dpd.com',
  'dpd.de',
  'hermesworld.com',
  'myhermes.de',
  'ups.com',
  'fedex.com',
  'gls-info.de',
  'gls-pakete.de',
  'amazon.de', // shipping notifications come from amazon.de itself
  'amazon.com',
  'paketda.de',
]);

export type InboxCategory =
  | 'primary'
  | 'customer'
  | 'shipping'
  | 'promo'
  | 'social'
  | 'updates'
  | 'forums';

/**
 * Classifies one message into a single bucket. Priority is fixed by
 * how confident each signal is:
 *
 *   1. Customer match — most confident (DB-backed relationship).
 *   2. Shipping domain — strong, deterministic dictionary.
 *   3. Noise triage — header/sender/domain rules (lib/triage). Catches
 *      the bulk/automated mail Gmail's own labels miss (Chrono24, GitHub
 *      notifications, CI runs, ASOS, …) BEFORE it falls through to the
 *      answer-required 'primary' bucket. Header signals outrank Gmail's
 *      ML label, so this runs first.
 *   4. Gmail's CATEGORY_* — Gmail's own ML, useful when present.
 *   5. 'primary' — the catch-all (answer-required).
 *
 * Customer beats everything intentionally: a customer's marketing
 * newsletter is still customer-relevant, and surfacing it in the wrong
 * bucket costs more than a few extra customer-row clicks. (Customer match
 * is by exact contact email, so bulk senders never match it anyway.)
 */
export function classifyMessage(
  message: ParsedGmailMessage,
  isCustomerSender: boolean
): InboxCategory {
  if (isCustomerSender) return 'customer';

  const domain = domainOf(message.senderEmail);
  if (domain && SHIPPING_DOMAINS.has(domain)) return 'shipping';

  const triage = triageMessage(toTriageInput(message));
  if (triage.isNoise) return noiseToInboxCategory(triage.category);

  if (message.gmailCategory) return message.gmailCategory;
  return 'primary';
}

// Maps the synced message onto the minimal slice the triage pipeline
// needs (incl. the RFC822 signal headers now captured by getMessageMetadata).
function toTriageInput(message: ParsedGmailMessage): TriageInput {
  return {
    senderEmail: message.senderEmail,
    senderName: message.senderName,
    subject: message.subject,
    headers: {
      listUnsubscribe: message.listUnsubscribe,
      listId: message.listId,
      precedence: message.precedence,
      autoSubmitted: message.autoSubmitted,
      returnPath: message.returnPath,
    },
  };
}

export function domainOf(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

/**
 * Look up which sender emails in this batch belong to customers in
 * the workspace. Returns a Set of lowercased emails so the caller
 * can do constant-time per-message lookups during the classify loop.
 *
 * One IN-query — cheap even with hundreds of new messages per sync.
 */
export async function resolveCustomerSenders(
  workspaceId: string,
  senderEmails: string[]
): Promise<Set<string>> {
  const cleaned = Array.from(
    new Set(
      senderEmails
        .filter((e): e is string => !!e)
        .map((e) => e.toLowerCase())
    )
  );
  if (cleaned.length === 0) return new Set();
  const db = getDb();
  const rows = await db
    .select({
      email: sql<string>`lower(${s.customerContacts.email})`,
    })
    .from(s.customerContacts)
    .innerJoin(s.customers, eq(s.customers.id, s.customerContacts.customerId))
    .where(
      and(
        eq(s.customers.workspaceId, workspaceId),
        sql`lower(${s.customerContacts.email}) in (${sql.join(
          cleaned.map((e) => sql`${e}`),
          sql`, `
        )})`
      )
    );
  return new Set(rows.map((r) => r.email));
}
