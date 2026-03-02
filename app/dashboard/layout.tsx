import { redirect } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";

const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://your-project.supabase.co";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;

  if (!isDemoMode) {
    // Dynamic import to avoid build errors when Supabase is not configured
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      redirect("/login");
    }
    user = authUser;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
