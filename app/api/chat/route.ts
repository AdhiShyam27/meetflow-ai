import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limiter";
import { chatCompletion, resolveLLMConfig } from "@/lib/llm";

const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://your-project.supabase.co";

export async function POST(request: NextRequest) {
  // ── Authentication ────────────────────────────────────────────────────────
  let userId: string | null = null;

  if (!isDemoMode) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }
    userId = user.id;
  }

  // Rate limit by user (authenticated) or IP (fallback)
  const rateLimitKey = userId
    ? `chat:${userId}`
    : `chat:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;

  const rl = rateLimit(rateLimitKey, 60, 60_000);
  if (!rl.allowed) {
    return new Response("Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

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
  const config = await resolveLLMConfig(userId);

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

  try {
    const readable = await chatCompletion(config, {
      system: systemPrompt,
      messages,
      maxTokens: 2048,
      stream: true,
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[/api/chat]", err);
    return new Response("AI service temporarily unavailable", { status: 502 });
  }
}
