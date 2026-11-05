import { NextRequest, NextResponse } from "next/server";

const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://your-project.supabase.co";

// GET /api/stars — ids of the meetings the current user has starred
export async function GET() {
  if (isDemoMode) {
    return NextResponse.json({ starred: [] });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("stars")
      .select("meeting_id")
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({
      starred: (data ?? []).map((row) => row.meeting_id as string),
    });
  } catch (err) {
    console.error("[GET /api/stars]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/stars — toggle a star for { meeting_id }
export async function POST(req: NextRequest) {
  if (isDemoMode) {
    return NextResponse.json({ starred: true });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const meetingId = body?.meeting_id;
    if (typeof meetingId !== "string" || meetingId.length === 0) {
      return NextResponse.json({ error: "meeting_id is required" }, { status: 400 });
    }

    // Does a star already exist for this user + meeting?
    const { data: existing, error: lookupError } = await supabase
      .from("stars")
      .select("id")
      .eq("user_id", user.id)
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (existing) {
      const { error } = await supabase.from("stars").delete().eq("id", existing.id);
      if (error) throw error;
      return NextResponse.json({ starred: false });
    }

    const { error } = await supabase
      .from("stars")
      .insert({ user_id: user.id, meeting_id: meetingId });

    if (error) throw error;
    return NextResponse.json({ starred: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/stars]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
