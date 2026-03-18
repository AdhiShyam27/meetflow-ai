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

// ── POST /api/notes — upload markdown files ────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: exceeds 500KB limit`);
      continue;
    }

    const content = await file.text();
    if (!content.trim()) {
      errors.push(`${file.name}: empty file`);
      continue;
    }

    const { data, error } = await supabase
      .from("user_notes")
      .insert({ user_id: user.id, filename: file.name, content })
      .select("id, filename")
      .single();

    if (error) {
      errors.push(`${file.name}: ${error.message}`);
    } else if (data) {
      inserted.push(data);
    }
  }

  return NextResponse.json({ inserted, errors });
}
