/**
 * Zentrale Datenstruktur der „Warum Ctrl+K“-Seite.
 *
 * Haltung (verbindlich): Angegriffen werden MUSTER und Kategorien-Probleme,
 * nicht Marken. Jede Beobachtung unter `experiences` ist eine, die echte
 * Nutzer wirklich äußern — fair, neutral formuliert, KEINE wörtlichen Zitate,
 * keine erfundenen Schwächen, keine Konkurrenz-Logos. `examples` nennt
 * Produktnamen nur als neutralen Text zur Orientierung.
 *
 * Alle drei Vergleichsblöcke liegen hier (nicht in JSX verstreut), damit Copy
 * an einer Stelle gepflegt wird.
 */

export interface ComparisonBlock {
  /** Stabiler Anker/Key. */
  id: string;
  /** Zweistellige Ordnungszahl fürs Eyebrow (01 / 02 / 03). */
  index: string;
  /** Kategorie-Name der Tool-Gruppe. */
  category: string;
  /** Neutrale Beispiel-Nennung (nur Text, keine Logos). */
  examples: string;
  /** „Das Muster“ — wie diese Tool-Gruppe grundsätzlich gebaut ist. */
  pattern: string;
  /** „Was Nutzer erleben“ — reale, neutral formulierte Beobachtungen. */
  experiences: string[];
  /** „Wie Ctrl+K es macht“ — die konkrete Gegenposition. */
  ctrlk: string;
}

export const COMPARISON_BLOCKS: ComparisonBlock[] = [
  {
    id: 'notes',
    index: '01',
    category: 'Notizen- & All-in-One-Tools',
    examples: 'z. B. Notion, Obsidian und Ähnliche',
    pattern:
      'Ein leerer Canvas und nahezu unbegrenzte Flexibilität. Du baust dir das System selbst — Datenbanken, Ansichten, Verknüpfungen, Vorlagen. Das Tool ist alles, was du daraus machst.',
    experiences: [
      'Mehr Zeit mit dem Organisieren verbracht als mit dem Erledigen.',
      'Steile Lernkurve — nach Monaten fühlt man sich noch immer „am Anfang“.',
      'Mit jedem neuen Feature (KI, Kalender) leiden die Basics; es wirkt aufgebläht.',
      'Die Mobile-App ist träge — Quick-Capture unterwegs frustriert.',
    ],
    ctrlk:
      'Kein Setup, kein Tüfteln. Der Plan steht am ersten Morgen schon da — berechnet aus deinen echten Daten. Kein leerer Canvas, der darauf wartet, dass du ihn erst zu etwas Brauchbarem machst.',
  },
  {
    id: 'mail',
    index: '02',
    category: 'KI-Mail-Clients',
    examples: 'z. B. Superhuman, Shortwave und Ähnliche',
    pattern:
      'Eine schnellere, klügere Inbox: KI-Suche, Tastatur-Workflows, Hilfe beim Entwurf. Das Versprechen ist Tempo — du kommst schneller durch deine Mails.',
    experiences: [
      'Du verarbeitest weiterhin jede Mail selbst — das Tool macht es nur schneller.',
      'Keine automatische Extraktion von Aufgaben oder Zusagen aus deinen Mails.',
      'Tages-Limits bei der KI bremsen, wer viel schreibt.',
      'Oft nur für Gmail — das gilt aktuell auch für Ctrl+K (dazu unten ehrlich mehr).',
    ],
    ctrlk:
      'Ctrl+K verarbeitet nicht nur schneller — es zieht die Handlung heraus: wem du was bis wann versprochen hast. Und stellt sie in deinen Tagesplan. Mail → Zusage → Plan, ein geschlossener Kreis.',
  },
  {
    id: 'tasks',
    index: '03',
    category: 'Task- & Scheduling-Tools',
    examples: 'z. B. Motion und Ähnliche',
    pattern:
      'KI verplant deine Aufgaben automatisch in den Kalender und räumt den Tag für dich auf. Du wirfst Tasks hinein, das Tool sucht die Slots.',
    experiences: [
      'Über die Zeit aufgebläht — neue Trends statt Politur, die Bedienung wirkt klobig.',
      'Verbrauchsbasierte KI-Credits führen zu unvorhersehbaren, steigenden Kosten.',
      'Steile Lernkurve, und die Entscheidungen der KI sind nicht immer nachvollziehbar.',
    ],
    ctrlk:
      'Ctrl+K plant keine abstrakten Tasks, sondern deine Verpflichtungen gegenüber Menschen. Flache, planbare Preise — keine Credits, keine Kosten-Überraschung am Monatsende.',
  },
];

export interface HonestPoint {
  /** Die Situation, in der Ctrl+K (noch) nicht passt — als Nutzer-Aussage. */
  when: string;
  /** Die ehrliche Antwort darauf. */
  answer: string;
}

/**
 * Die Ehrlichkeits-Sektion — der Trust-Anker der Seite. Keine versteckten
 * Schwächen: hier steht offen, wo Ctrl+K nicht das richtige Werkzeug ist.
 */
export const HONEST_POINTS: HonestPoint[] = [
  {
    when: 'Du nutzt Outlook.',
    answer:
      'Ctrl+K ist aktuell Gmail-only. Outlook steht auf der Roadmap — heute ist es aber noch nicht da. Wenn deine Arbeit in Outlook lebt, ist jetzt nicht dein Moment.',
  },
  {
    when: 'Du willst eine vollwertige Wissensdatenbank.',
    answer:
      'Eine zweite Notion will Ctrl+K bewusst nicht sein. Für ein tiefes, verschachteltes Wissenssystem mit eigenen Datenbanken ist Notion das bessere Werkzeug — und das ist völlig in Ordnung.',
  },
  {
    when: 'Du baust dein System am liebsten selbst.',
    answer:
      'Wenn dir genau das Freude macht — eigene Views, eigene Logik, alles handgebaut —, dann ist ein flexibler Baukasten richtiger für dich als ein fertiger Plan.',
  },
];
