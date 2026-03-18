import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { encrypt, decrypt } from "@/lib/encryption";
import { DEFAULT_MODEL } from "@/lib/llm";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LLMUserConfig {
  apiKey?: string;
  model?: string;
}

// ── Supabase helper ────────────────────────────────────────────────────────────

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

function loadConfig(raw: string | null, userId: string): LLMUserConfig {
  if (!raw) return {};
  try {
    const decrypted = decrypt(raw, userId);
    return JSON.parse(decrypted) as LLMUserConfig;
  } catch {
    return {};
  }
}

// ── GET /api/llm/config ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("llm_config")
    .eq("id", user.id)
    .single();

  const config = loadConfig(profile?.llm_config ?? null, user.id);

  return NextResponse.json({
    model: config.model || DEFAULT_MODEL,
    hasApiKey: !!config.apiKey,
  });
}

// ── PATCH /api/llm/config ──────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as Partial<LLMUserConfig>;

  // Load existing
  const { data: profile } = await supabase
    .from("profiles")
    .select("llm_config")
    .eq("id", user.id)
    .single();

  const existing = loadConfig(profile?.llm_config ?? null, user.id);

  // Merge — only update fields that are provided
  const merged: LLMUserConfig = {
    apiKey: body.apiKey !== undefined ? body.apiKey : existing.apiKey,
    model: body.model !== undefined ? body.model : existing.model,
  };

  // Remove empty apiKey so we fall back to server default
  if (merged.apiKey === "") delete merged.apiKey;

  const encrypted = encrypt(JSON.stringify(merged), user.id);

  const { error } = await supabase
    .from("profiles")
    .update({ llm_config: encrypted })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    model: merged.model || DEFAULT_MODEL,
    hasApiKey: !!merged.apiKey,
  });
}
