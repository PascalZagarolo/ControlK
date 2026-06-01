// ─── Morning Plan — optional LLM phrasing (NEVER invents items) ──────
//
// The plan's items, order and collisions are computed deterministically in
// compute.ts. This step ONLY turns the already-decided facts into one or two
// assistive German sentences for the header. It is given the computed
// numbers + collision messages and is explicitly forbidden from adding
// anything. If AI isn't configured or the call fails, a deterministic
// fallback sentence is used — the plan never depends on the LLM.

import 'server-only';

import { aiGenerate, AI_MODEL_FAST } from '@/lib/ai/gateway';
import type { MorningPlan } from './types';

const SYSTEM_PROMPT =
  'Du bist Pascals ruhiger Morgen-Assistent. Du bekommst die BEREITS BERECHNETEN Fakten ' +
  'des heutigen Plans und fasst sie in 1-2 kurzen deutschen Sätzen zusammen.\n\n' +
  'Regeln:\n' +
  '- Assistierend, nie befehlend. Kein "Bitte priorisiere…", kein Nag-Ton.\n' +
  '- Erfinde NICHTS. Nur die genannten Zahlen/Hinweise verwenden. Fehlt ein Signal, ignoriere es.\n' +
  '- Bei Unsicherheit (mögliche Zusagen) fragend formulieren, nicht behaupten.\n' +
  '- Wenn nichts ansteht: ruhig + positiv sagen, nichts dramatisieren.\n' +
  '- Kein Vorwort, keine Aufzählung, keine Emojis. Reiner Fließtext, max. 280 Zeichen.';

/** Deterministic fallback — also the shape the LLM is asked to mirror. */
export function deterministicSummary(plan: MorningPlan): string {
  if (plan.isCalm && plan.stats.eventsToday === 0) {
    return 'Heute ist nichts Überfälliges offen und der Posteingang ist soweit ruhig. Guter Moment, um vorzuarbeiten.';
  }
  if (plan.isCalm) {
    const n = plan.stats.eventsToday;
    return `Nichts Dringendes heute — nur ${n} ${n === 1 ? 'Termin' : 'Termine'} im Kalender. Ansonsten ruhig.`;
  }
  const parts: string[] = [];
  const s = plan.stats;
  if (s.overdueCommitments > 0)
    parts.push(`${s.overdueCommitments} überfällige Zusage${s.overdueCommitments === 1 ? '' : 'n'}`);
  if (s.dueTodayCommitments > 0)
    parts.push(`${s.dueTodayCommitments} heute fällig`);
  if (s.repliesWaiting > 0)
    parts.push(`${s.repliesWaiting} Mail${s.repliesWaiting === 1 ? '' : 's'}, die auf Antwort warten`);
  if (s.todosDueToday > 0) parts.push(`${s.todosDueToday} Todo${s.todosDueToday === 1 ? '' : 's'}`);

  const head =
    parts.length > 0
      ? `${capitalize(joinDe(parts))} ${parts.length === 1 ? 'braucht' : 'brauchen'} heute deine Aufmerksamkeit.`
      : 'Ein paar Dinge stehen heute an.';
  const collision = plan.collisions[0]?.message;
  const question =
    s.questions > 0
      ? ` Außerdem ${s.questions === 1 ? 'sieht eine Mail' : `sehen ${s.questions} Mails`} nach einer Zusage aus — willst du ${s.questions === 1 ? 'sie' : 'sie'} bestätigen?`
      : '';
  return [head, collision, question].filter(Boolean).join(' ').slice(0, 400);
}

function capitalize(x: string): string {
  return x.charAt(0).toUpperCase() + x.slice(1);
}
function joinDe(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}`;
}

/**
 * Returns an assistive 1-2 sentence summary. Uses the deterministic version
 * as the guaranteed baseline; if AI is configured, lets it rephrase (still
 * grounded in the same facts). Never throws — falls back silently.
 */
export async function summarizeMorningPlan(userId: string, plan: MorningPlan): Promise<string> {
  const fallback = deterministicSummary(plan);
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) return fallback;

  // Feed only the decided facts — the model cannot see raw mail/commitments,
  // so it cannot invent items even if it tried.
  const facts = [
    `überfällige Zusagen: ${plan.stats.overdueCommitments}`,
    `heute fällige Zusagen: ${plan.stats.dueTodayCommitments}`,
    `Mails, die Antwort brauchen: ${plan.stats.repliesWaiting}`,
    `Termine heute: ${plan.stats.eventsToday}`,
    `Todos heute/überfällig: ${plan.stats.todosDueToday}`,
    `mögliche (zu bestätigende) Zusagen: ${plan.stats.questions}`,
    plan.collisions.length ? `Hinweise: ${plan.collisions.map((c) => c.message).join(' | ')}` : '',
    `ruhiger Tag: ${plan.isCalm ? 'ja' : 'nein'}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const out = await aiGenerate({
      userId,
      model: AI_MODEL_FAST,
      maxOutputTokens: 160,
      temperature: 0.4,
      system: SYSTEM_PROMPT,
      prompt: `Fakten des heutigen Plans:\n${facts}\n\nSchreibe die Zusammenfassung.`,
    });
    const cleaned = out.replace(/^[\s"'`*]+|[\s"'`*]+$/g, '').replace(/\s+/g, ' ').trim();
    return cleaned.length >= 8 ? cleaned.slice(0, 400) : fallback;
  } catch {
    return fallback;
  }
}
