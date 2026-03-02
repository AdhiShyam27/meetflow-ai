import { NextResponse } from "next/server";

// DELETE /api/account — delete the authenticated user's data
// Note: Supabase doesn't allow self-deletion via client SDK.
// We delete their meetings data here; full auth user deletion requires
// a service-role key or Supabase Edge Function (see supabase/functions/).
export async function DELETE() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all user's meetings (RLS ensures only their data)
    await supabase.from("meetings").delete().eq("user_id", user.id);

    // Sign out the session
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/account]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
