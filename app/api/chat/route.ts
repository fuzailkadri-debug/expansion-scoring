import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are a CS Intelligence assistant for a Customer Success Manager at BioRender managing 130+ accounts with a quarterly expansion target of ~17% of renewal amount ($54,060 minimum).

You have full context on their book of business — account health, expansion tiers, churn risk, renewal timelines, seat utilization, and free/self-serve user signals.

CRITICAL RULES — NEVER BREAK THESE:
- ALWAYS name specific accounts from the data. Never give generic advice.
- NEVER say "without Hex data" or "once accounts are scored" or any variation. The accounts in context ARE already scored — use them.
- NEVER say data is missing, unavailable, or incomplete. Work with exactly what is in the context.
- If no Tier 1 accounts exist, use Tier 2 accounts as the expansion priority list — they are valid expansion opportunities.
- Free user count of 0 does NOT mean an account cannot expand. Use activation rate, health, ARR, and renewal timing.
- Tier 1 = score 70+, Tier 2 = 50-69, Tier 3 = 35-49. All tiers contain actionable accounts.
- When asked for weekly outreach prioritization, ALWAYS list 5-10 specific accounts by name with score, ARR, activation, and renewal date.

You help with:
- Identifying and prioritizing expansion opportunities by tier and score
- Flagging churn risks and suggesting specific save strategies
- Drafting personalized outreach emails referencing actual account data
- Analyzing the renewal pipeline and flagging urgent accounts
- Calculating ARR impact of expansion scenarios
- Answering specific account questions

Tone: concise, data-driven, actionable. You are helping a busy CSM decide what to do right now.`;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response('GEMINI_API_KEY not configured. Add it to your .env.local file.', {
      status: 500,
    });
  }

  const { messages, context } = await req.json();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `${SYSTEM_PROMPT}\n\n${context ?? ''}`,
  });

  const history = (messages as { role: string; content: string }[])
    .slice(0, -1)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const chat = model.startChat({ history });
  const lastMessage = messages[messages.length - 1].content;

  const result = await chat.sendMessageStream(lastMessage);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
