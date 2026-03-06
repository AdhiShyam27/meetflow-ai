"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import {
  Zap, Settings, LogOut, ChevronLeft, ChevronRight, Plus,
  Sparkles, Search, FileText, Users, BarChart2, Archive,
  Workflow, MessageSquare, Gift, UserPlus, Mic, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  user?: { email?: string; user_metadata?: { full_name?: string } } | null;
}

const NAV_ITEMS = [
  { label: "Search", href: "/dashboard", icon: Search, shortcut: "⌘K" },
  { label: "My Meetings", href: "/dashboard", icon: FileText },
  { label: "New Recording", href: "/dashboard/new", icon: Mic },
  { label: "Upload File", href: "/dashboard/upload", icon: Upload },
  { label: "Shared with Me", href: "/dashboard", icon: Users },
  { label: "AI Tools", href: "/dashboard", icon: Sparkles },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Archive", href: "/dashboard", icon: Archive },
  { label: "Reporting", href: "/dashboard", icon: BarChart2 },
  { label: "My Workflows", href: "/dashboard", icon: Workflow },
  { label: "AI Chat", href: "/dashboard", icon: MessageSquare },
] as const;

const MAX_MEETINGS = 10;
const MAX_AI = 5;

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [meetingCount, setMeetingCount] = useState(0);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Shyam Sunder Adhi";

  const email = user?.email ?? "shyams.adhi@u.nus.edu";

  const avatar = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Fetch meeting count for plan usage bar
  useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.meetings && Array.isArray(data.meetings)) {
          setMeetingCount(data.meetings.length);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Signed out");
      router.push("/");
    } catch {
      toast.error("Sign out failed");
    }
  };

  const isActive = (href: string, label: string) => {
    if (label === "My Meetings" && pathname === "/dashboard") return true;
    if (label === "New Recording" && pathname === "/dashboard/new") return true;
    if (label === "Upload File" && pathname === "/dashboard/upload") return true;
    if (label === "Settings" && pathname.startsWith("/dashboard/settings")) return true;
    return false;
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="relative flex flex-col border-r border-slate-200 bg-white flex-shrink-0 overflow-hidden"
      style={{ minHeight: "100vh" }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-3.5 border-b border-slate-100 flex-shrink-0 gap-2">
        <a href="/dashboard" className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-sm overflow-hidden whitespace-nowrap"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                <span className="text-indigo-600">Meet</span>
                <span className="text-slate-800">Flow</span>
                <span className="text-teal-500">AI</span>
              </motion.span>
            )}
          </AnimatePresence>
        </a>
      </div>

      {/* Workspace selector */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 pt-3 pb-2 border-b border-slate-100 flex-shrink-0"
          >
            <button
              onClick={() => toast.success("Workspace settings coming soon!")}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-600 text-xs font-bold">M</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">My Workspace</p>
                <p className="text-xs text-slate-400">1 member</p>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
            </button>

            <button
              onClick={() => toast.success("Invite teammates — coming in Pro!")}
              className="mt-1.5 w-full flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite teammates
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Meeting button */}
      <div className={`p-2.5 flex-shrink-0 ${collapsed ? "" : "border-b border-slate-100"}`}>
        <motion.a
          href="/dashboard/new"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl py-2 transition-colors shadow-md shadow-amber-100 ${collapsed ? "justify-center px-2" : "px-3"}`}
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm overflow-hidden whitespace-nowrap"
              >
                New Meeting
              </motion.span>
            )}
          </AnimatePresence>
        </motion.a>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.label);
          return (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all group ${
                active
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              } ${collapsed ? "justify-center px-2" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {"shortcut" in item && !collapsed && (
                <span className="text-slate-300 text-xs font-normal flex-shrink-0">{item.shortcut}</span>
              )}
            </a>
          );
        })}

        {/* Get free meetings */}
        <AnimatePresence>
          {!collapsed && (
            <motion.a
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              href="mailto:support@meetflow.ai?subject=Upgrade"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-500 hover:bg-amber-50 hover:text-amber-700 transition-all group"
            >
              <Gift className="w-4 h-4 text-amber-400 group-hover:text-amber-500 flex-shrink-0" />
              <span>Get free meetings</span>
            </motion.a>
          )}
        </AnimatePresence>
      </nav>

      {/* Plan usage */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-2.5 mb-2.5 rounded-xl p-3 flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #EEF2FF, #F0FDFA)", border: "1px solid #E0E7FF" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-indigo-700">Free Plan</p>
              <a
                href="mailto:support@meetflow.ai?subject=Upgrade%20to%20Pro"
                className="text-xs font-bold text-amber-500 hover:text-amber-600 flex items-center gap-0.5"
              >
                <Zap className="w-3 h-3" /> Upgrade
              </a>
            </div>

            {/* Meetings usage */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{Math.min(meetingCount, MAX_MEETINGS)} of {MAX_MEETINGS} meetings</span>
              </div>
              <div className="h-1.5 bg-white rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((meetingCount / MAX_MEETINGS) * 100, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-slate-400"
                />
              </div>
            </div>

            {/* AI credits usage */}
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>0 of {MAX_AI} AI credits</span>
              </div>
              <div className="h-1.5 bg-white rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: "0%" }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User profile + logout */}
      <div className="px-2.5 pb-3 pt-2 border-t border-slate-100 flex-shrink-0">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <a href="/dashboard/settings" title="Settings" className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-sm hover:opacity-80 transition-opacity cursor-pointer">
              {avatar}
            </div>
          </a>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-slate-800 text-xs font-semibold truncate">{displayName}</p>
                <p className="text-slate-400 text-xs truncate">{email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </motion.aside>
  );
}
