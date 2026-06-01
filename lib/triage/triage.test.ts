// ─── Inbox noise-triage: acceptance tests ───────────────────────────
//
// Run:  npm run test:triage
//
// The real-world misclassifications from production (Chrono24, GitHub
// notification, CI run, ASOS, Temu, mydealz, Lieferando, REWE, Resend,
// Bitly) MUST classify as noise (NOT answer-required). A handful of
// genuine business mails MUST survive as reply candidates.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { triageMessage } from './classify';
import type { TriageInput, TriageNoiseCategory } from './types';
import {
  ANSWER_REQUIRED_CATEGORIES,
  noiseToInboxCategory,
} from './inbox-mapping';

// ── Fixtures: real noise (must be filtered out) ──────────────────────

type NoiseFixture = {
  name: string;
  input: TriageInput;
  /** Optional: assert the detected sub-category where the signal is clear. */
  category?: TriageNoiseCategory;
};

const NOISE_FIXTURES: NoiseFixture[] = [
  {
    name: 'Chrono24 promo ("Alle Zeiger stehen auf Gold")',
    category: 'marketing',
    input: {
      senderEmail: 'no-reply@newsletter.chrono24.com',
      senderName: 'Chrono24',
      subject: 'Alle Zeiger stehen auf Gold',
      headers: { listUnsubscribe: '<https://chrono24.com/unsubscribe?x=1>' },
    },
  },
  {
    name: 'GitHub notification ("A Google identity was just linked")',
    category: 'notification',
    input: {
      senderEmail: 'notifications@github.com',
      senderName: 'GitHub',
      subject: '[GitHub] A Google identity was just linked to your account',
    },
  },
  {
    name: 'GitHub Actions CI ("Run failed: Build")',
    category: 'notification',
    input: {
      senderEmail: 'notifications@github.com',
      senderName: 'GitHub Actions',
      subject: '[acme/web] Run failed: Build · main',
    },
  },
  {
    name: 'Resend product newsletter (List-Unsubscribe)',
    input: {
      senderEmail: 'updates@resend.com',
      senderName: 'Resend',
      subject: 'New in Resend: Broadcasts',
      headers: { listUnsubscribe: '<mailto:unsub@resend.com>' },
    },
  },
  {
    name: 'Bitly product newsletter (noreply + List-Unsubscribe)',
    input: {
      senderEmail: 'noreply@bitly.com',
      senderName: 'Bitly',
      subject: 'Your monthly link performance',
      headers: { listUnsubscribe: '<https://bitly.com/unsub>' },
    },
  },
  {
    name: 'ASOS marketing (Precedence: bulk)',
    category: 'marketing',
    input: {
      senderEmail: 'no-reply@asos.com',
      senderName: 'ASOS',
      subject: 'SALE: bis zu 70% reduziert',
      headers: { precedence: 'bulk', listUnsubscribe: '<https://asos.com/u>' },
    },
  },
  {
    name: 'Temu marketing (List-Unsubscribe)',
    input: {
      senderEmail: 'no-reply@temu.com',
      senderName: 'Temu',
      subject: 'Kostenloser Versand nur heute',
      headers: { listUnsubscribe: '<https://temu.com/u>' },
    },
  },
  {
    // No headers, no no-reply localpart → must be caught by the DOMAIN list.
    name: 'mydealz (domain-only signal, no headers)',
    category: 'marketing',
    input: {
      senderEmail: 'team@mydealz.de',
      senderName: 'mydealz',
      subject: 'Deine Top-Deals der Woche',
    },
  },
  {
    name: 'Lieferando marketing (noreply + List-Unsubscribe)',
    input: {
      senderEmail: 'noreply@lieferando.de',
      senderName: 'Lieferando',
      subject: '20% auf deine nächste Bestellung',
      headers: { listUnsubscribe: '<https://lieferando.de/u>' },
    },
  },
  {
    // No headers, generic localpart → must be caught by the DOMAIN list.
    name: 'REWE marketing (domain-only signal)',
    category: 'marketing',
    input: {
      senderEmail: 'angebote@rewe.de',
      senderName: 'REWE',
      subject: 'Die Angebote der Woche',
    },
  },
  {
    name: 'Freelancermap job broadcast',
    category: 'job_broadcast',
    input: {
      senderEmail: 'projekte@freelancermap.com',
      senderName: 'freelancermap',
      subject: 'Neue Projekte passend zu deinem Profil',
    },
  },
  {
    // Unknown SaaS domain → only the Auto-Submitted header gives it away.
    name: 'Generic automated mail (Auto-Submitted on unknown domain)',
    category: 'notification',
    input: {
      senderEmail: 'system@some-random-saas.io',
      senderName: 'Some SaaS',
      subject: 'Your weekly digest',
      headers: { autoSubmitted: 'auto-generated' },
    },
  },
  {
    name: 'Bounce / mailer-daemon',
    category: 'transactional',
    input: {
      senderEmail: 'mailer-daemon@mx.google.com',
      senderName: 'Mail Delivery Subsystem',
      subject: 'Delivery Status Notification (Failure)',
    },
  },
];

// ── Fixtures: genuine business mail (must reach "needs reply") ───────

const HUMAN_FIXTURES: { name: string; input: TriageInput }[] = [
  {
    name: 'Customer asks a concrete question',
    input: {
      senderEmail: 'anna.hoffmann@spedition-nord.de',
      senderName: 'Anna Hoffmann',
      subject: 'Rückfrage zu Ihrem Angebot — können Sie bis Freitag liefern?',
    },
  },
  {
    name: 'New prospect inquiry',
    input: {
      senderEmail: 'thomas@bau-mueller.de',
      senderName: 'Thomas Müller',
      subject: 'Anfrage Transporter-Miete nächste Woche',
    },
  },
  {
    name: 'Colleague reply in a thread',
    input: {
      senderEmail: 'lisa@meinefirma.de',
      senderName: 'Lisa Berg',
      subject: 'Re: Vertrag — schaust du da heute noch drüber?',
    },
  },
  {
    // Subject mentions "Newsletter" but there is NO header/localpart/domain
    // signal → we must NOT over-trigger on body/subject words.
    name: 'Human mail whose subject merely contains "Newsletter"',
    input: {
      senderEmail: 'kunde@firmenkunde.de',
      senderName: 'Jens Kunde',
      subject: 'Idee für unseren nächsten Newsletter — kurz abstimmen?',
    },
  },
];

// ── Tests ────────────────────────────────────────────────────────────

for (const fx of NOISE_FIXTURES) {
  test(`noise: ${fx.name}`, () => {
    const r = triageMessage(fx.input);
    assert.equal(
      r.isNoise,
      true,
      `expected NOISE but got business_human (${r.stage}: ${r.reason})`
    );
    if (fx.category) {
      assert.equal(r.category, fx.category, `wrong sub-category (${r.reason})`);
    }
    // The whole point: the mapped inbox bucket must be EXCLUDED from the
    // answer-required gate.
    const bucket = noiseToInboxCategory(r.category as TriageNoiseCategory);
    assert.ok(
      !(ANSWER_REQUIRED_CATEGORIES as readonly string[]).includes(bucket),
      `noise mapped to answer-required bucket "${bucket}"`
    );
  });
}

for (const fx of HUMAN_FIXTURES) {
  test(`human: ${fx.name}`, () => {
    const r = triageMessage(fx.input);
    assert.equal(
      r.isNoise,
      false,
      `expected reply-candidate but was filtered as noise (${r.stage}: ${r.reason})`
    );
    assert.equal(r.category, 'business_human');
  });
}

test('mapping: every noise category lands outside the answer-required gate', () => {
  const cats: TriageNoiseCategory[] = [
    'marketing',
    'transactional',
    'notification',
    'job_broadcast',
  ];
  for (const c of cats) {
    const bucket = noiseToInboxCategory(c);
    assert.ok(!(ANSWER_REQUIRED_CATEGORIES as readonly string[]).includes(bucket));
  }
});
