import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { getEffectiveAIKey } from '@/lib/ai/get-effective-key';
import { aiGenerate, AI_MODEL_FAST, aiGatewayConfigured } from '@/lib/ai/gateway';
import type { ParsedGmailMessage } from './gmail';
import { domainOf } from './classify-inbox';

// Cap per sync pass — avoids runaway AI cost on a workspace that
// suddenly receives mail from 200 new domains. New uncategorised
// domains beyond this carry over to the next sync pass.
const MAX_CLASSIFY_PER_PASS = 8;

// Hard guard — refuse anything longer/shorter so a confused model
// can't pollute the sidebar with paragraph-length "topics".
const TOPIC_MAX_CHARS = 24;
const TOPIC_MIN_CHARS = 3;

// Model choice: small + fast. Classification is a one-shot decision
// from a domain + sample subjects; a frontier model adds cost without
// adding signal. Override per-deployment via TOPIC_AI_MODEL.
function topicModel(defaultModel: string): string {
  return process.env.TOPIC_AI_MODEL ?? defaultModel;
}

const SYSTEM_PROMPT = `Du klassifizierst E-Mail-Absender in EIN deutsches Themenwort.

Regeln:
- Antworte mit EINEM Wort, optional zwei verbundenen Wörtern. Niemals Sätze.
- Deutsch, sentence case (z.B. "Mode", "Lieferdienste", "Newsletter").
- Beispiele: zalando.de → "Mode" · netflix.com → "Streaming" · github.com → "Developer" · dpd.de → "Versand".
- Bei Unklarheit: "Sonstiges".
- Maximal ${TOPIC_MAX_CHARS} Zeichen, nur Buchstaben und Leerzeichen.`;

type DomainSample = {
  domain: string;
  recentSubjects: string[];
};

/**
 * Public entrypoint called by the sync loop. Identifies new domains in
 * the just-synced batch that don't yet have a topic in sender_topics,
 * asks the model for a one-word classification per domain, persists.
 *
 * Failures are local — one domain's bad response doesn't kill the rest.
 */
export async function classifyNewDomains(input: {
  userId: string;
  workspaceId: string;
  parsed: ParsedGmailMessage[];
}): Promise<{ classified: number; skipped: number }> {
  const { userId, workspaceId, parsed } = input;
  const db = getDb();

  // 1. Collect candidate domains from the just-synced inbound messages.
  // Sent items don't help us learn anything — they're from us.
  const samples = new Map<string, string[]>();
  for (const m of parsed) {
    if (m.direction !== 'inbox') continue;
    const domain = domainOf(m.senderEmail);
    if (!domain) continue;
    const subjects = samples.get(domain) ?? [];
    if (subjects.length < 3 && m.subject) subjects.push(m.subject);
    samples.set(domain, subjects);
  }
  if (samples.size === 0) return { classified: 0, skipped: 0 };

  // 2. Filter to domains we haven't classified yet for this workspace.
  const candidateDomains = Array.from(samples.keys());
  const existing = await db
    .select({ domain: s.senderTopics.domain })
    .from(s.senderTopics)
    .where(
      and(
        eq(s.senderTopics.workspaceId, workspaceId),
        inArray(s.senderTopics.domain, candidateDomains)
      )
    );
  const seen = new Set(existing.map((r) => r.domain));
  const todo: DomainSample[] = candidateDomains
    .filter((d) => !seen.has(d))
    .slice(0, MAX_CLASSIFY_PER_PASS)
    .map((d) => ({ domain: d, recentSubjects: samples.get(d) ?? [] }));
  if (todo.length === 0) return { classified: 0, skipped: 0 };

  // 3. Resolve the AI key. Prefer Vercel AI Gateway via the new SDK
  // wrapper; fall back to the legacy fetch path for user-BYOK or
  // direct-OpenAI deployments. No key configured → quiet skip; the
  // deterministic A+B classification still works without AI.
  const useGateway = aiGatewayConfigured();
  const key = useGateway ? null : await getEffectiveAIKey(userId);
  if (!useGateway && !key) return { classified: 0, skipped: todo.length };

  // 4. Classify each domain in parallel with concurrency 3 to keep
  // per-pass latency bounded.
  let classified = 0;
  let skipped = 0;
  const results = await Promise.all(
    todo.map(async (entry) => {
      const topic = await classifyOne(entry, key, useGateway).catch(() => null);
      return { entry, topic };
    })
  );

  for (const { entry, topic } of results) {
    if (!topic) {
      skipped += 1;
      continue;
    }
    try {
      await db
        .insert(s.senderTopics)
        .values({
          workspaceId,
          domain: entry.domain,
          topic,
          source: 'ai',
        })
        .onConflictDoNothing({
          target: [s.senderTopics.workspaceId, s.senderTopics.domain],
        });
      classified += 1;
    } catch (e) {
      console.warn(`[classify-topic] persist failed for ${entry.domain}:`, e);
      skipped += 1;
    }
  }

  return { classified, skipped };
}

async function classifyOne(
  entry: DomainSample,
  key: Awaited<ReturnType<typeof getEffectiveAIKey>> | null,
  useGateway: boolean
): Promise<string | null> {
  const subjectsBlock = entry.recentSubjects.length
    ? `\n\nLetzte Betreffe von dieser Domain:\n${entry.recentSubjects.map((s) => `- ${s}`).join('\n')}`
    : '';
  const userPrompt = `Domain: ${entry.domain}${subjectsBlock}\n\nThemen-Klassifikation:`;

  if (useGateway) {
    // Vercel AI Gateway via the `ai` SDK. Cheap+fast model; one-word
    // answer needs almost no tokens.
    try {
      const raw = await aiGenerate({
        model: process.env.TOPIC_AI_MODEL ?? AI_MODEL_FAST,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 16,
        temperature: 0.2,
      });
      return normalizeTopic(raw.trim());
    } catch {
      return null;
    }
  }

  // Legacy fetch path — user-BYOK direct to OpenAI, or
  // OPENAI_API_KEY env. Same prompt, same response shape.
  if (!key) return null;
  const res = await fetch(`${key.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key.apiKey}`,
    },
    body: JSON.stringify({
      model: topicModel(key.defaultModel),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 16,
      temperature: 0.2,
    }),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? '';
  return normalizeTopic(raw);
}

function normalizeTopic(raw: string): string | null {
  // Strip surrounding quotes, periods, leading "Topic:" prefixes.
  let t = raw
    .replace(/^[\s"'`*]+|[\s"'`*\.]+$/g, '')
    .replace(/^Topic[:\s-]+/i, '')
    .replace(/^Thema[:\s-]+/i, '')
    .replace(/^Klassifikation[:\s-]+/i, '')
    .trim();
  // Take only the first line — model occasionally adds reasoning.
  t = t.split(/[\n\r]/)[0].trim();
  // Keep letters + spaces + diacritics only, drop anything else.
  t = t.replace(/[^a-zA-ZäöüÄÖÜß\s-]/g, '').trim();
  // Cap to two words (e.g. "Lieferdienste DE" → "Lieferdienste DE").
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 2) t = words.slice(0, 2).join(' ');
  if (t.length < TOPIC_MIN_CHARS || t.length > TOPIC_MAX_CHARS) return null;
  // Sentence case.
  return t.charAt(0).toUpperCase() + t.slice(1);
}
