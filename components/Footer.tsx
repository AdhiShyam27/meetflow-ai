"use client";

import { motion } from "framer-motion";
import { Zap, Twitter, Linkedin, Github, Youtube } from "lucide-react";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Live Transcription", href: "#" },
      { label: "AI Summaries", href: "#" },
      { label: "AI Workflows", href: "#" },
      { label: "Chrome Extension", href: "#" },
      { label: "Custom AI Prompts", href: "#" },
      { label: "Integrations", href: "#" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Customer Meetings", href: "#" },
      { label: "Team Meetings", href: "#" },
      { label: "Enterprise", href: "#" },
      { label: "Free Tools", href: "#" },
      { label: "For Google Meet", href: "#" },
      { label: "For Zoom", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "#" },
      { label: "Help Center", href: "#" },
      { label: "Trust Center", href: "#" },
      { label: "Download", href: "#" },
      { label: "API Docs", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Partners", href: "#" },
      { label: "Affiliates", href: "#" },
    ],
  },
];

const socials = [
  { icon: <Twitter className="w-4 h-4" />, href: "#", label: "Twitter" },
  { icon: <Linkedin className="w-4 h-4" />, href: "#", label: "LinkedIn" },
  { icon: <Github className="w-4 h-4" />, href: "#", label: "GitHub" },
  { icon: <Youtube className="w-4 h-4" />, href: "#", label: "YouTube" },
];

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800/50">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Logo + description */}
          <div className="col-span-2 md:col-span-1">
            <motion.a
              href="/"
              whileHover={{ scale: 1.02 }}
              className="inline-flex items-center gap-2 mb-4 group"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center shadow-md">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg" style={{ fontFamily: "'Inter', sans-serif" }}>
                <span className="text-indigo-400">Meet</span>
                <span className="text-slate-200">Flow</span>
                <span className="text-teal-400 text-sm font-semibold ml-0.5">AI</span>
              </span>
            </motion.a>
            <p className="text-slate-500 text-xs leading-relaxed mb-5">
              Your meetings, distilled into action. AI-powered transcription and summaries for modern teams.
            </p>
            {/* Social links */}
            <div className="flex gap-2">
              {socials.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  whileHover={{ scale: 1.1, y: -2 }}
                  aria-label={social.label}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                >
                  {social.icon}
                </motion.a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerLinks.map((column) => (
            <div key={column.title}>
              <h4
                className="text-slate-200 font-semibold text-sm mb-4"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {column.title}
              </h4>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-xs">
            © {new Date().getFullYear()} MeetFlow AI, Inc. All rights reserved.
          </p>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            {["Privacy Policy", "Terms of Service", "Cookie Policy", "Accessibility"].map(
              (item) => (
                <a
                  key={item}
                  href="#"
                  className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
                >
                  {item}
                </a>
              )
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-slate-500 text-xs">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
