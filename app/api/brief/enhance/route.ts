import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/current-user';
import { getEffectiveAIKey } from '@/lib/ai/get-effective-key';

/**
 * Optional AI enhancement of the daily brief. Gated on AI_GATEWAY_API_KEY.
 *
 * Sends the deterministic brief script to a chat completion endpoint and asks
 * for a tighter, more human spoken version (~60-90s read time). If no key is
 * configured, returns the original script verbatim so the client falls back
 * gracefully.
 *
 * Vercel AI Gateway: `https://ai-gateway.vercel.sh/v1/chat/completions`
 * model: `openai/gpt-4o-mini` (cheap, fast — change if a different default
 *        is configured for the project).
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => null);
  const script = typeof body?.script === 'string' ? body.script : '';
  if (!script) return NextResponse.json({ text: '' });

  const effective = await getEffectiveAIKey(user.id);
  if (!effective) return NextResponse.json({ text: script });
  const apiKey = effective.apiKey;
  const url = `${effective.baseUrl}/chat/completions`;
  const model = process.env.BRIEF_MODEL ?? effective.defaultModel;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Du bist ein knapper, professioneller deutscher Sprecher-Brief. Du nimmst einen strukturierten Tagesbrief und machst ihn natürlich, flüssig, freundlich, aber sachlich — wie ein guter Chief-of-Staff der seinen Boss morgens briefed. Maximal 90 Sekunden Lesezeit. Keine Aufzählungen, ganze Sätze. Du sprichst Pascal, oder wer immer im Brief angesprochen wird, direkt mit Vornamen an.',
          },
          { role: 'user', content: script },
        ],
        temperature: 0.4,
        max_tokens: 380,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return NextResponse.json({ text: script });
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    if (!text || text.length < 20) return NextResponse.json({ text: script });
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ text: script });
  }
}
