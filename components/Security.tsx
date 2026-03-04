"use client";

import { motion } from "framer-motion";
import { Shield, Lock, CheckCircle } from "lucide-react";

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

          </motion.div>

          {/* Right: Simple security assurance */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl p-10 text-center w-full"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(99,102,241,0.25)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-indigo-300" />
              </div>
              <h3 className="text-white text-2xl font-bold mb-3">Your data is secured</h3>
              <p className="text-slate-400 text-base leading-relaxed">
                Everything you record and transcribe stays private. We encrypt your data and never share it with anyone — ever.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
