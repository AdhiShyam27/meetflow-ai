"use client";

import { motion } from "framer-motion";
import { CheckCircle, Mic, Sparkles, Zap, ArrowRight } from "lucide-react";

const fadeLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
};
const fadeRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

// ─── Feature 1: Live Transcription Illustration ────────────────────────────
function TranscriptIllustration() {
  const lines = [
    { speaker: "Sarah Chen", color: "#4F46E5", widths: ["90%", "75%", "100%"] },
    { speaker: "Marcus Rivera", color: "#14B8A6", widths: ["85%", "95%"] },
    { speaker: "Priya Sharma", color: "#F59E0B", widths: ["70%", "88%", "60%"] },
  ];

  return (
    <div className="relative">
      {/* Glow */}
      <div
        className="absolute inset-0 rounded-3xl opacity-30 blur-2xl"
        style={{ background: "radial-gradient(ellipse at 50% 50%, #4F46E5, transparent)" }}
      />
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #1E293B, #0F172A)",
          border: "1px solid rgba(79,70,229,0.3)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
          <div className="ml-auto flex items-center gap-1.5">
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-red-500"
            />
            <span className="text-slate-400 text-xs">Recording</span>
          </div>
        </div>

        {/* Speaker identification chips */}
        <div className="px-4 pt-3 pb-2 flex gap-2 flex-wrap">
          {lines.map((l) => (
            <div
              key={l.speaker}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                background: `${l.color}18`,
                border: `1px solid ${l.color}40`,
                color: l.color,
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
              {l.speaker}
            </div>
          ))}
        </div>

        {/* Transcript content */}
        <div className="px-4 pb-4 space-y-4">
          {lines.map((block, bi) => (
            <div key={bi} className="flex gap-3">
              <div
                className="w-0.5 rounded-full flex-shrink-0 mt-1"
                style={{ background: `linear-gradient(to bottom, ${block.color}, ${block.color}20)`, minHeight: "50px" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold mb-2" style={{ color: block.color }}>
                  {block.speaker}
                </p>
                <div className="space-y-2">
                  {block.widths.map((w, wi) => (
                    <motion.div
                      key={wi}
                      initial={{ width: 0, opacity: 0 }}
                      whileInView={{ width: w, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: bi * 0.3 + wi * 0.15, duration: 0.7, ease: "easeOut" }}
                      className="h-2 rounded-full"
                      style={{
                        background: wi === 0 ? `${block.color}70` : "rgba(148,163,184,0.3)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Live typing */}
          <div className="flex items-center gap-3 pl-3 py-2 rounded-lg" style={{ background: "rgba(79,70,229,0.08)" }}>
            <Mic className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                />
              ))}
            </div>
            <span className="text-indigo-400/70 text-xs">Transcribing...</span>
          </div>
        </div>

        {/* Language badge */}
        <div className="absolute bottom-4 right-4 bg-teal-500/20 border border-teal-500/30 rounded-lg px-2 py-1">
          <span className="text-teal-400 text-xs font-medium">🌍 60+ Languages</span>
        </div>
      </div>
    </div>
  );
}

// ─── Feature 2: AI Summaries Illustration ────────────────────────────────────
function AISummaryIllustration() {
  const items = [
    "Review Q2 pipeline with Marcus by Friday",
    "Sarah to share updated deck with team",
    "Schedule follow-up demo with Nextera",
    "Priya to coordinate onboarding timeline",
  ];

  return (
    <div className="relative">
      <div
        className="absolute inset-0 rounded-3xl opacity-25 blur-2xl"
        style={{ background: "radial-gradient(ellipse, #14B8A6, transparent)" }}
      />
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #0D2137, #0F172A)",
          border: "1px solid rgba(20,184,166,0.3)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-4 border-b border-white/8 flex items-center gap-2"
          style={{ background: "rgba(20,184,166,0.08)" }}
        >
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span className="text-white text-sm font-semibold">AI Meeting Summary</span>
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="ml-auto flex items-center gap-1.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
            <span className="text-teal-400 text-xs">Generating</span>
          </motion.div>
        </div>

        {/* Summary section */}
        <div className="px-4 py-4 space-y-4">
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Meeting Overview
            </p>
            <div className="space-y-2">
              {["95%", "80%", "88%"].map((w, i) => (
                <motion.div
                  key={i}
                  initial={{ width: 0 }}
                  whileInView={{ width: w }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2, duration: 0.8 }}
                  className="h-2 rounded-full bg-slate-600/60"
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2.5">
              ✅ Action Items
            </p>
            <div className="space-y-2">
              {items.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.4 }}
                  className="flex items-start gap-2 text-xs text-slate-300"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
                  {item}
                </motion.div>
              ))}
            </div>
          </div>

          {/* AI custom prompt */}
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(79,70,229,0.12)", border: "1px solid rgba(79,70,229,0.2)" }}
          >
            <p className="text-indigo-400 text-xs font-medium mb-1.5">Ask AI anything →</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-indigo-500/20" />
              <div className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center">
                <ArrowRight className="w-3 h-3 text-indigo-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature 3: Workflow Illustration ────────────────────────────────────────
function WorkflowIllustration() {
  const steps = [
    { label: "Meeting", icon: "🎙️", color: "#4F46E5" },
    { label: "Transcript", icon: "📝", color: "#8B5CF6" },
    { label: "AI Analysis", icon: "✨", color: "#14B8A6" },
  ];

  const outputs = [
    { label: "Slack", color: "#4A154B", icon: "S" },
    { label: "Email", color: "#EA4335", icon: "E" },
    { label: "Jira", color: "#0052CC", icon: "J" },
    { label: "Notion", color: "#000", icon: "N" },
  ];

  return (
    <div className="relative">
      <div
        className="absolute inset-0 rounded-3xl opacity-20 blur-2xl"
        style={{ background: "radial-gradient(ellipse, #F59E0B, transparent)" }}
      />
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl px-6 py-6"
        style={{
          background: "linear-gradient(145deg, #1E293B, #0F172A)",
          border: "1px solid rgba(245,158,11,0.2)",
        }}
      >
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-white text-sm font-semibold">AI Workflow</span>
        </div>

        {/* Pipeline steps */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <motion.div
                whileInView={{ scale: [0.8, 1] }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 0.4 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-lg shadow-lg"
                  style={{
                    background: `${step.color}25`,
                    border: `1px solid ${step.color}50`,
                    boxShadow: `0 4px 12px ${step.color}25`,
                  }}
                >
                  {step.icon}
                </div>
                <p className="text-slate-400 text-xs font-medium">{step.label}</p>
              </motion.div>
              {i < steps.length - 1 && (
                <div className="flex items-center gap-0.5 mb-4">
                  {[0, 1, 2].map((j) => (
                    <motion.div
                      key={j}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: j * 0.15 }}
                      className="w-1.5 h-1.5 rounded-full bg-slate-500"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Arrow down */}
        <div className="flex justify-center mb-4">
          <div className="flex flex-col items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                className="w-0.5 h-2 bg-amber-500/60 rounded-full"
              />
            ))}
          </div>
        </div>

        {/* Output targets */}
        <div>
          <p className="text-slate-500 text-xs font-medium text-center mb-3 uppercase tracking-wider">
            Auto-sent to
          </p>
          <div className="grid grid-cols-4 gap-2">
            {outputs.map((out, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md"
                  style={{
                    background: out.color === "#000" ? "#1f1f1f" : out.color,
                    border: `1px solid ${out.color}30`,
                  }}
                >
                  {out.icon}
                </div>
                <p className="text-slate-400 text-xs">{out.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FeatureBlock {
  tag: string;
  tagColor: string;
  headline: string;
  description: string;
  bullets: string[];
  cta: string;
  illustration: React.ReactNode;
  reverse: boolean;
}

const features: FeatureBlock[] = [
  {
    tag: "Live Transcription",
    tagColor: "#4F46E5",
    headline: "Real-time transcription. Zero bots. Zero distractions.",
    description:
      "MeetFlow AI captures every word as it's spoken — privately, without any bot joining your call. Just open Chrome and start your meeting.",
    bullets: [
      "No bot ever joins your call",
      "Auto speaker identification",
      "60+ languages supported",
    ],
    cta: "Try Live Transcription",
    illustration: <TranscriptIllustration />,
    reverse: false,
  },
  {
    tag: "AI Summaries",
    tagColor: "#14B8A6",
    headline: "Summarize meetings as they happen.",
    description:
      "Our AI listens in real-time and generates structured summaries, action items, and insights — so you can focus on the conversation, not note-taking.",
    bullets: [
      "Ask AI custom questions about your meeting",
      "Auto-generate action items & owners",
      "Reference past summaries instantly",
    ],
    cta: "Explore AI Summaries",
    illustration: <AISummaryIllustration />,
    reverse: true,
  },
  {
    tag: "AI Workflows",
    tagColor: "#F59E0B",
    headline: "From transcript to action in one click.",
    description:
      "Connect MeetFlow AI to your existing tools and automate your entire post-meeting workflow. Decisions become tasks. Summaries become emails.",
    bullets: [
      "One-click summaries to Slack, Notion, Jira",
      "Auto-draft follow-up emails",
      "Build custom AI workflows",
    ],
    cta: "See Workflow Templates",
    illustration: <WorkflowIllustration />,
    reverse: false,
  },
];

export default function Features() {
  return (
    <section className="py-24 bg-off-white" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <p className="text-indigo-600 font-semibold text-sm uppercase tracking-widest mb-3">
            Features
          </p>
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 max-w-2xl mx-auto leading-tight"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Everything you need,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #4F46E5, #14B8A6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              nothing you don&apos;t.
            </span>
          </h2>
        </motion.div>

        {/* Feature blocks */}
        <div className="space-y-28">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
                feature.reverse ? "lg:grid-flow-col" : ""
              }`}
            >
              {/* Text */}
              <motion.div
                variants={feature.reverse ? fadeRight : fadeLeft}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                className={feature.reverse ? "lg:order-2" : ""}
              >
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-5"
                  style={{
                    background: `${feature.tagColor}15`,
                    color: feature.tagColor,
                    border: `1px solid ${feature.tagColor}30`,
                  }}
                >
                  {i === 0 && <Mic className="w-3.5 h-3.5" />}
                  {i === 1 && <Sparkles className="w-3.5 h-3.5" />}
                  {i === 2 && <Zap className="w-3.5 h-3.5" />}
                  {feature.tag}
                </div>

                <h3
                  className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-4"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {feature.headline}
                </h3>
                <p className="text-slate-500 text-base leading-relaxed mb-7">
                  {feature.description}
                </p>

                <ul className="space-y-3 mb-8">
                  {feature.bullets.map((bullet, bi) => (
                    <li key={bi} className="flex items-start gap-3">
                      <CheckCircle
                        className="w-5 h-5 flex-shrink-0 mt-0.5"
                        style={{ color: feature.tagColor }}
                      />
                      <span className="text-slate-600 text-sm">{bullet}</span>
                    </li>
                  ))}
                </ul>

                <motion.a
                  href="#"
                  whileHover={{ x: 4 }}
                  className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
                  style={{ color: feature.tagColor }}
                >
                  {feature.cta}
                  <ArrowRight className="w-4 h-4" />
                </motion.a>
              </motion.div>

              {/* Illustration */}
              <motion.div
                variants={feature.reverse ? fadeLeft : fadeRight}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                className={feature.reverse ? "lg:order-1" : ""}
              >
                {feature.illustration}
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
