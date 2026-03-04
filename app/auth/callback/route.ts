import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Handles:
//  • Email confirmation links (signup)
//  • OAuth provider redirects (Google)
//  • Password reset links
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Validate `next` is a relative path to prevent open-redirect attacks
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // If Supabase returned an error (e.g. expired link)
  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", errorDescription ?? error);
    return NextResponse.redirect(url);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(url);
  }

  // Redirect to the intended page (dashboard by default, or reset-password)
  return NextResponse.redirect(new URL(next, origin));
}
