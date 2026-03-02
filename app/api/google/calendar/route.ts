import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getValidGoogleToken, googleFetch } from "@/lib/google/client";

function detectPlatform(event: Record<string, unknown>): string {
  const conf = event.conferenceData as Record<string, unknown> | undefined;
  if (conf?.conferenceSolution) {
    const sol = conf.conferenceSolution as Record<string, unknown>;
    const key = sol.key as Record<string, string> | undefined;
    if (key?.type === "hangoutsMeet") return "google_meet";
  }
  // Check location / description for Zoom or Teams links
  const text = `${event.location ?? ""} ${event.description ?? ""}`.toLowerCase();
  if (text.includes("zoom.us")) return "zoom";
  if (text.includes("teams.microsoft.com")) return "teams";
  if (text.includes("meet.google.com")) return "google_meet";
  return "other";
}

function getMeetLink(event: Record<string, unknown>): string | null {
  const conf = event.conferenceData as Record<string, unknown> | undefined;
  if (conf?.entryPoints) {
    const entries = conf.entryPoints as Array<Record<string, string>>;
    const video = entries.find((e) => e.entryPointType === "video");
    if (video?.uri) return video.uri;
  }
  return null;
}

export async function GET() {
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

  try {
    const token = await getValidGoogleToken(user.id);

    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: weekAhead.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "10",
    });

    const res = await googleFetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      token
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch calendar" }, { status: 502 });
    }

    const data = await res.json();
    const items = (data.items ?? []) as Array<Record<string, unknown>>;

    const events = items
      .filter((e) => e.status !== "cancelled")
      .map((e) => {
        const start = e.start as Record<string, string>;
        const end = e.end as Record<string, string>;
        const attendees = (e.attendees as Array<Record<string, string>> | undefined) ?? [];
        return {
          id: e.id,
          title: e.summary ?? "Untitled Event",
          start: start.dateTime ?? start.date,
          end: end.dateTime ?? end.date,
          platform: detectPlatform(e),
          meetLink: getMeetLink(e),
          attendees: attendees.map((a) => ({ email: a.email, name: a.displayName ?? a.email })),
          location: e.location ?? null,
        };
      });

    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not connected")) {
      return NextResponse.json({ events: [], connected: false });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
