"use client";

import { motion } from "framer-motion";
import { Chrome, Calendar, Sparkles, ArrowRight } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #1e1b4b 0%, #0F172A 30%, #134e4a 70%, #1e1b4b 100%)",
          backgroundSize: "400% 400%",
        }}
      />

      {/* Animated orbs */}
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #4F46E5, transparent)" }}
      />
      <motion.div
        animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #14B8A6, transparent)" }}
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #F59E0B, transparent)" }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-200 text-sm font-medium">Join 500,000+ professionals</span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Ready to transform{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #6366F1, #14B8A6, #F59E0B)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            your meetings?
          </span>
        </motion.h2>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-slate-300 text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Join 500,000+ professionals who never miss a detail. Get started free in 30 seconds.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <motion.a
            href="/signup"
            whileHover={{ scale: 1.05, boxShadow: "0 16px 36px rgba(245,158,11,0.4)" }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold text-base px-8 py-4 rounded-full shadow-xl shadow-amber-500/30 transition-colors"
          >
            <Chrome className="w-5 h-5" />
            Add to Chrome — Free
          </motion.a>

          <motion.a
            href="/signup"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/25 text-white font-semibold text-base px-8 py-4 rounded-full transition-colors"
          >
            <Calendar className="w-5 h-5" />
            Book a Demo
            <ArrowRight className="w-4 h-4" />
          </motion.a>
        </motion.div>

        {/* Trust note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-slate-400 text-sm mt-8"
        >
          No credit card required · No bot joins your call · Cancel anytime
        </motion.p>
      </div>
    </section>
  );
}
