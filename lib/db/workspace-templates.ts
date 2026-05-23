import 'server-only';
import { randomUUID } from 'crypto';
import { getDb } from './client';
import * as s from './schema';
import {
  WORKSPACE_TEMPLATES,
  getTemplate,
  type WorkspaceTemplate,
} from '../workspace-templates';

export { WORKSPACE_TEMPLATES, getTemplate };
export type { WorkspaceTemplate };

// ─── Seeding logic per template ────────────────────────────────
async function seedTodoGroups(
  workspaceId: string,
  userId: string,
  groups: { name: string; emoji: string; color: string }[]
) {
  const db = getDb();
  await db.insert(s.todoGroups).values(
    groups.map((g, i) => ({
      workspaceId,
      slug:
        g.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/ß/g, 'ss')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 40) || `gruppe-${i}`,
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      position: i,
      createdById: userId,
    }))
  );
}

async function seedChannels(
  workspaceId: string,
  userId: string,
  channels: { name: string; topic?: string; kind?: any }[]
) {
  const db = getDb();
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const slug =
      ch.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 48) || `channel-${i}`;
    const [row] = await db
      .insert(s.channels)
      .values({
        workspaceId,
        slug,
        name: ch.name,
        topic: ch.topic ?? null,
        kind: ch.kind ?? 'general',
      })
      .returning();
    await db.insert(s.channelMembers).values({ channelId: row.id, userId });
  }
}

async function seedCalendarTemplates(
  workspaceId: string,
  templates: { name: string; kind: any; durationMinutes: number; checklist: string[] }[]
) {
  const db = getDb();
  await db.insert(s.calendarEventTemplates).values(
    templates.map((t, i) => ({
      workspaceId,
      slug:
        t.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .slice(0, 40) || `template-${i}`,
      name: t.name,
      kind: t.kind,
      defaultDurationMinutes: t.durationMinutes,
      defaultChecklist: t.checklist.map((label) => ({ id: randomUUID(), label })),
    }))
  );
}

export async function seedWorkspace(
  workspaceId: string,
  userId: string,
  templateKey: string
): Promise<void> {
  if (templateKey === 'leer' || !templateKey) return;

  if (templateKey === 'solo-freelancer') {
    await seedTodoGroups(workspaceId, userId, [
      { name: 'Akquise', emoji: '🎯', color: '#5eb6ff' },
      { name: 'Projekte', emoji: '📦', color: '#5ee08a' },
      { name: 'Admin', emoji: '📋', color: '#9c9c9d' },
    ]);
    await seedChannels(workspaceId, userId, [
      { name: 'general', topic: 'Allgemeine Notizen und Updates' },
    ]);
    return;
  }

  if (templateKey === 'vermietung') {
    await seedTodoGroups(workspaceId, userId, [
      { name: 'Übergabe', emoji: '↗', color: '#5ee08a' },
      { name: 'Rückgabe', emoji: '↙', color: '#5eb6ff' },
      { name: 'Wartung', emoji: '🔧', color: '#ffd96a' },
      { name: 'Schaden', emoji: '⚠', color: '#ff8a8a' },
      { name: 'Akquise', emoji: '🎯', color: '#c084fc' },
    ]);
    await seedChannels(workspaceId, userId, [
      { name: 'flotte', topic: 'Fahrzeug-Status und -Buchungen', kind: 'general' },
      { name: 'sales', topic: 'Anfragen, Angebote, Verträge', kind: 'deal' },
      { name: 'service', topic: 'Wartung, Reinigung, Schäden', kind: 'damage' },
    ]);
    await seedCalendarTemplates(workspaceId, [
      {
        name: 'Standard-Übergabe',
        kind: 'handover',
        durationMinutes: 30,
        checklist: [
          'Schlüssel-Übergabe',
          'Kilometerstand notieren',
          'Fahrzeugzustand prüfen',
          'Kraftstoffstand notieren',
          'Übergabe-Protokoll',
        ],
      },
      {
        name: 'Standard-Rückgabe',
        kind: 'return',
        durationMinutes: 30,
        checklist: [
          'Schlüssel zurück',
          'Kilometerstand notieren',
          'Schadens-Check',
          'Reinigungs-Bewertung',
          'Rechnung erstellen',
        ],
      },
      {
        name: 'Wartung-Service',
        kind: 'maintenance',
        durationMinutes: 240,
        checklist: ['Ölwechsel', 'Bremsen', 'Reifen', 'TÜV-Check'],
      },
    ]);
    return;
  }

  if (templateKey === 'familie') {
    await seedTodoGroups(workspaceId, userId, [
      { name: 'Haushalt', emoji: '🏡', color: '#ffb45e' },
      { name: 'Familie', emoji: '👨‍👩‍👧', color: '#f472b6' },
      { name: 'Finanzen', emoji: '💰', color: '#5ee08a' },
    ]);
    await seedChannels(workspaceId, userId, [
      { name: 'familie', topic: 'Familien-Updates' },
    ]);
    await seedCalendarTemplates(workspaceId, [
      {
        name: 'Arzttermin',
        kind: 'health',
        durationMinutes: 60,
        checklist: ['Versicherungs-Karte', 'Vor-Untersuchungen', 'Fragen notiert'],
      },
      {
        name: 'Schul-Termin',
        kind: 'personal',
        durationMinutes: 60,
        checklist: ['Mitbringen', 'Adresse', 'Ansprechpartner'],
      },
    ]);
    return;
  }

  if (templateKey === 'agentur') {
    await seedTodoGroups(workspaceId, userId, [
      { name: 'Sales', emoji: '🎯', color: '#5eb6ff' },
      { name: 'Production', emoji: '⚙️', color: '#5ee08a' },
      { name: 'Admin', emoji: '📋', color: '#9c9c9d' },
    ]);
    await seedChannels(workspaceId, userId, [
      { name: 'team', topic: 'Internes Team-Update' },
      { name: 'sales', topic: 'Pipeline, Leads, Angebote', kind: 'deal' },
    ]);
    return;
  }

  if (templateKey === 'coach') {
    await seedTodoGroups(workspaceId, userId, [
      { name: 'Klienten', emoji: '🧠', color: '#f472b6' },
      { name: 'Content', emoji: '✏️', color: '#5eb6ff' },
      { name: 'Admin', emoji: '📋', color: '#9c9c9d' },
    ]);
    await seedChannels(workspaceId, userId, [{ name: 'general' }]);
    await seedCalendarTemplates(workspaceId, [
      {
        name: 'Coaching-Session',
        kind: 'meeting',
        durationMinutes: 60,
        checklist: ['Notizen letzte Session', 'Agenda', 'Hausaufgaben prüfen'],
      },
    ]);
    return;
  }

  if (templateKey === 'startup') {
    await seedTodoGroups(workspaceId, userId, [
      { name: 'Sales', emoji: '🎯', color: '#5eb6ff' },
      { name: 'Product', emoji: '🚀', color: '#5ee08a' },
      { name: 'Ops', emoji: '⚙️', color: '#c084fc' },
    ]);
    await seedChannels(workspaceId, userId, [
      { name: 'standup', topic: 'Daily Stand-up' },
      { name: 'sales', topic: 'Pipeline + Deals', kind: 'deal' },
      { name: 'ops', topic: 'Hiring, Tools, Admin' },
    ]);
    await seedCalendarTemplates(workspaceId, [
      {
        name: 'Daily Stand-up',
        kind: 'meeting',
        durationMinutes: 15,
        checklist: ['Was heute', 'Was blockiert', 'Wer braucht Hilfe'],
      },
    ]);
    return;
  }

  if (templateKey === 'student') {
    await seedTodoGroups(workspaceId, userId, [
      { name: 'Klausuren', emoji: '📚', color: '#ff8a8a' },
      { name: 'Hausarbeiten', emoji: '✏️', color: '#5eb6ff' },
      { name: 'Lernen', emoji: '🎓', color: '#5ee08a' },
    ]);
    await seedChannels(workspaceId, userId, [{ name: 'lerngruppe' }]);
    return;
  }
}
