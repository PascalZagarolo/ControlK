'use server';

import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { runTool } from '@/lib/ai/workspace-tools';
import {
  aiGenerate,
  aiGenerateJSON,
  aiAvailable,
  AI_MODEL_CHAT,
  AI_MODEL_FAST,
} from '@/lib/ai/gateway';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function customerContext(customerId: string) {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  const data = await runTool('getCustomerDetail', { customerId }, { workspaceId: ws.id, userId: user.id });
  return { data, ws, user };
}

/**
 * Customer health + next-best-action. Pulls the customer's contracts, recent
 * activity and contacts (via the existing workspace tool) and asks the model
 * for a short read + one concrete next step + a churn/risk flag. Works for
 * private contacts and business customers alike.
 */
export async function customerInsight(customerId: string): Promise<
  Result<{ summary: string; nextAction: string; risk: { level: string; reason: string } }>
> {
  try {
    const { data, user } = await customerContext(customerId);
    if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };
    if ((data as any)?.error === 'not-found') return { ok: false, error: 'Kunde nicht gefunden.' };

    const parsed = await aiGenerateJSON<{
      summary?: string;
      nextAction?: string;
      risk?: { level?: string; reason?: string };
    }>({
      userId: user.id,
      model: AI_MODEL_FAST,
      maxOutputTokens: 400,
      system:
        'Du bist ein CRM-Assistent. Analysiere die Kundendaten und antworte NUR mit JSON: ' +
        '{ "summary": string (1-2 Sätze Stand der Beziehung), "nextAction": string (EIN konkreter nächster Schritt), ' +
        '"risk": { "level": "niedrig"|"mittel"|"hoch", "reason": string (kurz) } }. ' +
        'Auf Deutsch, konkret, keine Floskeln.',
      prompt: `Heute: ${new Date().toISOString().slice(0, 10)}\n\nKundendaten:\n${JSON.stringify(data)}`,
    });
    if (!parsed) return { ok: false, error: 'Analyse fehlgeschlagen.' };
    return {
      ok: true,
      summary: (parsed.summary ?? '').trim() || '—',
      nextAction: (parsed.nextAction ?? '').trim() || '—',
      risk: {
        level: parsed.risk?.level ?? 'niedrig',
        reason: parsed.risk?.reason ?? '',
      },
    };
  } catch (e) {
    console.error('[crm-ai] insight failed', e);
    return { ok: false, error: 'Analyse fehlgeschlagen.' };
  }
}

/** A meeting-prep brief for a customer: context + talking points + open items. */
export async function customerMeetingPrep(customerId: string): Promise<Result<{ brief: string }>> {
  try {
    const { data, user } = await customerContext(customerId);
    if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };
    if ((data as any)?.error === 'not-found') return { ok: false, error: 'Kunde nicht gefunden.' };

    const brief = await aiGenerate({
      userId: user.id,
      model: AI_MODEL_CHAT,
      maxOutputTokens: 500,
      temperature: 0.5,
      system:
        'Du erstellst einen knappen Meeting-Prep für ein Kundengespräch, auf Deutsch. ' +
        'Struktur: kurzer Kontext, dann "Gesprächspunkte" als Stichpunkte, dann "Offen/Risiken". ' +
        'Nur was aus den Daten hervorgeht, keine Erfindungen.',
      prompt: `Heute: ${new Date().toISOString().slice(0, 10)}\n\nKundendaten:\n${JSON.stringify(data)}`,
    });
    return { ok: true, brief: brief.trim() };
  } catch (e) {
    console.error('[crm-ai] prep failed', e);
    return { ok: false, error: 'Prep fehlgeschlagen.' };
  }
}

/** Drafts a renewal message for a contract (for expiring / renewable ones). */
export async function contractRenewalDraft(contractId: string): Promise<Result<{ draft: string }>> {
  const user = await requireUser();
  const ws = await requireCurrentWorkspace();
  if (!(await aiAvailable(user.id))) return { ok: false, error: 'KI ist nicht konfiguriert.' };

  const db = getDb();
  const contract = await db.query.contracts.findFirst({
    where: and(eq(s.contracts.workspaceId, ws.id), eq(s.contracts.id, contractId)),
    columns: { id: true, title: true, status: true, valueCents: true, startsAt: true, endsAt: true, customerId: true },
  });
  if (!contract) return { ok: false, error: 'Vertrag nicht gefunden.' };

  let customerName = '';
  if (contract.customerId) {
    const c = await db.query.customers.findFirst({
      where: eq(s.customers.id, contract.customerId),
      columns: { name: true },
    });
    customerName = c?.name ?? '';
  }

  try {
    const draft = await aiGenerate({
      userId: user.id,
      model: AI_MODEL_CHAT,
      maxOutputTokens: 450,
      temperature: 0.6,
      system:
        'Du schreibst eine freundliche, professionelle Verlängerungs-Nachricht (E-Mail) auf Deutsch. ' +
        'Gib NUR den Nachrichtentext zurück (Anrede bis Grußformel von ' + (user.name || 'mir') + '), ' +
        'keine Betreffzeile, keine Erklärung.',
      prompt:
        `Heute: ${new Date().toISOString().slice(0, 10)}\n` +
        `Vertrag: ${contract.title}\n` +
        `Kunde: ${customerName || '(unbekannt)'}\n` +
        `Status: ${contract.status}\n` +
        `Wert: ${contract.valueCents ? '€' + Math.round(contract.valueCents / 100) : '—'}\n` +
        `Läuft bis: ${contract.endsAt ? new Date(contract.endsAt).toISOString().slice(0, 10) : '—'}\n\n` +
        'Schreibe eine Nachricht, die die Verlängerung anstößt.',
    });
    return { ok: true, draft: draft.trim() };
  } catch (e) {
    console.error('[crm-ai] renewal failed', e);
    return { ok: false, error: 'Entwurf fehlgeschlagen.' };
  }
}
