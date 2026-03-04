"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Menu,
  X,
  Zap,
  Sun,
  Moon,
  Mic,
  Video,
  FileText,
  Sparkles,
  Workflow,
  Users,
  Building2,
  Gift,
  BookOpen,
  HelpCircle,
  Shield,
  Download,
  Chrome,
  MessageSquare,
  Brain,
  ClipboardList,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  description?: string;
}

interface MegaMenuColumn {
  title: string;
  items: NavItem[];
}

interface NavDropdown {
  label: string;
  columns: MegaMenuColumn[];
}

const productMenu: NavDropdown = {
  label: "Product",
  columns: [
    {
      title: "During Your Meeting",
      items: [
        {
          label: "Live Transcription",
          href: "#",
          icon: <Mic className="w-4 h-4" />,
          description: "Your words appear on screen the moment you speak — no bots, no delays. Works directly in your browser without joining your call.",
        },
        {
          label: "Works on Any Platform",
          href: "#",
          icon: <Video className="w-4 h-4" />,
          description: "Google Meet, Zoom, MS Teams, or any call — MeetFlow captures audio from your microphone so it works everywhere.",
        },
        {
          label: "In-Meeting AI Assistant",
          href: "#",
          icon: <Brain className="w-4 h-4" />,
          description: "Ask your AI assistant questions mid-call. 'What did they say about pricing?' — get instant answers without pausing the meeting.",
        },
      ],
    },
    {
      title: "After Your Meeting",
      items: [
        {
          label: "AI Summary",
          href: "#",
          icon: <Sparkles className="w-4 h-4" />,
          description: "The moment your meeting ends, Claude AI reads the full transcript and writes a structured recap — key points, decisions made, and action items with owners.",
        },
        {
          label: "Ask Anything",
          href: "#",
          icon: <MessageSquare className="w-4 h-4" />,
          description: "Type any question about your meeting and get a precise answer. 'What were the blockers mentioned?' or 'Who is following up on the budget?'",
        },
        {
          label: "Smart Notes & Export",
          href: "#",
          icon: <ClipboardList className="w-4 h-4" />,
          description: "Auto-organized notes grouped by topic. Share via link, copy to Notion, or email the summary directly to every attendee.",
        },
      ],
    },
  ],
};

const solutionsMenu: NavDropdown = {
  label: "Solutions",
  columns: [
    {
      title: "Use Cases",
      items: [
        { label: "Customer Meetings", href: "#", icon: <Users className="w-4 h-4" />, description: "Win more deals with perfect notes" },
        { label: "Team Meetings", href: "#", icon: <Users className="w-4 h-4" />, description: "Keep everyone aligned" },
        { label: "Enterprise", href: "#", icon: <Building2 className="w-4 h-4" />, description: "Scale AI across your org" },
        { label: "Free Tools", href: "#", icon: <Gift className="w-4 h-4" />, description: "Explore free transcription tools" },
      ],
    },
  ],
};

const resourcesMenu: NavDropdown = {
  label: "Resources",
  columns: [
    {
      title: "Learn",
      items: [
        { label: "Blog", href: "#", icon: <BookOpen className="w-4 h-4" />, description: "Insights on AI & productivity" },
        { label: "Help Center", href: "#", icon: <HelpCircle className="w-4 h-4" />, description: "Guides and tutorials" },
        { label: "Trust Center", href: "#", icon: <Shield className="w-4 h-4" />, description: "Security & compliance" },
        { label: "Download", href: "#", icon: <Download className="w-4 h-4" />, description: "Get the Chrome extension" },
      ],
    },
  ],
};

const menus = [productMenu, solutionsMenu, resourcesMenu];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const handleMenuEnter = (label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(label);
  };

  const handleMenuLeave = () => {
    timeoutRef.current = setTimeout(() => setActiveMenu(null), 200);
  };

  const activeMenuData = menus.find((m) => m.label === activeMenu);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-xl shadow-sm shadow-indigo-100/50 border-b border-slate-200/60"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center shadow-md group-hover:shadow-indigo-300 transition-shadow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: "'Inter', sans-serif" }}>
            <span className="text-indigo-600">Meet</span>
            <span className="text-slate-800">Flow</span>
            <span className="text-teal-500 text-sm font-semibold ml-0.5">AI</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <div
          className="hidden md:flex items-center gap-1"
          ref={menuRef}
          onMouseLeave={handleMenuLeave}
        >
          {menus.map((menu) => (
            <div
              key={menu.label}
              className="relative"
              onMouseEnter={() => handleMenuEnter(menu.label)}
            >
              <button
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeMenu === menu.label
                    ? "text-indigo-600 bg-indigo-50"
                    : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50"
                }`}
              >
                {menu.label}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${activeMenu === menu.label ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          ))}
          <a
            href="#pricing"
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors"
          >
            Pricing
          </a>
        </div>

        {/* Mega Menu Dropdown */}
        <AnimatePresence>
          {activeMenuData && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onMouseEnter={() => handleMenuEnter(activeMenuData.label)}
              onMouseLeave={handleMenuLeave}
              className="absolute top-14 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-indigo-200/30 border border-slate-200/80 p-6 min-w-[680px]"
              style={{ marginLeft: activeMenuData.columns.length === 1 ? "-80px" : "0" }}
            >
              <div
                className={`grid gap-8 ${
                  activeMenuData.columns.length === 2 ? "grid-cols-2" : "grid-cols-1"
                }`}
              >
                {activeMenuData.columns.map((col) => (
                  <div key={col.title}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                      {col.title}
                    </p>
                    <div className="space-y-1">
                      {col.items.map((item) => (
                        <a
                          key={item.label}
                          href={item.href}
                          className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-indigo-50 group transition-colors"
                        >
                          <span className="mt-0.5 text-indigo-500 group-hover:text-indigo-600 transition-colors flex-shrink-0">
                            {item.icon}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* How it works strip — only shown on Product menu */}
              {activeMenuData.label === "Product" && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">How it works</p>
                  <div className="flex items-center gap-2">
                    {[
                      { step: "1", text: "Join your meeting", icon: <Mic className="w-3.5 h-3.5" /> },
                      { step: "2", text: "MeetFlow transcribes live", icon: <FileText className="w-3.5 h-3.5" /> },
                      { step: "3", text: "AI writes your summary", icon: <Sparkles className="w-3.5 h-3.5" /> },
                      { step: "4", text: "Share or email it", icon: <MessageSquare className="w-3.5 h-3.5" /> },
                    ].map((s, i, arr) => (
                      <div key={s.step} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-indigo-500">{s.icon}</span>
                          <span className="text-xs font-medium text-slate-600">{s.text}</span>
                        </div>
                        {i < arr.length - 1 && (
                          <span className="text-slate-300 text-xs">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right side actions */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <a
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors px-2"
          >
            Log In
          </a>
          <motion.a
            href="/signup"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-5 py-2 rounded-full shadow-md shadow-amber-200 transition-colors"
          >
            Get Started Free
          </motion.a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-white/98 backdrop-blur-xl border-t border-slate-200 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {menus.map((menu) => (
                <div key={menu.label}>
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-indigo-50 transition-colors"
                    onClick={() =>
                      setMobileExpanded(mobileExpanded === menu.label ? null : menu.label)
                    }
                  >
                    {menu.label}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${mobileExpanded === menu.label ? "rotate-180" : ""}`}
                    />
                  </button>
                  <AnimatePresence>
                    {mobileExpanded === menu.label && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-4 overflow-hidden"
                      >
                        {menu.columns.flatMap((col) => col.items).map((item) => (
                          <a
                            key={item.label}
                            href={item.href}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <span className="text-indigo-400">{item.icon}</span>
                            {item.label}
                          </a>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              <a
                href="#pricing"
                className="block px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-indigo-50 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </a>
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <a
                  href="/login"
                  className="px-4 py-3 text-sm font-medium text-center text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  Log In
                </a>
                <a
                  href="/signup"
                  className="bg-amber-500 text-white text-sm font-semibold px-5 py-3 rounded-full text-center shadow-md shadow-amber-200"
                >
                  Get Started Free
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
