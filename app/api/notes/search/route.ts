import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

// ── POST /api/notes/search — full-text search user notes ──────────────────

export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const limit = Math.min(Math.max(Number(body?.limit) || 5, 1), 20);

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  // Use Supabase's textSearch which maps to plainto_tsquery
  const { data, error } = await supabase
    .from("user_notes")
    .select("id, filename, content")
    .eq("user_id", user.id)
    .textSearch("tsv", query, { type: "plain" })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build snippets from matched content (first 300 chars around match)
  const results = (data ?? []).map((note) => {
    const lowerContent = note.content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerContent.indexOf(lowerQuery);
    const start = Math.max(0, idx - 100);
    const end = Math.min(note.content.length, idx + query.length + 200);
    const snippet = (start > 0 ? "..." : "") + note.content.slice(start, end) + (end < note.content.length ? "..." : "");

    return {
      id: note.id,
      filename: note.filename,
      snippet,
    };
  });

  return NextResponse.json({ results });
}
