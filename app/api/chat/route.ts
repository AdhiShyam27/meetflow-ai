import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limiter";
import { chatCompletion, resolveLLMConfig } from "@/lib/llm";

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

  // Resolve LLM config (user preference → server default)
  const config = await resolveLLMConfig();

  // Demo mode — return a mock streamed response
  if (!config) {
    const mock =
      "I'm MeetFlow AI! Your **OpenRouter API key** isn't configured yet. Add `OPENROUTER_API_KEY` to your environment variables to enable real AI responses.\n\nOnce configured, I can:\n- Summarize your meeting\n- Extract action items\n- Answer questions about the transcript\n- Generate follow-up emails";

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

  // Real streaming response via OpenRouter
  const readable = await chatCompletion(config, {
    system: systemPrompt,
    messages,
    maxTokens: 2048,
    stream: true,
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
