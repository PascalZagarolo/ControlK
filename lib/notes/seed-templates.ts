/**
 * Note-templates that ship with each workspace template. Used both:
 *  - at workspace creation time (seedWorkspace) to drop a starter set of
 *    notes a user can build on,
 *  - and at runtime via the "neue Notiz aus Template" picker (Sprint 6).
 *
 * Documents are stored as the BlockNote JSON shape: an array of block specs
 * with `type`, optional `content` text-run arrays, and optional `props`.
 */

export type NoteTemplate = {
  key: string;
  title: string;
  icon: string;
  description: string;
  document: any[]; // BlockNote PartialBlock[]
};

function p(text: string): any {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text, styles: {} }],
  };
}
function h(level: 1 | 2 | 3, text: string): any {
  return {
    type: `heading`,
    props: { level },
    content: [{ type: 'text', text, styles: {} }],
  };
}
function todo(text: string, checked = false): any {
  return {
    type: 'checkListItem',
    props: { checked },
    content: [{ type: 'text', text, styles: {} }],
  };
}
function bullet(text: string): any {
  return {
    type: 'bulletListItem',
    content: [{ type: 'text', text, styles: {} }],
  };
}
function divider(): any {
  return { type: 'paragraph' };
}

// ─── Vermietung ─────────────────────────────────────────────
const VERMIETUNG_TEMPLATES: NoteTemplate[] = [
  {
    key: 'uebergabe-protokoll',
    title: 'Übergabe-Protokoll',
    icon: '🚐',
    description: 'Standard-Checkliste für die Fahrzeug-Übergabe',
    document: [
      h(1, 'Übergabe-Protokoll'),
      p('Kunde · Fahrzeug · Datum hier eintragen.'),
      h(2, 'Vor-Übergabe'),
      todo('Fahrzeug-ID + Kennzeichen prüfen'),
      todo('Kraftstoffstand notieren'),
      todo('Kilometerstand notieren'),
      todo('Außen-Inspektion (Fotos)'),
      todo('Innen-Inspektion (Fotos)'),
      h(2, 'Übergabe'),
      todo('Schlüssel-Übergabe'),
      todo('Fahrzeugschein dabei'),
      todo('Versicherungs-Karte dabei'),
      todo('Tank-/Lade-Hinweise erklärt'),
      todo('Notrufnummer übergeben'),
      h(2, 'Notizen'),
      p(''),
    ],
  },
  {
    key: 'schadensbericht',
    title: 'Schadensbericht',
    icon: '⚠',
    description: 'Erfassung bei Schaden / Unfall',
    document: [
      h(1, 'Schadensbericht'),
      p('Datum · Fahrzeug · Beteiligte Kunden hier eintragen.'),
      h(2, 'Hergang'),
      p('Was ist passiert? Wann? Wo?'),
      h(2, 'Schaden'),
      bullet('Lage am Fahrzeug:'),
      bullet('Geschätzte Reparaturkosten:'),
      bullet('Versicherung kontaktiert:'),
      h(2, 'Fotos & Anhänge'),
      p('Fotos hier einfügen.'),
      h(2, 'Nächste Schritte'),
      todo('Versicherung melden'),
      todo('Werkstatt-Termin'),
      todo('Kunde informiert'),
    ],
  },
  {
    key: 'kunden-briefing',
    title: 'Kunden-Briefing',
    icon: '◉',
    description: 'Kurzes Brief vor jedem Kunden-Call',
    document: [
      h(1, 'Briefing für Kunden-Termin'),
      p('Trage Kunden-Name + Datum ein.'),
      h(2, 'Status'),
      p('Letzte Touchpoints, offene Fragen, geplante Themen.'),
      h(2, 'Pipeline'),
      p('Aktuelle Verträge, gewünschtes Volumen.'),
      h(2, 'Risiken / Blocker'),
      p(''),
      h(2, 'Mein Ziel für das Gespräch'),
      p(''),
    ],
  },
];

// ─── Familie / Privat ───────────────────────────────────────
const FAMILIE_TEMPLATES: NoteTemplate[] = [
  {
    key: 'wochen-plan',
    title: 'Wochen-Plan',
    icon: '📅',
    description: 'Was steht diese Woche an',
    document: [
      h(1, 'Wochen-Plan'),
      p('KW · Datum hier eintragen.'),
      h(2, 'Mo'),
      bullet(''),
      h(2, 'Di'),
      bullet(''),
      h(2, 'Mi'),
      bullet(''),
      h(2, 'Do'),
      bullet(''),
      h(2, 'Fr'),
      bullet(''),
      h(2, 'Wochenende'),
      bullet(''),
      h(2, 'Erledigungen'),
      todo(''),
      todo(''),
    ],
  },
  {
    key: 'einkaufsliste',
    title: 'Einkaufsliste',
    icon: '🛒',
    description: 'Shared shopping list',
    document: [
      h(1, 'Einkaufsliste'),
      h(2, 'Grundnahrung'),
      todo('Brot'),
      todo('Milch'),
      todo('Butter'),
      h(2, 'Obst & Gemüse'),
      todo(''),
      h(2, 'Sonstiges'),
      todo(''),
    ],
  },
  {
    key: 'familien-beschluss',
    title: 'Familien-Beschluss',
    icon: '🤝',
    description: 'Notizen aus dem nächsten Familien-Meeting',
    document: [
      h(1, 'Familien-Meeting'),
      p('Datum eintragen.'),
      h(2, 'Themen'),
      bullet(''),
      h(2, 'Beschlüsse'),
      bullet(''),
      h(2, 'Wer macht was'),
      todo(''),
    ],
  },
];

// ─── Agentur ────────────────────────────────────────────────
const AGENTUR_TEMPLATES: NoteTemplate[] = [
  {
    key: 'meeting-notes',
    title: 'Meeting-Notes',
    icon: '📝',
    description: 'Strukturierte Notiz aus einem Termin',
    document: [
      h(1, 'Meeting-Notes'),
      p('Datum · Teilnehmer hier eintragen.'),
      h(2, 'Agenda'),
      bullet(''),
      h(2, 'Diskussion'),
      p(''),
      h(2, 'Decisions'),
      bullet(''),
      h(2, 'Action Items'),
      todo(''),
    ],
  },
  {
    key: 'proposal-draft',
    title: 'Proposal-Draft',
    icon: '📋',
    description: 'Kunden-Angebot vor dem Versand',
    document: [
      h(1, 'Proposal'),
      p('Kunde · Datum hier eintragen.'),
      h(2, 'Kontext'),
      p('Worum geht es? Was ist das Problem?'),
      h(2, 'Lösung'),
      p('Was schlagen wir vor?'),
      h(2, 'Scope'),
      bullet(''),
      h(2, 'Preis & Timeline'),
      p(''),
      h(2, 'Open Questions'),
      bullet(''),
    ],
  },
];

// ─── Coach / Berater ────────────────────────────────────────
const COACH_TEMPLATES: NoteTemplate[] = [
  {
    key: 'session-notes',
    title: 'Session-Notes',
    icon: '🧠',
    description: 'Nach jeder Coaching-Session',
    document: [
      h(1, 'Session-Notes'),
      p('Klient · Datum eintragen.'),
      h(2, 'Letzte Session'),
      p(''),
      h(2, 'Heute besprochen'),
      bullet(''),
      h(2, 'Hausaufgaben'),
      todo(''),
      h(2, 'Nächste Session'),
      p(''),
    ],
  },
];

// ─── Startup ────────────────────────────────────────────────
const STARTUP_TEMPLATES: NoteTemplate[] = [
  {
    key: 'standup',
    title: 'Daily Stand-up',
    icon: '☀',
    description: 'Was gestern, heute, blockiert',
    document: [
      h(1, 'Daily Stand-up'),
      p('Datum eintragen.'),
      h(2, 'Gestern'),
      bullet(''),
      h(2, 'Heute'),
      bullet(''),
      h(2, 'Blocker'),
      bullet(''),
    ],
  },
];

// ─── Student ────────────────────────────────────────────────
const STUDENT_TEMPLATES: NoteTemplate[] = [
  {
    key: 'lern-notiz',
    title: 'Lern-Notiz',
    icon: '🎓',
    description: 'Aus einer Vorlesung / einem Lehrbuch',
    document: [
      h(1, 'Lern-Notiz'),
      p('Fach · Thema · Datum eintragen.'),
      h(2, 'Kernidee'),
      p(''),
      h(2, 'Wichtige Begriffe'),
      bullet(''),
      h(2, 'Beispiele'),
      bullet(''),
      h(2, 'Fragen offen'),
      todo(''),
    ],
  },
];

// ─── Solo-Freelancer (default) ──────────────────────────────
const SOLO_TEMPLATES: NoteTemplate[] = [
  {
    key: 'welcome',
    title: 'Willkommen',
    icon: '👋',
    description: 'Start-Notiz mit Tipps',
    document: [
      h(1, 'Willkommen 👋'),
      p('Das ist deine erste Notiz. Tippe / um Blocks einzufügen.'),
      h(2, 'Was du probieren kannst'),
      bullet('@Müller — erwähne Kunden, sieh live ihren Status'),
      bullet('/embed-brief — heutiger Tagesbrief direkt in der Notiz'),
      bullet('/todo Müller zurückrufen — erstellt echten Todo'),
      bullet('/voice — diktiere und lass transkribieren'),
      h(2, 'Tastenkürzel'),
      bullet('⌘K — Suche über alles'),
      bullet('⌘G — globale Suche über alle Workspaces'),
    ],
  },
];

const TEMPLATES_BY_KEY: Record<string, NoteTemplate[]> = {
  vermietung: VERMIETUNG_TEMPLATES,
  familie: FAMILIE_TEMPLATES,
  agentur: AGENTUR_TEMPLATES,
  coach: COACH_TEMPLATES,
  startup: STARTUP_TEMPLATES,
  student: STUDENT_TEMPLATES,
  'solo-freelancer': SOLO_TEMPLATES,
  leer: [],
};

export function getNoteTemplatesForWorkspaceTemplate(
  templateKey: string | null | undefined
): NoteTemplate[] {
  if (!templateKey) return SOLO_TEMPLATES;
  return TEMPLATES_BY_KEY[templateKey] ?? SOLO_TEMPLATES;
}
