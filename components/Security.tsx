"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Eye, Server, CheckCircle } from "lucide-react";

const badges = [
  { label: "SOC 2 Type II", icon: <Shield className="w-5 h-5" />, color: "#4F46E5" },
  { label: "GDPR Compliant", icon: <Lock className="w-5 h-5" />, color: "#14B8A6" },
  { label: "HIPAA Ready", icon: <Eye className="w-5 h-5" />, color: "#F59E0B" },
  { label: "ISO 27001", icon: <Server className="w-5 h-5" />, color: "#8B5CF6" },
];

const trustPoints = [
  "We never record your meeting audio — only text",
  "All transcripts encrypted end-to-end (AES-256)",
  "Your data is never used to train any AI model",
  "Zero retention after account deletion",
  "Private deployment options available for Enterprise",
];

export default function Security() {
  return (
    <section
      className="py-24 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1e1b4b 50%, #0c2340 100%)" }}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute -top-32 -right-32 w-96 h-96 opacity-5"
        >
          <svg viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="150" stroke="#4F46E5" strokeWidth="1" />
            <circle cx="200" cy="200" r="100" stroke="#14B8A6" strokeWidth="1" />
            <circle cx="200" cy="200" r="50" stroke="#F59E0B" strokeWidth="1" />
          </svg>
        </motion.div>
        <div
          className="absolute inset-0 opacity-3"
          style={{
            backgroundImage:
              "linear-gradient(rgba(79,70,229,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.15) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-6">
              <Shield className="w-4 h-4 text-indigo-300" />
              <span className="text-indigo-200 text-sm font-medium">Security & Privacy</span>
            </div>

            <h2
              className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-tight"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Your data is{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #6366F1, #14B8A6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                safe with us.
              </span>
            </h2>

            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              We built MeetFlow AI with privacy-first principles. Your meetings stay yours —
              always private, always secure.
            </p>

            <ul className="space-y-3 mb-8">
              {trustPoints.map((point, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300 text-sm">{point}</span>
                </motion.li>
              ))}
            </ul>

            <motion.a
              href="#"
              whileHover={{ x: 4 }}
              className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 font-semibold text-sm transition-colors"
            >
              Read our full Trust Center →
            </motion.a>
          </motion.div>

          {/* Right: Badges */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="grid grid-cols-2 gap-4"
          >
            {badges.map((badge, i) => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                whileHover={{ scale: 1.03 }}
                className="relative rounded-2xl p-6 text-center cursor-default"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${badge.color}30`,
                  backdropFilter: "blur(12px)",
                }}
              >
                {/* Glow */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity"
                  style={{
                    background: `radial-gradient(ellipse at 50% 50%, ${badge.color}15, transparent)`,
                  }}
                />

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 relative"
                  style={{
                    background: `${badge.color}20`,
                    border: `1px solid ${badge.color}40`,
                    color: badge.color,
                    boxShadow: `0 4px 16px ${badge.color}20`,
                  }}
                >
                  {badge.icon}
                </div>

                <p className="text-white font-semibold text-sm mb-1">{badge.label}</p>
                <div className="flex items-center justify-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                  <span className="text-slate-400 text-xs">Certified</span>
                </div>
              </motion.div>
            ))}

            {/* Extra trust indicators */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="col-span-2 rounded-2xl p-4 flex items-center gap-4"
              style={{
                background: "rgba(20,184,166,0.08)",
                border: "1px solid rgba(20,184,166,0.2)",
              }}
            >
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">End-to-end encrypted</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  AES-256 encryption at rest and in transit. Zero-knowledge architecture.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
