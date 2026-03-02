import { NextRequest, NextResponse } from "next/server";

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
  try {
    const { transcript, meetingTitle } = await req.json();

    if (!transcript || transcript.trim().length < 20) {
      return NextResponse.json({ summary: MOCK_SUMMARY });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey || apiKey === "sk-ant-your-key-here") {
      // Return mock summary in demo mode
      await new Promise((r) => setTimeout(r, 1200)); // simulate latency
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

Meeting Title: ${meetingTitle || "Meeting"}

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

    // Strip any markdown fences
    const raw = content.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const summary = JSON.parse(raw);

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[/api/summarize]", err);
    return NextResponse.json({ summary: MOCK_SUMMARY });
  }
}
