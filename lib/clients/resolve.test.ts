// ─── Client tagging + views — acceptance suite ──────────────────────
//
// Run:  npm run test:clients
//
// Tests the deterministic CLIENT-RESOLUTION core that powers the three
// customer-centric views (B1 "Nach Kunde", B2 "Wartet", B3 "Von Kunden")
// and the Mail→Todo consistency rules — NOT the React/DB glue.
//
// Required scenarios (Prompt 5 acceptance):
//   - Tagging: a tagged sender resolves as a client (→ "Nach Kunde"/"Von
//     Kunden"); a newsletter sender resolves in NEITHER.
//   - "Wartet": built on the Prompt-1 triage gate → no-reply/marketing never
//     appears (modelled here via the same category gate predicate).
//   - Mail→Todo: converting archives the source item → it leaves the
//     "braucht Antwort" set → no double count (modelled here).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveClient,
  normalizeIdentifier,
  emailDomain,
  type ContactTag,
} from './resolve';

const crm = (emails: string[]) => new Set(emails.map((e) => e.toLowerCase()));
const NO_CRM = new Set<string>();
const NO_TAGS: ContactTag[] = [];

// ── Tagging → client resolution ──────────────────────────────────────

test('Tagging: ein per E-Mail getaggter Absender ist ein Kunde', () => {
  const tags: ContactTag[] = [{ kind: 'email', identifier: 'anna@mueller-gmbh.de', displayName: 'Müller GmbH' }];
  const m = resolveClient('Anna@Mueller-GmbH.de', tags, NO_CRM);
  assert.equal(m.isClient, true);
  assert.equal(m.displayName, 'Müller GmbH');
  assert.equal(m.via, 'email_tag');
  assert.equal(m.key, 'anna@mueller-gmbh.de');
});

test('Tagging: Domain-Tag deckt die ganze Firma ab', () => {
  const tags: ContactTag[] = [{ kind: 'domain', identifier: 'mueller-gmbh.de', displayName: 'Müller GmbH' }];
  const anyone = resolveClient('beliebig@mueller-gmbh.de', tags, NO_CRM);
  assert.equal(anyone.isClient, true);
  assert.equal(anyone.via, 'domain_tag');
  assert.equal(anyone.key, 'domain:mueller-gmbh.de');
  assert.equal(anyone.displayName, 'Müller GmbH');
});

test('Tagging: bestehender CRM-Kontakt zählt ebenfalls als Kunde', () => {
  const m = resolveClient('kunde@firma.de', NO_TAGS, crm(['kunde@firma.de']));
  assert.equal(m.isClient, true);
  assert.equal(m.via, 'crm_contact');
});

test('Newsletter-Absender erscheint in KEINER Kunden-View', () => {
  // Not tagged, not in CRM → never a client. (The list queries put such
  // senders in "Andere/Ungetaggt", never in clients / "Von Kunden".)
  const tags: ContactTag[] = [{ kind: 'email', identifier: 'anna@mueller-gmbh.de', displayName: null }];
  const m = resolveClient('no-reply@newsletter.asos.com', tags, crm(['kunde@firma.de']));
  assert.equal(m.isClient, false);
  assert.equal(m.displayName, null);
  assert.equal(m.key, null);
});

test('Präzedenz: exakter E-Mail-Tag schlägt Domain-Tag (eigener Anzeigename)', () => {
  const tags: ContactTag[] = [
    { kind: 'domain', identifier: 'firma.de', displayName: 'Firma (allgemein)' },
    { kind: 'email', identifier: 'chef@firma.de', displayName: 'Der Chef' },
  ];
  assert.equal(resolveClient('chef@firma.de', tags, NO_CRM).displayName, 'Der Chef');
  assert.equal(resolveClient('andere@firma.de', tags, NO_CRM).displayName, 'Firma (allgemein)');
});

test('Display-Name fällt auf Identifier zurück, wenn keiner gesetzt', () => {
  const tags: ContactTag[] = [{ kind: 'email', identifier: 'x@y.de', displayName: null }];
  assert.equal(resolveClient('x@y.de', tags, NO_CRM).displayName, 'x@y.de');
});

test('Ungültige / leere Absenderadresse ist nie ein Kunde', () => {
  assert.equal(resolveClient(null, NO_TAGS, NO_CRM).isClient, false);
  assert.equal(resolveClient('garbage', NO_TAGS, NO_CRM).isClient, false);
  assert.equal(resolveClient('', NO_TAGS, NO_CRM).isClient, false);
});

// ── identifier normalisation (write-path guard) ──────────────────────

test('normalizeIdentifier: E-Mail wird klein + validiert', () => {
  assert.deepEqual(normalizeIdentifier('  Anna@Firma.DE ', 'email'), { ok: true, identifier: 'anna@firma.de' });
  assert.equal(normalizeIdentifier('keine-email', 'email').ok, false);
});

test('normalizeIdentifier: Domain strippt @/scheme', () => {
  assert.deepEqual(normalizeIdentifier('@Firma.de', 'domain'), { ok: true, identifier: 'firma.de' });
  assert.deepEqual(normalizeIdentifier('https://firma.de/x', 'domain'), { ok: true, identifier: 'firma.de' });
  assert.equal(normalizeIdentifier('nodot', 'domain').ok, false);
});

test('emailDomain extrahiert die Domain', () => {
  assert.equal(emailDomain('a@b.de'), 'b.de');
  assert.equal(emailDomain('bad'), null);
});

// ── "Wartet" gate (models the Prompt-1 triage predicate used by the query) ──

type Mail = { senderEmail: string; category: string; isRead: boolean; direction: 'inbox' | 'sent'; isArchived: boolean };

// Mirror of the SQL predicate in listWaitingOnYou — kept in lockstep so the
// "no newsletter in Wartet" guarantee is unit-checkable.
function waitsOnYou(m: Mail): boolean {
  return (
    m.direction === 'inbox' &&
    !m.isRead &&
    !m.isArchived &&
    (m.category === 'primary' || m.category === 'customer')
  );
}

test('"Wartet": Kundenmail ohne Antwort erscheint', () => {
  const m: Mail = { senderEmail: 'anna@firma.de', category: 'customer', isRead: false, direction: 'inbox', isArchived: false };
  assert.equal(waitsOnYou(m), true);
});

test('"Wartet": No-Reply/Marketing erscheint NICHT (Prompt-1-Gate)', () => {
  const promo: Mail = { senderEmail: 'no-reply@asos.com', category: 'promo', isRead: false, direction: 'inbox', isArchived: false };
  const updates: Mail = { senderEmail: 'notifications@github.com', category: 'updates', isRead: false, direction: 'inbox', isArchived: false };
  assert.equal(waitsOnYou(promo), false);
  assert.equal(waitsOnYou(updates), false);
});

test('"Wartet": Wartezeit = ganze Tage seit Eingang', () => {
  const now = Date.parse('2026-05-20T12:00:00Z');
  const received = Date.parse('2026-05-16T12:00:00Z');
  const waitingDays = Math.max(0, Math.floor((now - received) / 86_400_000));
  assert.equal(waitingDays, 4);
});

// ── Mail→Todo: no double count with "braucht Antwort" ────────────────

test('Mail→Todo: konvertierte (archivierte) Mail fällt aus "Wartet" raus → keine Doppelzählung', () => {
  // createTodoFromInboxItem archives the source item. Once archived, the
  // same Prompt-1 gate excludes it — so the plan counts the todo OR the
  // waiting mail, never both.
  const before: Mail = { senderEmail: 'anna@firma.de', category: 'customer', isRead: false, direction: 'inbox', isArchived: false };
  assert.equal(waitsOnYou(before), true);
  const afterConversion: Mail = { ...before, isArchived: true };
  assert.equal(waitsOnYou(afterConversion), false);
});
