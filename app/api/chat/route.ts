import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are a CS Intelligence assistant for a Customer Success Manager at BioRender managing 130+ accounts with a quarterly expansion target of ~17% of renewal amount.

You have deep knowledge of their book of business — account health, expansion tiers, churn risk, renewal timelines, seat utilization, and free/self-serve user signals.

You help with:
- Prioritizing accounts for outreach this week/month
- Identifying expansion opportunities (Tier 1 = score 75+)
- Flagging churn risks and suggesting save strategies
- Drafting personalized outreach emails and talking points
- Analyzing the renewal pipeline
- Answering specific questions about accounts
- Calculating ARR impact of expansion scenarios

Tone: concise, data-driven, practical. You are helping a busy CSM prioritize their day.

When drafting emails, make them warm and specific — reference the account's actual health/usage/context.`;

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
