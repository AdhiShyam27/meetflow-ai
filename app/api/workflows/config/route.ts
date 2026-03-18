import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { encrypt, decrypt } from "@/lib/encryption";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WorkflowConfig {
  slack: { enabled: boolean; webhookUrl: string };
  email: { enabled: boolean; recipients: string };
  notion: { enabled: boolean; apiKey: string; databaseId: string };
  linear: { enabled: boolean; apiKey: string; teamId: string };
  webhook: { enabled: boolean; url: string };
}

const DEFAULT_CONFIG: WorkflowConfig = {
  slack: { enabled: false, webhookUrl: "" },
  email: { enabled: false, recipients: "" },
  notion: { enabled: false, apiKey: "", databaseId: "" },
  linear: { enabled: false, apiKey: "", teamId: "" },
  webhook: { enabled: false, url: "" },
};

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

async function loadConfig(raw: string | null, userId: string): Promise<WorkflowConfig> {
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    const decrypted = decrypt(raw, userId);
    const parsed = JSON.parse(decrypted) as Partial<WorkflowConfig>;
    // Merge with defaults so new fields always present
    return {
      slack: { ...DEFAULT_CONFIG.slack, ...parsed.slack },
      email: { ...DEFAULT_CONFIG.email, ...parsed.email },
      notion: { ...DEFAULT_CONFIG.notion, ...parsed.notion },
      linear: { ...DEFAULT_CONFIG.linear, ...parsed.linear },
      webhook: { ...DEFAULT_CONFIG.webhook, ...parsed.webhook },
    };
  } catch {
    // If decrypt/parse fails (legacy or corrupt), return defaults
    return { ...DEFAULT_CONFIG };
  }
}

// ── GET /api/workflows/config ──────────────────────────────────────────────────

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("workflow_config")
    .eq("id", user.id)
    .single();

  const config = await loadConfig(profile?.workflow_config ?? null, user.id);
  return NextResponse.json(config);
}

// ── PATCH /api/workflows/config ────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as Partial<WorkflowConfig>;

  // Load existing config
  const { data: profile } = await supabase
    .from("profiles")
    .select("workflow_config")
    .eq("id", user.id)
    .single();

  const existing = await loadConfig(profile?.workflow_config ?? null, user.id);

  // Deep merge (one level)
  const merged: WorkflowConfig = {
    slack: { ...existing.slack, ...(body.slack ?? {}) },
    email: { ...existing.email, ...(body.email ?? {}) },
    notion: { ...existing.notion, ...(body.notion ?? {}) },
    linear: { ...existing.linear, ...(body.linear ?? {}) },
    webhook: { ...existing.webhook, ...(body.webhook ?? {}) },
  };

  const encrypted = encrypt(JSON.stringify(merged), user.id);

  const { error } = await supabase
    .from("profiles")
    .update({ workflow_config: encrypted })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(merged);
}
