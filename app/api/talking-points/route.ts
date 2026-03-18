import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limiter";
import { chatCompletion, resolveLLMConfig, FAST_MODEL } from "@/lib/llm";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 10 requests per minute
  const rl = rateLimit(`talkingpoints:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ suggestions: [] }, { status: 429 });
  }

  const body = await request.json();
  const recentTranscript = typeof body?.recentTranscript === "string" ? body.recentTranscript.slice(0, 2000) : "";
  const meetingTitle = typeof body?.meetingTitle === "string" ? body.meetingTitle.slice(0, 200) : "Meeting";

  if (!recentTranscript.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  // Search user notes for relevant content
  const { data: noteResults } = await supabase
    .from("user_notes")
    .select("id, filename, content")
    .eq("user_id", user.id)
    .textSearch("tsv", recentTranscript.split(/\s+/).slice(0, 10).join(" "), { type: "plain" })
    .limit(3);

  if (!noteResults?.length) {
    return NextResponse.json({ suggestions: [] });
  }

  // Build context from matched notes
  const noteSnippets = noteResults.map((n) => {
    return `[${n.filename}]: ${n.content.slice(0, 500)}`;
  }).join("\n\n");

  // Generate talking points
  const config = await resolveLLMConfig(user.id);
  if (!config) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const tpConfig = { ...config, model: FAST_MODEL };

    const result = await chatCompletion(tpConfig, {
      system: "You are a meeting preparation assistant. Based on recent conversation context and the user's notes, suggest 2-4 concise talking points the user should bring up. Each point should be one sentence. Return ONLY a JSON array of strings, nothing else.",
      messages: [
        {
          role: "user",
          content: `Meeting: ${meetingTitle}

Recent conversation:
${recentTranscript}

My relevant notes:
${noteSnippets}

Suggest 2-4 talking points I should bring up based on my notes that are relevant to the current conversation. Return as JSON array of strings.`,
        },
      ],
      maxTokens: 500,
      stream: false,
    });

    // Parse JSON array from response
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter((s): s is string => typeof s === "string").slice(0, 4);
      }
    } catch {
      // If JSON parsing fails, try to extract lines
      suggestions = cleaned
        .split("\n")
        .map((l) => l.replace(/^[-*•\d.]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 4);
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[/api/talking-points]", err);
    return NextResponse.json({ suggestions: [] });
  }
}
