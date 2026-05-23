// Client-safe template metadata. The server-only seeding logic lives in
// `lib/db/workspace-templates.ts` and pulls from here.

export type WorkspaceTemplate = {
  key: string;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  fromColor: string;
  toColor: string;
};

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    key: 'solo-freelancer',
    name: 'Solo Freelancer',
    icon: '🧑‍💻',
    tagline: 'Akquise, Projekte, Admin',
    description: 'Drei Todo-Gruppen + ein #general-Channel. Minimal, sofort produktiv.',
    fromColor: '#5eb6ff',
    toColor: '#1e3a8a',
  },
  {
    key: 'vermietung',
    name: 'Vermietung',
    icon: '🚐',
    tagline: 'Komplette uRent-Suite',
    description:
      'Fleet-Management mit Todo-Gruppen für Übergabe/Wartung/Schaden, drei Channels, Default-Calendar-Templates.',
    fromColor: '#5ee08a',
    toColor: '#166534',
  },
  {
    key: 'familie',
    name: 'Familie / Haushalt',
    icon: '🏡',
    tagline: 'Privates auf einer Linie',
    description:
      'Todo-Gruppen Haushalt/Familie/Finanzen + ein Familie-Channel. Kalender-Templates für Arzttermin/Schule.',
    fromColor: '#ffb45e',
    toColor: '#9a3412',
  },
  {
    key: 'agentur',
    name: 'Agentur',
    icon: '🎯',
    tagline: 'Channels pro Kunde',
    description: 'Default-Setup: ein Channel pro Hauptkunde, Todo-Gruppen pro Projekt.',
    fromColor: '#c084fc',
    toColor: '#6b21a8',
  },
  {
    key: 'coach',
    name: 'Coach / Berater',
    icon: '🧠',
    tagline: 'Klient-zentriert',
    description: 'Sessions als Calendar-Template, Todo-Gruppen pro Klient.',
    fromColor: '#f472b6',
    toColor: '#9d174d',
  },
  {
    key: 'startup',
    name: 'Startup-Team',
    icon: '🚀',
    tagline: 'Stand-ups + Sales-Ops',
    description: 'Channels #standup #sales #ops, Stand-up-Template, Lead-Funnel auf Kunden aktiv.',
    fromColor: '#5eb6ff',
    toColor: '#0369a1',
  },
  {
    key: 'student',
    name: 'Student',
    icon: '🎓',
    tagline: 'Pro Fach organisiert',
    description: 'Todo-Gruppen pro Fach, Recurring-Vorlesungs-Events, Lern-Channels.',
    fromColor: '#5ee08a',
    toColor: '#15803d',
  },
  {
    key: 'leer',
    name: 'Leerer Workspace',
    icon: '◯',
    tagline: 'Nur das Skelett',
    description: 'Kein Seed. Alles selber aufbauen.',
    fromColor: '#9c9c9d',
    toColor: '#525252',
  },
];

export function getTemplate(key: string): WorkspaceTemplate | undefined {
  return WORKSPACE_TEMPLATES.find((t) => t.key === key);
}
