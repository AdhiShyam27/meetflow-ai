"use client";

import { motion } from "framer-motion";
import { Chrome, Play, Zap, Sparkles, Mic, CheckCircle } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
  }),
};

function MeetingIllustration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Background glow blobs */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl">
        <div
          className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #4F46E5, transparent)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-56 h-56 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #14B8A6, transparent)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full opacity-10 blur-2xl"
          style={{ background: "radial-gradient(circle, #F59E0B, transparent)" }}
        />
      </div>

      {/* Main transcript card */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Window card */}
        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #1E293B 0%, #0F172A 100%)",
            border: "1px solid rgba(79,70,229,0.3)",
            boxShadow: "0 25px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(79,70,229,0.2)",
          }}
        >
          {/* Title bar */}
          <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-slate-400 text-xs font-medium">Live Transcript</span>
              </div>
            </div>
            <div className="w-4 h-4 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <Zap className="w-2 h-2 text-teal-400" />
            </div>
          </div>

          {/* Participants row */}
          <div className="px-4 py-3 flex items-center gap-2 border-b border-white/5">
            {[
              { color: "#4F46E5", initials: "SC" },
              { color: "#14B8A6", initials: "MR" },
              { color: "#F59E0B", initials: "PS" },
            ].map((p, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: p.color, boxShadow: `0 0 8px ${p.color}60` }}
              >
                {p.initials}
              </div>
            ))}
            <span className="text-slate-500 text-xs ml-1">Q2 Strategy Call — 3 participants</span>
          </div>

          {/* Transcript lines */}
          <div className="px-4 py-3 space-y-3">
            {[
              { speaker: "Sarah C.", color: "#4F46E5", lines: ["85%", "100%", "60%"] },
              { speaker: "Marcus R.", color: "#14B8A6", lines: ["100%", "70%"] },
            ].map((block, bi) => (
              <div key={bi} className="flex gap-2.5">
                <div
                  className="w-1 rounded-full flex-shrink-0 mt-1"
                  style={{ background: block.color, minHeight: "40px" }}
                />
                <div className="flex-1">
                  <p className="text-xs font-semibold mb-1.5" style={{ color: block.color }}>
                    {block.speaker}
                  </p>
                  <div className="space-y-1.5">
                    {block.lines.map((w, li) => (
                      <motion.div
                        key={li}
                        initial={{ width: 0 }}
                        animate={{ width: w }}
                        transition={{ delay: bi * 0.4 + li * 0.15 + 0.5, duration: 0.8, ease: "easeOut" }}
                        className="h-2 rounded-full bg-slate-600/60"
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Currently typing indicator */}
            <div className="flex gap-2.5">
              <div className="w-1 rounded-full flex-shrink-0 mt-1 bg-amber-500/60" style={{ minHeight: "28px" }} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-500 mb-1.5">Priya S.</p>
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      className="w-1.5 h-1.5 rounded-full bg-slate-400"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Summary card */}
          <div className="mx-3 mb-3 rounded-xl p-3" style={{ background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-teal-400 text-xs font-semibold">AI Summary</span>
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="ml-auto flex items-center gap-1"
              >
                <div className="w-1 h-1 rounded-full bg-teal-400" />
                <span className="text-teal-400/70 text-xs">Generating...</span>
              </motion.div>
            </div>
            <div className="space-y-1.5">
              {["70%", "55%", "80%"].map((w, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full"
                  style={{ width: w, background: "rgba(20,184,166,0.35)" }}
                />
              ))}
            </div>
          </div>

          {/* Waveform */}
          <div className="px-4 pb-4 flex items-end justify-center gap-0.5 h-10">
            {[3, 6, 10, 14, 9, 13, 7, 11, 15, 8, 12, 5, 9, 13, 6, 10, 4, 7, 11, 5].map((h, i) => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1 + (i % 3) * 0.2,
                  repeat: Infinity,
                  delay: i * 0.05,
                  ease: "easeInOut",
                }}
                style={{
                  height: `${h}px`,
                  transformOrigin: "bottom",
                  background: i % 3 === 0 ? "#4F46E5" : i % 3 === 1 ? "#14B8A6" : "#F59E0B",
                  opacity: 0.7,
                }}
                className="w-1 rounded-full flex-shrink-0"
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Floating badges */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute -top-2 -right-4 bg-white rounded-xl shadow-xl px-3 py-2 flex items-center gap-2 border border-slate-100"
      >
        <CheckCircle className="w-4 h-4 text-teal-500" />
        <span className="text-slate-700 text-xs font-semibold">No bot joins your call</span>
      </motion.div>

      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-2 -left-4 bg-white rounded-xl shadow-xl px-3 py-2 flex items-center gap-2 border border-slate-100"
      >
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-slate-700 text-xs font-semibold">AI summary ready</span>
      </motion.div>

      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        className="absolute top-1/3 -right-8 bg-indigo-600 rounded-xl shadow-xl px-3 py-2 flex items-center gap-2"
      >
        <Mic className="w-3.5 h-3.5 text-white" />
        <span className="text-white text-xs font-semibold">60+ languages</span>
      </motion.div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #0F172A 0%, #1e1b4b 40%, #0c2340 70%, #0F172A 100%)",
        }}
      />

      {/* Animated gradient orbs */}
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #4F46E5, transparent)" }}
      />
      <motion.div
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #14B8A6, transparent)" }}
      />
      <motion.div
        animate={{ x: [0, 20, 0], y: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #F59E0B, transparent)" }}
      />

      {/* Geometric grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(79,70,229,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Copy */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-200 text-sm font-medium">
                Introducing AI Workflows →
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Focus on the meeting,{" "}
              <span
                className="block mt-1"
                style={{
                  background: "linear-gradient(135deg, #6366F1 0%, #14B8A6 60%, #F59E0B 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                let AI handle the rest.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="text-lg text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
            >
              Get live, bot-free transcriptions and AI-powered summaries. Capture every
              insight, action item, and decision — automatically.
            </motion.p>

            {/* CTAs */}
            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10"
            >
              <motion.a
                href="/signup"
                whileHover={{ scale: 1.04, boxShadow: "0 12px 28px rgba(245,158,11,0.35)" }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold text-base px-7 py-3.5 rounded-full shadow-lg shadow-amber-500/30 transition-colors"
              >
                <Chrome className="w-5 h-5" />
                Add to Chrome — It&apos;s Free
              </motion.a>
              <motion.a
                href="/signup"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/25 text-white font-semibold text-base px-7 py-3.5 rounded-full transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
                </div>
                Watch Demo
              </motion.a>
            </motion.div>

            {/* Platform badges */}
            <motion.div
              custom={4}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row items-center lg:items-start gap-3"
            >
              <span className="text-slate-400 text-sm">Works with</span>
              <div className="flex items-center gap-3">
                {[
                  { name: "Google Meet", color: "#4285F4", letter: "G" },
                  { name: "Zoom", color: "#2D8CFF", letter: "Z" },
                  { name: "MS Teams", color: "#5059C9", letter: "T" },
                ].map((platform) => (
                  <div
                    key={platform.name}
                    className="flex items-center gap-1.5 bg-white/8 border border-white/15 rounded-full px-3 py-1.5"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: platform.color }}
                    >
                      {platform.letter}
                    </div>
                    <span className="text-slate-300 text-xs font-medium">{platform.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right: Illustration */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[500px] lg:h-[560px]"
          >
            <MeetingIllustration />
          </motion.div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path
            d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z"
            fill="#F8FAFC"
          />
        </svg>
      </div>
    </section>
  );
}
