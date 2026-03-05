import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/rate-limiter";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  // Rate limit by IP — 60 chat messages per minute
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = rateLimit(`chat:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }

  const body = await request.json();
  const { messages, transcript, meetingTitle } = body as {
    messages: { role: "user" | "assistant"; content: string }[];
    transcript?: string;
    meetingTitle?: string;
  };

  if (!messages?.length) {
    return new Response("No messages", { status: 400 });
  }

  const systemPrompt = `You are MeetFlow AI, an intelligent meeting assistant. You help users understand, summarize, and act on their meeting content.
${
  transcript
    ? `\nYou have access to the following meeting transcript for "${meetingTitle ?? "this meeting"}":\n\n${transcript.slice(0, 12000)}\n\nAnswer questions about this meeting specifically. Be concise and actionable. Use markdown formatting with headers, bullet points, and bold text where helpful.`
    : "\nNo transcript is available for this meeting yet."
}`;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Demo mode — return a mock streamed response
  if (!apiKey || apiKey === "sk-ant-your-key-here") {
    const mock =
      "I'm MeetFlow AI! Your **Anthropic API key** isn't configured yet. Add `ANTHROPIC_API_KEY` to your environment variables to enable real AI responses.\n\nOnce configured, I can:\n- Summarize your meeting\n- Extract action items\n- Answer questions about the transcript\n- Generate follow-up emails";

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for (const char of mock) {
          controller.enqueue(encoder.encode(char));
          await new Promise((r) => setTimeout(r, 8));
        }
        controller.close();
      },
    });
    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Real streaming Claude response
  const stream = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
