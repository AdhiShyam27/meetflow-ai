import { NextRequest, NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/encryption";

const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://your-project.supabase.co";

// GET /api/meetings/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Decrypt transcript before sending to client
    if (data.transcript) {
      data.transcript = decrypt(data.transcript, user.id);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/meetings/:id]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH /api/meetings/[id] — update transcript + summary
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // ── Input validation ────────────────────────────────────────────────────
    // Prevent excessively large payloads from being stored
    const MAX_TITLE = 300;
    const MAX_TRANSCRIPT = 200_000; // ~200KB plain text
    const MAX_SUMMARY = 50_000;    // ~50KB JSON
    const MAX_LANG = 100;

    if (body.title !== undefined && (typeof body.title !== "string" || body.title.length > MAX_TITLE)) {
      return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }
    if (body.transcript !== undefined && (typeof body.transcript !== "string" || body.transcript.length > MAX_TRANSCRIPT)) {
      return NextResponse.json({ error: "Transcript too large" }, { status: 400 });
    }
    if (body.summary !== undefined && typeof body.summary !== "object") {
      return NextResponse.json({ error: "Invalid summary" }, { status: 400 });
    }
    if (body.primary_language !== undefined && (typeof body.primary_language !== "string" || body.primary_language.length > MAX_LANG)) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }
    if (body.notes !== undefined && !Array.isArray(body.notes)) {
      return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
    }
    const ALLOWED_STATUSES = ["recording", "processing", "done", "error"];
    if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("meetings")
      .update({
        ...(body.title !== undefined && { title: body.title }),
        // Encrypt transcript at rest before writing to DB
        ...(body.transcript !== undefined && { transcript: encrypt(body.transcript, user.id) }),
        ...(body.summary !== undefined && { summary: body.summary }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.duration !== undefined && { duration: body.duration }),
        ...(body.detected_languages !== undefined && { detected_languages: body.detected_languages }),
        ...(body.primary_language !== undefined && { primary_language: body.primary_language }),
        ...(body.notes !== undefined && { notes: body.notes }),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    // Return decrypted transcript to client
    if (data?.transcript) {
      data.transcript = decrypt(data.transcript, user.id);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[PATCH /api/meetings/:id]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/meetings/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode) {
    return NextResponse.json({ ok: true });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("meetings")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/meetings/:id]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
