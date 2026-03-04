import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limiter";

const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://your-project.supabase.co";

const MOCK_SUMMARY = {
  overview:
    "The team aligned on key priorities, discussed upcoming milestones, and assigned clear action items to move forward.",
  keyPoints: [
    "Project timeline confirmed with key milestones",
    "Resource allocation reviewed and approved",
    "Risk areas identified and mitigation strategies discussed",
  ],
  actionItems: [
    { task: "Prepare detailed project plan", owner: null, dueDate: null },
    { task: "Schedule follow-up with stakeholders", owner: null, dueDate: null },
    { task: "Send meeting notes to all attendees", owner: null, dueDate: "Today" },
  ],
  decisions: [
    "Agreed on primary approach for Q2 initiative",
    "Approved proposed timeline with two-week buffer",
  ],
  questions: ["What are the dependencies on the external team?"],
};

export async function POST(req: NextRequest) {
  // ── Authentication ────────────────────────────────────────────────────────
  let userId: string | null = null;

  if (!isDemoMode) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  // ── Rate limiting: 20 summaries / minute per user ─────────────────────────
  if (userId) {
    const rl = rateLimit(`summarize:${userId}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before generating another summary." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }
  }

  try {
    const body = await req.json();
    const transcript: unknown = body?.transcript;
    const meetingTitle: unknown = body?.meetingTitle;

    // ── Input validation ──────────────────────────────────────────────────────
    if (typeof transcript !== "string" || typeof meetingTitle !== "string" && meetingTitle !== undefined) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Clamp title to 200 chars
    const safeTitle = String(meetingTitle ?? "Meeting").slice(0, 200);

    if (!transcript || transcript.trim().length < 20) {
      return NextResponse.json({ summary: MOCK_SUMMARY });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey || apiKey === "sk-ant-your-key-here") {
      // Return mock summary in demo mode
      await new Promise((r) => setTimeout(r, 1200));
      return NextResponse.json({ summary: MOCK_SUMMARY });
    }

    // Real Claude API call
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `You are an expert meeting analyst. Analyze this meeting transcript and extract structured insights.

Meeting Title: ${safeTitle}

Transcript:
${transcript.slice(0, 8000)}

Respond with ONLY valid JSON matching this exact schema:
{
  "overview": "2-3 sentence summary of what was discussed and decided",
  "keyPoints": ["string", "string"],
  "actionItems": [
    { "task": "string", "owner": "person name or null", "dueDate": "date string or null" }
  ],
  "decisions": ["string"],
  "questions": ["unresolved questions"]
}

Be concise and actionable. Return only the JSON object with no other text.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ summary: MOCK_SUMMARY });
    }

    // Strip any markdown fences and parse safely
    const raw = content.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let summary: unknown;
    try {
      summary = JSON.parse(raw);
    } catch {
      // Claude returned non-JSON — fall back to mock
      console.error("[/api/summarize] Claude returned non-JSON:", raw.slice(0, 200));
      return NextResponse.json({ summary: MOCK_SUMMARY });
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[/api/summarize]", err);
    return NextResponse.json({ summary: MOCK_SUMMARY });
  }
}
