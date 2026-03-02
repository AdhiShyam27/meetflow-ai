import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST() {
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

  // Get the token to revoke it
  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token")
    .eq("id", user.id)
    .single();

  // Revoke the token with Google (best-effort)
  if (profile?.google_access_token) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${profile.google_access_token}`, {
      method: "POST",
    }).catch(() => {}); // ignore errors
  }

  // Clear stored tokens
  await supabase.from("profiles").update({
    google_access_token: null,
    google_refresh_token: null,
    google_token_expiry: null,
    google_email: null,
    google_connected_at: null,
  }).eq("id", user.id);

  return NextResponse.json({ success: true });
}
