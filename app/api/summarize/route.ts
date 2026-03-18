import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limiter";
import { chatCompletion, resolveLLMConfig, FAST_MODEL } from "@/lib/llm";

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
    { task: "Prepare detailed project plan", owner: null, dueDate: null, priority: "high", completed: false },
    { task: "Schedule follow-up with stakeholders", owner: null, dueDate: null, priority: "medium", completed: false },
    { task: "Send meeting notes to all attendees", owner: null, dueDate: "Today", priority: "low", completed: false },
  ],
  decisions: [
    "Agreed on primary approach for Q2 initiative",
    "Approved proposed timeline with two-week buffer",
  ],
  questions: ["What are the dependencies on the external team?"],
  sentiment: { label: "positive", score: 72 },
  healthScore: 78,
  topics: ["planning", "project management", "timeline"],
  followUpEmail: {
    subject: "Meeting Summary & Next Steps",
    body: "Hi team,\n\nThank you for joining today's meeting. Here's a quick recap:\n\n• The team aligned on key priorities and confirmed project timeline.\n• Three action items were assigned — please review and complete by agreed dates.\n\nLet me know if you have any questions!\n\nBest regards",
  },
  nextAgenda: [
    "Review completion of today's action items",
    "Update on external team dependencies",
    "Q2 initiative progress check",
  ],
};

// ── Template-specific instruction lookup ──────────────────────────────────
const TEMPLATE_INSTRUCTIONS: Record<string, string> = {
  customer_call:
    "Pay special attention to: customer pain points, objections raised, budget/deal size mentioned, competitor mentions, agreed next steps, and probability to close.",
  standup:
    "Pay special attention to: what each participant completed since last standup, what they plan to work on today, and any blockers or impediments.",
  one_on_one:
    "Pay special attention to: progress on OKRs/goals, career development topics discussed, feedback exchanged, personal blockers, and commitments made.",
  interview:
    "Pay special attention to: candidate's answers to technical and behavioral questions, key strengths demonstrated, concerns or red flags, and an overall hiring recommendation.",
  brainstorm:
    "Pay special attention to: all ideas generated (even wild ones), decisions reached, hypotheses or experiments proposed, and next actions.",
  product_review:
    "Pay special attention to: user feedback themes, bugs or issues mentioned, feature requests with implied priority, and product decisions made.",
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
    const template: unknown = body?.template;

    // ── Input validation ──────────────────────────────────────────────────────
    if (typeof transcript !== "string" || typeof meetingTitle !== "string" && meetingTitle !== undefined) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Clamp title to 200 chars
    const safeTitle = String(meetingTitle ?? "Meeting").slice(0, 200);

    // Build optional template instruction
    const templateKey = typeof template === "string" ? template : "general";
    const templateInstruction = TEMPLATE_INSTRUCTIONS[templateKey] ?? "";

    if (!transcript || transcript.trim().length < 20) {
      return NextResponse.json({ summary: MOCK_SUMMARY });
    }

    // Resolve LLM config — prefer fast model for summarization
    const config = await resolveLLMConfig(userId);

    if (!config) {
      await new Promise((r) => setTimeout(r, 1200));
      return NextResponse.json({ summary: MOCK_SUMMARY });
    }

    // Use fast model for summarization (cost-efficient)
    const summarizeConfig = { ...config, model: FAST_MODEL };

    const prompt = `You are an expert meeting analyst and executive coach. Analyze this meeting transcript and extract comprehensive structured insights.

Meeting Title: ${safeTitle}
${templateInstruction ? `\nMeeting type focus: ${templateInstruction}` : ""}

Transcript:
${transcript.slice(0, 10000)}

Respond with ONLY valid JSON matching this exact schema (no markdown, no extra text):
{
  "overview": "2-3 sentence executive summary of what was discussed and decided",
  "keyPoints": ["key point 1", "key point 2"],
  "actionItems": [
    {
      "task": "specific actionable task",
      "owner": "person name or null",
      "dueDate": "date string or null",
      "priority": "high | medium | low",
      "completed": false
    }
  ],
  "decisions": ["decision made in the meeting"],
  "questions": ["unresolved open question"],
  "sentiment": {
    "label": "positive | neutral | negative",
    "score": 75
  },
  "healthScore": 82,
  "topics": ["topic1", "topic2", "topic3"],
  "followUpEmail": {
    "subject": "concise follow-up email subject line",
    "body": "professional follow-up email body (2-4 short paragraphs, no salutation needed)"
  },
  "nextAgenda": ["suggested agenda item for next meeting 1", "agenda item 2"]
}

SCORING GUIDE:
- sentiment.score: 0-100. Positive language, enthusiasm, agreements = higher. Conflict, negativity, confusion = lower.
- healthScore: 0-100. Score based on: clear agenda (20pts), actionable outcomes (20pts), balanced participation (20pts), decisions made (20pts), time efficiency (20pts).
- topics: 2-5 concise lowercase topic tags (e.g. "product roadmap", "hiring", "budget", "q4 planning").
- priority: "high" = blockers/urgent, "medium" = important but not urgent, "low" = nice to have.

Return only the JSON object. Be concise and specific.`;

    const result = await chatCompletion(summarizeConfig, {
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2500,
      stream: false,
    });

    // Strip any markdown fences and parse safely
    const raw = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let summary: unknown;
    try {
      summary = JSON.parse(raw);
    } catch {
      console.error("[/api/summarize] LLM returned non-JSON:", raw.slice(0, 200));
      return NextResponse.json({ summary: MOCK_SUMMARY });
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[/api/summarize]", err);
    return NextResponse.json({ summary: MOCK_SUMMARY });
  }
}
