import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getValidGoogleToken } from "@/lib/google/client";
import { rateLimit } from "@/lib/rate-limiter";
import { buildSummaryEmailHtml, sendGmailMessage } from "@/lib/gmail";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 10 emails per hour per user
  const rl = rateLimit(`send-summary:${user.id}`, 10, 60 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many emails sent. Please wait before sending another." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const body = await request.json();
  const meetingId: unknown = body?.meetingId;
  if (!meetingId || typeof meetingId !== "string") {
    return NextResponse.json({ error: "meetingId required" }, { status: 400 });
  }

  // Optional additional recipients
  const rawRecipients: unknown = body?.recipientEmails;
  let additionalRecipients: string[] = [];
  if (Array.isArray(rawRecipients)) {
    additionalRecipients = (rawRecipients as unknown[])
      .filter((e): e is string => typeof e === "string" && isValidEmail(e))
      .slice(0, 20);
    if (additionalRecipients.length !== (rawRecipients as unknown[]).length) {
      const invalidCount = (rawRecipients as unknown[]).length - additionalRecipients.length;
      if (invalidCount > 0 && additionalRecipients.length === 0) {
        return NextResponse.json({ error: "No valid recipient email addresses provided" }, { status: 400 });
      }
    }
  }

  // Load meeting + user's google email
  const [{ data: meeting }, { data: profile }] = await Promise.all([
    supabase.from("meetings").select("title, summary, created_at, platform, duration").eq("id", meetingId).eq("user_id", user.id).single(),
    supabase.from("profiles").select("google_email").eq("id", user.id).single(),
  ]);

  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  if (!meeting.summary) return NextResponse.json({ error: "No summary to send" }, { status: 400 });
  if (!profile?.google_email) return NextResponse.json({ error: "Google not connected" }, { status: 400 });

  try {
    const token = await getValidGoogleToken(user.id);
    const html = buildSummaryEmailHtml(meeting as Parameters<typeof buildSummaryEmailHtml>[0]);
    const subject = `Meeting Summary: ${meeting.title}`;

    const primaryTo = additionalRecipients.length > 0
      ? additionalRecipients[0]
      : profile.google_email;

    const bccAddresses: string[] = [];
    if (additionalRecipients.length > 0) {
      bccAddresses.push(profile.google_email);
      if (additionalRecipients.length > 1) {
        bccAddresses.push(...additionalRecipients.slice(1));
      }
    }

    await sendGmailMessage(
      token,
      primaryTo,
      subject,
      html,
      bccAddresses.length > 0 ? bccAddresses.join(", ") : undefined
    );

    const sentTo = additionalRecipients.length > 0
      ? [primaryTo, ...bccAddresses].join(", ")
      : profile.google_email;

    return NextResponse.json({ success: true, sentTo });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
