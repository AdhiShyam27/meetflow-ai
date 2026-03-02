"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Product Manager",
    company: "CloudForm",
    avatar: { initials: "SC", color: "#4F46E5" },
    rating: 5,
    quote:
      "MeetFlow AI completely transformed how our team runs standups. We save at least 2 hours every week — and our follow-through on action items has improved dramatically.",
    highlight: "save at least 2 hours every week",
  },
  {
    name: "Marcus Rivera",
    role: "Engineering Lead",
    company: "Nextera",
    avatar: { initials: "MR", color: "#14B8A6" },
    rating: 5,
    quote:
      "Incredibly accurate, even with our multilingual team. MeetFlow handles Spanish, Portuguese, and English seamlessly in the same meeting. We haven't found anything close.",
    highlight: "multilingual team",
  },
  {
    name: "Priya Sharma",
    role: "Head of Operations",
    company: "DataSpark",
    avatar: { initials: "PS", color: "#F59E0B" },
    rating: 5,
    quote:
      "The one-click AI action workflows are unmatched. I send summaries to Slack, create Jira tickets, and draft follow-up emails — all in under 30 seconds after a meeting ends.",
    highlight: "one-click AI action workflows",
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="py-24 bg-off-white" id="testimonials">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-amber-600 font-semibold text-sm uppercase tracking-widest mb-3">
            Testimonials
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Loved by teams everywhere
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Join half a million professionals who transformed how they run meetings.
          </p>
        </motion.div>

        {/* Testimonial grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.6 }}
              whileHover={{ y: -4 }}
              className="relative bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/60 border border-slate-200/50 group transition-all duration-300"
            >
              {/* Quote decoration */}
              <div className="absolute -top-3 -left-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md"
                  style={{ background: "linear-gradient(135deg, #4F46E5, #14B8A6)" }}
                >
                  <Quote className="w-4 h-4 text-white" />
                </div>
              </div>

              {/* Gradient accent line */}
              <div
                className="absolute top-0 left-6 right-6 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(to right, ${t.avatar.color}, transparent)`,
                }}
              />

              {/* Rating */}
              <div className="mt-2 mb-4">
                <StarRating count={t.rating} />
              </div>

              {/* Quote */}
              <blockquote className="text-slate-600 text-sm leading-relaxed mb-6">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${t.avatar.color}, ${t.avatar.color}90)`,
                    boxShadow: `0 4px 12px ${t.avatar.color}30`,
                  }}
                >
                  {t.avatar.initials}
                </div>
                <div>
                  <p className="text-slate-800 font-semibold text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs">
                    {t.role} at{" "}
                    <span style={{ color: t.avatar.color }} className="font-medium">
                      {t.company}
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom social proof */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-12"
        >
          <div className="inline-flex items-center gap-4 bg-white rounded-full px-6 py-3 shadow-md border border-slate-200/80">
            {/* Avatar stack */}
            <div className="flex -space-x-2">
              {[
                { c: "#4F46E5", i: "JK" },
                { c: "#14B8A6", i: "AL" },
                { c: "#F59E0B", i: "RT" },
                { c: "#8B5CF6", i: "MW" },
                { c: "#EC4899", i: "SB" },
              ].map((a, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: a.c, zIndex: 5 - i }}
                >
                  {a.i}
                </div>
              ))}
            </div>
            <div className="text-left">
              <StarRating count={5} />
              <p className="text-slate-500 text-xs mt-0.5">
                <span className="text-slate-700 font-semibold">4.9/5</span> from 8,000+ reviews
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
