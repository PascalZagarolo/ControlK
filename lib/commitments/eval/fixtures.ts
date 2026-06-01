// ─── Commitment eval: fixture sent-mails with known expectations ─────
//
// Each fixture is a SENT mail plus the ground truth: how many real
// commitments it contains, and (where checkable) the expected deadline +
// confidence band. The scorer (score.ts) compares the pipeline's output to
// these and reports detected / missed / false-positive per fixture.
//
// These are the deterministic-tier fixtures: they exercise the PREFILTER +
// PARSER + DATE-RESOLVER without a live model, by supplying a `modelJson`
// (what Claude would plausibly return) so the test is hermetic and free.
// The accuracy of the model itself is measured separately, on real mail,
// via the dry-run harness at /inbox/validate (see README).

export type ExpectedCommitment = {
  /** Substring expected in promise OR quote (loose match — wording varies). */
  match: string;
  /** Expected resolved due date as YYYY-MM-DD, or null for "no deadline". */
  dueDate: string | null;
  /** Acceptable confidence bands (e.g. high only, or medium|low). */
  confidenceIn: Array<'high' | 'medium' | 'low'>;
};

export type CommitmentFixture = {
  name: string;
  /** ISO timestamp the mail was SENT — anchors relative deadlines. */
  sendDateIso: string;
  to: string | null;
  subject: string | null;
  body: string;
  /** What a correct extraction must yield. Empty array = no commitment. */
  expected: ExpectedCommitment[];
  /**
   * The model's raw response for the hermetic test. Mirrors what Claude
   * returns for this mail. `null` means: this mail must be dropped by the
   * deterministic PREFILTER before the model is ever called.
   */
  modelJson: string | null;
};

export const FIXTURES: CommitmentFixture[] = [
  // ── Clear commitment WITH a relative deadline ──────────────────────
  {
    name: 'Klare Zusage mit Frist ("bis Freitag")',
    sendDateIso: '2026-05-18T09:00:00.000Z', // Monday
    to: 'kunde@spedition-nord.de',
    subject: 'Re: Angebot Transporter',
    body:
      'Hallo Frau Hoffmann,\n\nvielen Dank für das Gespräch. Ich schicke Ihnen den ' +
      'überarbeiteten Entwurf bis Freitag zu.\n\nBeste Grüße\nPascal',
    expected: [
      // 2026-05-18 is a Monday → "bis Freitag" = 2026-05-22.
      { match: 'Entwurf', dueDate: '2026-05-22', confidenceIn: ['high'] },
    ],
    modelJson: JSON.stringify({
      commitments: [
        {
          promise: 'Überarbeiteten Entwurf schicken',
          quote: 'Ich schicke Ihnen den überarbeiteten Entwurf bis Freitag zu.',
          dueBasis: 'bis Freitag',
          dueIso: null,
          confidence: 'high',
        },
      ],
    }),
  },

  // ── Clear commitment WITH "morgen" ─────────────────────────────────
  {
    name: 'Klare Zusage mit Frist ("morgen")',
    sendDateIso: '2026-05-20T16:30:00.000Z',
    to: 'team@bau-mueller.de',
    subject: 'Rechnung',
    body: 'Hi,\n\nich sende dir die Rechnung morgen. Melde mich dann.\n\nGruß',
    expected: [{ match: 'Rechnung', dueDate: '2026-05-21', confidenceIn: ['high', 'medium'] }],
    modelJson: JSON.stringify({
      commitments: [
        {
          promise: 'Rechnung senden',
          quote: 'ich sende dir die Rechnung morgen.',
          dueBasis: 'morgen',
          dueIso: null,
          confidence: 'high',
        },
      ],
    }),
  },

  // ── Clear commitment WITHOUT a deadline ────────────────────────────
  {
    name: 'Klare Zusage ohne Frist',
    sendDateIso: '2026-05-19T11:00:00.000Z',
    to: 'partner@example.com',
    subject: 'Unterlagen',
    body:
      'Guten Tag,\n\nich kümmere mich um die Vertragsunterlagen und lasse sie Ihnen ' +
      'zukommen.\n\nViele Grüße',
    expected: [{ match: 'Vertragsunterlagen', dueDate: null, confidenceIn: ['high', 'medium'] }],
    modelJson: JSON.stringify({
      commitments: [
        {
          promise: 'Vertragsunterlagen zukommen lassen',
          quote: 'ich kümmere mich um die Vertragsunterlagen und lasse sie Ihnen zukommen.',
          dueBasis: null,
          dueIso: null,
          confidence: 'medium',
        },
      ],
    }),
  },

  // ── False positive: pure politeness, NO commitment ─────────────────
  {
    name: 'Höflichkeitsfloskel — KEINE Zusage ("melde dich gern jederzeit")',
    sendDateIso: '2026-05-19T08:00:00.000Z',
    to: 'kunde@example.com',
    subject: 'Re: Danke',
    body:
      'Hallo,\n\nfreut mich, dass alles passt! Melde dich gern jederzeit, wenn du noch ' +
      'Fragen hast. Schönes Wochenende!\n\nGruß Pascal',
    expected: [],
    // A correct model returns no commitments here. (If it hallucinated one
    // without a quote, the parser would drop it anyway — covered in tests.)
    modelJson: JSON.stringify({ commitments: [] }),
  },

  // ── False positive: question, not a promise ────────────────────────
  {
    name: 'Frage statt Zusage — KEINE Zusage',
    sendDateIso: '2026-05-19T08:00:00.000Z',
    to: 'kunde@example.com',
    subject: 'Termin?',
    body: 'Hi, passt dir Donnerstag für einen kurzen Call? Sag gern Bescheid.\n\nGruß',
    expected: [],
    modelJson: JSON.stringify({ commitments: [] }),
  },

  // ── Ambiguous → must be medium/low (a question), never high ─────────
  {
    name: 'Mehrdeutig ("schaue ich mir mal an") → medium/low, nicht high',
    sendDateIso: '2026-05-19T08:00:00.000Z',
    to: 'kunde@example.com',
    subject: 'Re: Idee',
    body: 'Klingt spannend — schaue ich mir mal an und gebe dann Rückmeldung.\n\nGruß',
    expected: [{ match: 'an', dueDate: null, confidenceIn: ['medium', 'low'] }],
    modelJson: JSON.stringify({
      commitments: [
        {
          promise: 'Sache ansehen und Rückmeldung geben',
          quote: 'schaue ich mir mal an und gebe dann Rückmeldung.',
          dueBasis: null,
          dueIso: null,
          confidence: 'medium',
        },
      ],
    }),
  },

  // ── Hallucination guard: model returns promise WITHOUT a quote ──────
  {
    name: 'Halluzination ohne source_sentence → wird verworfen',
    sendDateIso: '2026-05-19T08:00:00.000Z',
    to: 'kunde@example.com',
    subject: 'Re: Projekt',
    body: 'Danke für die Info, klingt gut.\n\nGruß',
    expected: [], // nothing real to find
    modelJson: JSON.stringify({
      commitments: [
        // No `quote` → MUST be dropped by the parser, never surfaced.
        { promise: 'Liefert das Projekt bis Montag', dueBasis: 'bis Montag', confidence: 'high' },
      ],
    }),
  },

  // ── Hallucination guard: quote NOT present in the body ──────────────
  {
    name: 'Erfundenes Zitat (nicht im Text) → wird verworfen',
    sendDateIso: '2026-05-19T08:00:00.000Z',
    to: 'kunde@example.com',
    subject: 'Re: Hallo',
    body: 'Alles klar, bis bald!\n\nGruß',
    expected: [],
    modelJson: JSON.stringify({
      commitments: [
        {
          promise: 'Angebot schicken',
          quote: 'Ich sende Ihnen das Angebot bis Donnerstag.', // not in body
          dueBasis: 'bis Donnerstag',
          confidence: 'high',
        },
      ],
    }),
  },

  // ── Prefilter: newsletter send must never reach the model ───────────
  {
    name: 'Newsletter-Versand → Prefilter, kein AI-Call',
    sendDateIso: '2026-05-19T08:00:00.000Z',
    to: 'no-reply@list.example.com',
    subject: 'Unser Monats-Update',
    body:
      'Liebe Abonnenten, hier kommt unser Newsletter. Falls Sie sich abmelden möchten: ' +
      'unsubscribe-Link unten. Im Browser anzeigen. Impressum & Datenschutzerklärung.',
    expected: [],
    modelJson: null, // null = must be dropped by the prefilter
  },

  // ── Prefilter: one-word acknowledgement ────────────────────────────
  {
    name: 'Ein-Wort-Antwort ("Danke!") → Prefilter, kein AI-Call',
    sendDateIso: '2026-05-19T08:00:00.000Z',
    to: 'kunde@example.com',
    subject: 'Re: Re: Angebot',
    body: 'Danke!',
    expected: [],
    modelJson: null,
  },

  // ── Prefilter: pure forward with no own text ───────────────────────
  {
    name: 'Reine Weiterleitung ohne eigenen Text → Prefilter',
    sendDateIso: '2026-05-19T08:00:00.000Z',
    to: 'kollege@example.com',
    subject: 'Fwd: Angebot',
    body:
      '\n\n---------- Forwarded message ---------\nVon: kunde@x.de\nBetreff: Angebot\n\n' +
      'Sehr geehrte Damen und Herren, anbei unser Angebot. Wir liefern bis Freitag.',
    expected: [],
    modelJson: null,
  },
];
