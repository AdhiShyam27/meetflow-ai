import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { decrypt, isEncrypted, encrypt } from "@/lib/encryption";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Exchange a refresh token for a fresh access token */
async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh Google token");
  }

  return res.json();
}

/** Get a valid access token for the current user, refreshing if needed */
export async function getValidGoogleToken(userId: string): Promise<string> {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("id", userId)
    .single();

  if (!profile?.google_refresh_token) {
    throw new Error("Google account not connected");
  }

  // Decrypt tokens (backward-compatible with plaintext legacy data)
  const accessToken = isEncrypted(profile.google_access_token)
    ? decrypt(profile.google_access_token, userId)
    : profile.google_access_token;
  const refreshToken = isEncrypted(profile.google_refresh_token)
    ? decrypt(profile.google_refresh_token, userId)
    : profile.google_refresh_token;

  const expiry = profile.google_token_expiry ? new Date(profile.google_token_expiry) : new Date(0);
  const isExpired = expiry <= new Date(Date.now() + 60_000); // refresh 1 min early

  if (!isExpired && accessToken) {
    return accessToken;
  }

  // Refresh the token
  const refreshed = await refreshGoogleToken(refreshToken);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);

  await supabase
    .from("profiles")
    .update({
      google_access_token: encrypt(refreshed.access_token, userId),
      google_token_expiry: newExpiry.toISOString(),
    })
    .eq("id", userId);

  return refreshed.access_token;
}

/** Make an authenticated GET request to a Google API endpoint */
export async function googleFetch(
  url: string,
  accessToken: string
): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
