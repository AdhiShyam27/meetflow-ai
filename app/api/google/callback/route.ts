import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { encrypt } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard/settings?google=error`);
  }

  // Get current user
  const cookieStore = await cookies();

  // ── CSRF state validation ─────────────────────────────────────────────────
  const expectedState = cookieStore.get("google_oauth_state")?.value;
  if (!state || !expectedState || state !== expectedState) {
    console.error("[Google OAuth] CSRF state mismatch — possible CSRF attack");
    return NextResponse.redirect(`${origin}/dashboard/settings?google=error`);
  }
  // Invalidate the one-time state cookie immediately
  cookieStore.delete("google_oauth_state");
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
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/google/callback`,
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${origin}/dashboard/settings?google=error`);
  }

  const tokens = await tokenRes.json();

  // Google only provides refresh_token on first auth or when prompt=consent is used.
  // If it's missing, the connection won't work long-term — redirect with error.
  if (!tokens.refresh_token) {
    return NextResponse.redirect(`${origin}/dashboard/settings?google=error`);
  }

  // Fetch the user's Gmail address
  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userInfoRes.ok) {
    return NextResponse.redirect(`${origin}/dashboard/settings?google=error`);
  }
  const userInfo = await userInfoRes.json();

  const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

  // Save tokens to profiles table (encrypted at rest)
  await supabase.from("profiles").update({
    google_access_token: encrypt(tokens.access_token, user.id),
    google_refresh_token: encrypt(tokens.refresh_token, user.id),
    google_token_expiry: expiry.toISOString(),
    google_email: userInfo.email,
    google_connected_at: new Date().toISOString(),
  }).eq("id", user.id);

  return NextResponse.redirect(`${origin}/dashboard/settings?google=connected`);
}
