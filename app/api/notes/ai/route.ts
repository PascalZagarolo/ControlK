import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { requireCurrentWorkspace } from '@/lib/db/current-workspace';
import { TOOL_DEFINITIONS, runTool } from '@/lib/ai/workspace-tools';
import { getEffectiveAIKey } from '@/lib/ai/get-effective-key';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Workspace-aware AI assistant endpoint.
 *
 * Loop: user question -> model picks tools -> server runs tools -> result fed
 * back -> model writes a final, source-cited answer. Streamed via SSE-style
 * text/event-stream so the UI can render progressively.
 *
 * Gated on AI_GATEWAY_API_KEY (Vercel) or OPENAI_API_KEY (direct OpenAI).
 * Without a key we return a 503 and the UI hides the AI panel.
 *
 * Bounded by maxToolRounds (default 4) so a runaway model can't loop forever.
 */
const MAX_TOOL_ROUNDS = 4;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });
  const ws = await requireCurrentWorkspace();

  const effective = await getEffectiveAIKey(user.id);
  if (!effective) return new NextResponse('AI not configured', { status: 503 });
  const apiKey = effective.apiKey;
  const url = `${effective.baseUrl}/chat/completions`;
  const model = effective.defaultModel;

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === 'string' ? body.question : '';
  if (!question) return NextResponse.json({ error: 'no-question' }, { status: 400 });

  const messages: any[] = [
    {
      role: 'system',
      content: `Du bist der uRent-Workspace-Assistent. Du beantwortest Fragen über die Daten dieses Workspaces — Kunden, Verträge, Termine, Nachrichten, Notizen, Todos. Du nutzt die verfügbaren Tools um echte Daten zu holen, statt zu raten. Antworten sind knapp, faktenbasiert, auf Deutsch. Wenn du etwas nicht via Tool finden kannst, sag das ehrlich. Format: kurzer Absatz mit Fakten, am Ende eine Quellen-Zeile mit den von dir aufgerufenen Tools (z.B. "Quellen: searchCustomers, listContracts").`,
    },
    { role: 'user', content: question },
  ];

  const tools = TOOL_DEFINITIONS.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  let finalText = '';
  let usedTools: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `model-${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    const msg = choice?.message;
    if (!msg) return NextResponse.json({ ok: false, error: 'no-message' }, { status: 502 });

    // Tool round
    if (msg.tool_calls?.length > 0) {
      // Push assistant message + execute each call
      messages.push(msg);
      for (const call of msg.tool_calls) {
        const name = call.function?.name;
        let args: any = {};
        try {
          args = JSON.parse(call.function?.arguments ?? '{}');
        } catch {}
        usedTools.push(name);
        const result = await runTool(name, args, { workspaceId: ws.id, userId: user.id });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    // Final answer
    finalText = String(msg.content ?? '').trim();
    break;
  }

  if (!finalText) {
    finalText = 'Konnte keine eindeutige Antwort generieren. Bitte präzisiere die Frage.';
  }

  return NextResponse.json({
    ok: true,
    answer: finalText,
    toolsUsed: Array.from(new Set(usedTools)),
  });
}
