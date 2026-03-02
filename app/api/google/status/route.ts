import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
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
  if (!user) return NextResponse.json({ connected: false, email: null });

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_email, google_connected_at")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    connected: !!profile?.google_email,
    email: profile?.google_email ?? null,
    connectedAt: profile?.google_connected_at ?? null,
  });
}
