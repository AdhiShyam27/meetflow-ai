import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/encryption";

const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://your-project.supabase.co";

// GET /api/meetings — list user's meetings
export async function GET() {
  if (isDemoMode) {
    return NextResponse.json({ meetings: [] });
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
      .from("meetings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Decrypt transcripts — handles both encrypted and legacy plaintext rows
    const meetings = (data ?? []).map((m) => ({
      ...m,
      transcript: m.transcript ? decrypt(m.transcript, user.id) : m.transcript,
    }));

    return NextResponse.json({ meetings });
  } catch (err) {
    console.error("[GET /api/meetings]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/meetings — create a new meeting
export async function POST(req: NextRequest) {
  if (isDemoMode) {
    const body = await req.json();
    return NextResponse.json({
      meeting: { id: `local-${Date.now()}`, ...body, status: "recording" },
    });
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

    const body = await req.json();

    const { data, error } = await supabase
      .from("meetings")
      .insert({
        user_id: user.id,
        title: body.title || "Untitled Meeting",
        platform: body.platform || "other",
        language: body.language || "en-US",
        status: "recording",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ meeting: data }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/meetings]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
