// ─── Client resolution — pure, testable core ────────────────────────
//
// Given a sender address and the user's known client signals (lightweight
// contact_tags + the workspace CRM contact emails), decide whether the
// sender is a CLIENT and what to call them. No DB, no `server-only` — so the
// "tagged sender shows as client / newsletter never does" rules are unit-
// testable (resolve.test.ts).
//
// Matching precedence (most specific wins):
//   1. exact email tag
//   2. CRM contact email (existing customers/customerContacts)
//   3. domain tag
// A sender with no match is NOT a client (→ "Andere/Ungetaggt"). We never
// guess — only explicit signals count.

export type ContactTag = {
  kind: 'email' | 'domain';
  identifier: string; // lowercased email or domain
  displayName: string | null;
};

export type ClientMatch = {
  isClient: boolean;
  /** Display label when a client; null otherwise. */
  displayName: string | null;
  /** How the match was made — for explainability / debugging. */
  via: 'email_tag' | 'crm_contact' | 'domain_tag' | null;
  /** Stable grouping key (the matched identifier) — clients group by this. */
  key: string | null;
};

const NOT_A_CLIENT: ClientMatch = { isClient: false, displayName: null, via: null, key: null };

export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase().trim() || null;
}

function normEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e.includes('@') ? e : null;
}

/**
 * Resolve one sender against the user's client signals.
 *
 * @param senderEmail raw sender address (any case)
 * @param tags        the user's contact_tags (email + domain)
 * @param crmEmails   lowercased emails known to the workspace CRM
 */
export function resolveClient(
  senderEmail: string | null | undefined,
  tags: ContactTag[],
  crmEmails: ReadonlySet<string>
): ClientMatch {
  const email = normEmail(senderEmail);
  if (!email) return NOT_A_CLIENT;
  const domain = emailDomain(email);

  // 1. Exact email tag (most specific).
  const emailTag = tags.find((t) => t.kind === 'email' && t.identifier === email);
  if (emailTag) {
    return {
      isClient: true,
      displayName: emailTag.displayName?.trim() || email,
      via: 'email_tag',
      key: email,
    };
  }

  // 2. CRM contact email (existing customer link).
  if (crmEmails.has(email)) {
    return { isClient: true, displayName: null, via: 'crm_contact', key: email };
  }

  // 3. Domain tag (covers a whole company).
  if (domain) {
    const domainTag = tags.find((t) => t.kind === 'domain' && t.identifier === domain);
    if (domainTag) {
      return {
        isClient: true,
        displayName: domainTag.displayName?.trim() || domain,
        via: 'domain_tag',
        key: `domain:${domain}`,
      };
    }
  }

  return NOT_A_CLIENT;
}

/**
 * Validate + normalise a tag identifier the user typed. Returns the cleaned
 * value + inferred kind, or an error string. Used by the tag action so the
 * (one-tap) write path and the resolver agree on normalisation.
 */
export function normalizeIdentifier(
  raw: string,
  kind: 'email' | 'domain'
): { ok: true; identifier: string } | { ok: false; error: string } {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return { ok: false, error: 'Leer.' };
  if (kind === 'email') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return { ok: false, error: 'Keine gültige E-Mail.' };
    return { ok: true, identifier: v };
  }
  // domain: strip a leading @ or scheme, keep the bare host.
  const d = v.replace(/^@/, '').replace(/^https?:\/\//, '').split('/')[0];
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return { ok: false, error: 'Keine gültige Domain.' };
  return { ok: true, identifier: d };
}
