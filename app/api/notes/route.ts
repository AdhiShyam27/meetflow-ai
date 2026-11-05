import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const MAX_FILES = 50;
const MAX_FILE_SIZE = 500 * 1024; // 500KB

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

// ── GET /api/notes — list user's notes ─────────────────────────────────────

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_notes")
    .select("id, filename, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ notes: data ?? [] });
}

// ── POST /api/notes — create one note (JSON) or upload markdown files ──────
//
// JSON body: { filename: string, content: string }
//   Both fields are required; blank (after trim) returns 400 with a message.
// multipart/form-data: files[] (existing upload path)

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    let body: { filename?: unknown; content?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!filename && !content) {
      return NextResponse.json({ error: "Filename and content are required" }, { status: 400 });
    }
    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }
    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }
    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Content exceeds 500KB limit" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_notes")
      .insert({ user_id: user.id, filename, content })
      .select("id, filename, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ note: data }, { status: 201 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files per upload` }, { status: 400 });
  }

  const inserted: { id: string; filename: string }[] = [];
  const errors: string[] = [];

  // Validate files first, then insert in parallel
  const validFiles: { name: string; content: string }[] = [];
  for (const file of files) {
    if (!file.name?.trim()) {
      errors.push("A file with no name was skipped: filename is required");
      continue;
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: exceeds 500KB limit`);
      continue;
    }
    const content = await file.text();
    if (!content.trim()) {
      errors.push(`${file.name}: empty file`);
      continue;
    }
    validFiles.push({ name: file.name, content });
  }

  // Insert all valid files in parallel
  const results = await Promise.allSettled(
    validFiles.map(async (f) => {
      const { data, error } = await supabase
        .from("user_notes")
        .insert({ user_id: user.id, filename: f.name, content: f.content })
        .select("id, filename")
        .single();
      if (error) throw new Error(`${f.name}: ${error.message}`);
      return data;
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      inserted.push(result.value);
    } else if (result.status === "rejected") {
      errors.push(result.reason?.message ?? "Unknown error");
    }
  }

  return NextResponse.json({ inserted, errors });
}
