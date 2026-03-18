import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { rateLimit } from "@/lib/rate-limiter";
import { buildSummaryEmailHtml, sendGmailMessage } from "@/lib/gmail";
import { getValidGoogleToken } from "@/lib/google/client";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkflowConfig {
  slack: { enabled: boolean; webhookUrl: string };
  email: { enabled: boolean; recipients: string };
  notion: { enabled: boolean; apiKey: string; databaseId: string };
  linear: { enabled: boolean; apiKey: string; teamId: string };
  webhook: { enabled: boolean; url: string };
}

interface Summary {
  overview?: string;
  keyPoints?: string[];
  actionItems?: Array<{ task: string; owner?: string | null; dueDate?: string | null }>;
  decisions?: string[];
  questions?: string[];
}

interface MeetingRow {
  id: string;
  title: string;
  platform: string;
  duration: number;
  created_at: string;
  transcript?: string | null;
  summary?: Summary | null;
  workflow_runs?: Record<string, WorkflowRunResult>;
}

interface WorkflowRunResult {
  status: "success" | "error";
  error?: string;
  at: string;
}

const DEFAULT_CONFIG: WorkflowConfig = {
  slack: { enabled: false, webhookUrl: "" },
  email: { enabled: false, recipients: "" },
  notion: { enabled: false, apiKey: "", databaseId: "" },
  linear: { enabled: false, apiKey: "", teamId: "" },
  webhook: { enabled: false, url: "" },
};

function loadConfig(raw: string | null, userId: string): WorkflowConfig {
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    const decrypted = decrypt(raw, userId);
    const parsed = JSON.parse(decrypted) as Partial<WorkflowConfig>;
    return {
      slack: { ...DEFAULT_CONFIG.slack, ...parsed.slack },
      email: { ...DEFAULT_CONFIG.email, ...parsed.email },
      notion: { ...DEFAULT_CONFIG.notion, ...parsed.notion },
      linear: { ...DEFAULT_CONFIG.linear, ...parsed.linear },
      webhook: { ...DEFAULT_CONFIG.webhook, ...parsed.webhook },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// ── Workflow runners ───────────────────────────────────────────────────────────

async function runSlack(config: WorkflowConfig["slack"], meeting: MeetingRow): Promise<void> {
  if (!config.webhookUrl) throw new Error("Slack webhook URL not configured");
  const summary = meeting.summary ?? {};
  const payload = {
    text: `*Meeting Summary: ${meeting.title}*`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📋 ${meeting.title}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: summary.overview || "No summary available" },
      },
      ...(summary.actionItems?.length
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  "*Action Items:*\n" +
                  summary.actionItems
                    .map(
                      (a) =>
                        `• ${a.task}${a.owner ? ` — ${a.owner}` : ""}${a.dueDate ? ` (${a.dueDate})` : ""}`
                    )
                    .join("\n"),
              },
            },
          ]
        : []),
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Platform: ${meeting.platform} · Duration: ${Math.floor((meeting.duration || 0) / 60)}m · ${new Date(meeting.created_at).toLocaleDateString()}`,
          },
        ],
      },
    ],
  };

  const res = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Slack error: ${res.status}`);
}

async function runEmail(
  config: WorkflowConfig["email"],
  meeting: MeetingRow,
  userId: string
): Promise<void> {
  if (!config.recipients) throw new Error("No email recipients configured");

  const recipients = config.recipients
    .split(",")
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  if (recipients.length === 0) throw new Error("No valid email recipients");

  const accessToken = await getValidGoogleToken(userId);
  const html = buildSummaryEmailHtml({
    title: meeting.title,
    created_at: meeting.created_at,
    platform: meeting.platform,
    duration: meeting.duration,
    summary: meeting.summary ?? null,
  });
  const subject = `Meeting Summary: ${meeting.title}`;

  // Send to first recipient, BCC the rest
  const [primaryTo, ...rest] = recipients;
  await sendGmailMessage(
    accessToken,
    primaryTo,
    subject,
    html,
    rest.length > 0 ? rest.join(", ") : undefined
  );
}

async function runNotion(config: WorkflowConfig["notion"], meeting: MeetingRow): Promise<void> {
  if (!config.apiKey) throw new Error("Notion API key not configured");
  if (!config.databaseId) throw new Error("Notion database ID not configured");

  const summary = meeting.summary ?? {};
  const transcript = meeting.transcript ?? "";

  const children: object[] = [
    {
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ text: { content: "Overview" } }] },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ text: { content: summary.overview ?? "" } }] },
    },
  ];

  if (summary.keyPoints?.length) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ text: { content: "Key Points" } }] },
    });
    for (const k of summary.keyPoints) {
      children.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ text: { content: k } }] },
      });
    }
  }

  if (summary.actionItems?.length) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ text: { content: "Action Items" } }] },
    });
    for (const a of summary.actionItems) {
      children.push({
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: [
            {
              text: {
                content: `${a.task}${a.owner ? ` [${a.owner}]` : ""}${a.dueDate ? ` (${a.dueDate})` : ""}`,
              },
            },
          ],
          checked: false,
        },
      });
    }
  }

  if (transcript) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ text: { content: "Transcript" } }] },
    });
    const chunks = transcript.match(/.{1,2000}/g) ?? [];
    for (const chunk of chunks.slice(0, 10)) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ text: { content: chunk } }] },
      });
    }
  }

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: config.databaseId },
      properties: {
        Name: { title: [{ text: { content: meeting.title } }] },
        Date: { date: { start: meeting.created_at.slice(0, 10) } },
        Platform: { rich_text: [{ text: { content: meeting.platform } }] },
      },
      children,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Notion error: ${err.message || res.status}`);
  }
}

async function runLinear(config: WorkflowConfig["linear"], meeting: MeetingRow): Promise<void> {
  if (!config.apiKey) throw new Error("Linear API key not configured");
  if (!config.teamId) throw new Error("Linear team ID not configured");

  const actionItems = meeting.summary?.actionItems ?? [];
  if (actionItems.length === 0) return; // nothing to create

  for (const item of actionItems) {
    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success } }`,
        variables: {
          input: {
            teamId: config.teamId,
            title: item.task,
            description:
              `From meeting: ${meeting.title}\nDate: ${meeting.created_at.slice(0, 10)}` +
              (item.owner ? `\nAssigned to: ${item.owner}` : "") +
              (item.dueDate ? `\nDue: ${item.dueDate}` : ""),
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Linear error: ${res.status}`);
  }
}

async function runWebhook(config: WorkflowConfig["webhook"], meeting: MeetingRow): Promise<void> {
  if (!config.url) throw new Error("Webhook URL not configured");

  const payload = {
    event: "meeting.completed",
    meeting: {
      id: meeting.id,
      title: meeting.title,
      platform: meeting.platform,
      duration: meeting.duration,
      createdAt: meeting.created_at,
      summary: meeting.summary,
      transcript: meeting.transcript,
    },
  };

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MeetFlow-Event": "meeting.completed",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Webhook error: ${res.status}`);
}

// ── POST /api/workflows/run ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 10 workflow runs per hour per user
  const rl = rateLimit(`workflow-run:${user.id}`, 10, 60 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many workflow runs. Please wait before running again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const body = await request.json() as { meetingId?: unknown; workflows?: unknown };
  const meetingId = body?.meetingId;
  if (!meetingId || typeof meetingId !== "string") {
    return NextResponse.json({ error: "meetingId required" }, { status: 400 });
  }

  // Validate workflows filter if provided
  const ALL_WORKFLOW_KEYS = ["slack", "email", "notion", "linear", "webhook"] as const;
  type WorkflowKey = typeof ALL_WORKFLOW_KEYS[number];
  let workflowFilter: WorkflowKey[] | null = null;

  if (body.workflows !== undefined) {
    if (!Array.isArray(body.workflows)) {
      return NextResponse.json({ error: "workflows must be an array" }, { status: 400 });
    }
    workflowFilter = (body.workflows as unknown[]).filter(
      (w): w is WorkflowKey => typeof w === "string" && (ALL_WORKFLOW_KEYS as readonly string[]).includes(w)
    );
  }

  // Load meeting (must belong to user)
  const { data: meetingRaw } = await supabase
    .from("meetings")
    .select("id, title, platform, duration, created_at, transcript, summary, workflow_runs")
    .eq("id", meetingId)
    .eq("user_id", user.id)
    .single();

  if (!meetingRaw) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Decrypt transcript
  const meeting: MeetingRow = {
    ...meetingRaw,
    transcript: meetingRaw.transcript ? decrypt(meetingRaw.transcript, user.id) : meetingRaw.transcript,
  };

  // Load workflow config
  const { data: profile } = await supabase
    .from("profiles")
    .select("workflow_config")
    .eq("id", user.id)
    .single();

  const config = loadConfig(profile?.workflow_config ?? null, user.id);

  // Determine which workflows to run
  type Runner = () => Promise<void>;
  const toRun: Array<{ key: WorkflowKey; runner: Runner }> = [];

  const candidates: Array<{ key: WorkflowKey; enabled: boolean; runner: Runner }> = [
    {
      key: "slack",
      enabled: config.slack.enabled,
      runner: () => runSlack(config.slack, meeting),
    },
    {
      key: "email",
      enabled: config.email.enabled,
      runner: () => runEmail(config.email, meeting, user.id),
    },
    {
      key: "notion",
      enabled: config.notion.enabled,
      runner: () => runNotion(config.notion, meeting),
    },
    {
      key: "linear",
      enabled: config.linear.enabled,
      runner: () => runLinear(config.linear, meeting),
    },
    {
      key: "webhook",
      enabled: config.webhook.enabled,
      runner: () => runWebhook(config.webhook, meeting),
    },
  ];

  for (const c of candidates) {
    const shouldRun = workflowFilter ? workflowFilter.includes(c.key) : c.enabled;
    if (shouldRun) {
      toRun.push({ key: c.key, runner: c.runner });
    }
  }

  // Run all in parallel
  const settled = await Promise.allSettled(toRun.map((t) => t.runner()));

  // Build results map
  const results: Record<string, WorkflowRunResult> = {};
  for (let i = 0; i < toRun.length; i++) {
    const key = toRun[i].key;
    const outcome = settled[i];
    results[key] = {
      status: outcome.status === "fulfilled" ? "success" : "error",
      ...(outcome.status === "rejected"
        ? { error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) }
        : {}),
      at: new Date().toISOString(),
    };
  }

  // Merge with existing workflow_runs on the meeting
  const existingRuns = (meetingRaw.workflow_runs as Record<string, WorkflowRunResult> | null) ?? {};
  const mergedRuns = { ...existingRuns, ...results };

  await supabase
    .from("meetings")
    .update({ workflow_runs: mergedRuns })
    .eq("id", meetingId);

  return NextResponse.json({ results });
}
