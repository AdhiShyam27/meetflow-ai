"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import {
  Zap, LayoutDashboard, Mic, Settings, LogOut, ChevronLeft,
  ChevronRight, Plus, Sparkles, HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface SidebarProps {
  user?: { email?: string; user_metadata?: { full_name?: string } } | null;
}

const navItems: Array<{ label: string; href: string; icon: React.ElementType; external?: boolean }> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Meetings", href: "/dashboard", icon: Mic },
  { label: "AI Summaries", href: "/dashboard", icon: Sparkles },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Help", href: "mailto:support@meetflow.ai", icon: HelpCircle, external: true },
];

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  const avatar = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="relative flex flex-col border-r border-slate-200 bg-white flex-shrink-0 overflow-hidden"
      style={{ minHeight: "100vh" }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-100 flex-shrink-0">
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

      {/* New Meeting button */}
      <div className="p-3 border-b border-slate-100 flex-shrink-0">
        <motion.a
          href="/dashboard/new"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl py-2.5 transition-colors shadow-md shadow-amber-100 ${collapsed ? "justify-center px-2" : "px-3"}`}
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
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href && !item.external;
          return (
            <a
              key={item.label}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group ${
                active
                  ? "bg-indigo-50 text-indigo-700"
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
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </a>
          );
        })}
      </nav>

      {/* Plan badge */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-3 mb-3 rounded-xl p-3"
            style={{ background: "linear-gradient(135deg, #EEF2FF, #F0FDFA)", border: "1px solid #E0E7FF" }}
          >
            <p className="text-xs font-semibold text-indigo-700 mb-0.5">Free Plan</p>
            <p className="text-xs text-slate-500 mt-0.5">Unlimited meetings</p>
            <a
              href="mailto:support@meetflow.ai?subject=Upgrade%20to%20Pro"
              className="mt-2 block text-xs font-semibold text-indigo-600 hover:underline"
            >
              Upgrade to Pro →
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User info + logout */}
      <div className="p-3 border-t border-slate-100 flex-shrink-0">
        <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
          <a href="/dashboard/settings" title="Settings">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm hover:opacity-80 transition-opacity cursor-pointer">
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
                <p className="text-slate-400 text-xs truncate">{user?.email ?? ""}</p>
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
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </motion.aside>
  );
}
