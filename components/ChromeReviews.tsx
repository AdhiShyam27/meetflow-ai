"use client";

import { motion } from "framer-motion";
import { Star, Chrome, ThumbsUp } from "lucide-react";

const reviews = [
  {
    name: "Sarah Chen",
    initials: "SC",
    color: "#4F46E5",
    date: "2 days ago",
    rating: 5,
    title: "Game changer for remote teams",
    body: "Finally an AI transcription tool that doesn't send a creepy bot into your call. MeetFlow just works — quietly, accurately, and the AI summaries are genuinely useful. Saving 2+ hours a week.",
    helpful: 142,
  },
  {
    name: "Marcus Rivera",
    initials: "MR",
    color: "#14B8A6",
    date: "1 week ago",
    rating: 5,
    title: "Incredibly accurate, multilingual too",
    body: "We have team members in Spain, Brazil, and Japan. MeetFlow handles all three in the same call without missing a beat. Action items are auto-extracted. 10/10 would recommend.",
    helpful: 98,
  },
  {
    name: "Priya Sharma",
    initials: "PS",
    color: "#F59E0B",
    date: "3 weeks ago",
    rating: 5,
    title: "One-click summaries are unreal",
    body: "I used to spend 30 minutes writing up meeting notes. Now I just click 'Summarize' and get a perfect structured output in seconds. The Slack integration is a huge bonus. Must-have extension.",
    helpful: 76,
  },
  {
    name: "David Kim",
    initials: "DK",
    color: "#8B5CF6",
    date: "1 month ago",
    rating: 5,
    title: "Best Chrome extension I've installed in years",
    body: "Tried 4 other transcription tools. All sent bots into calls, my clients hated it. MeetFlow is invisible to other participants, perfectly accurate, and the AI is genuinely smart.",
    helpful: 203,
  },
  {
    name: "Emma Kowalski",
    initials: "EK",
    color: "#EC4899",
    date: "1 month ago",
    rating: 5,
    title: "Essential for sales calls",
    body: "Every sales call I do is now automatically transcribed and summarized. I can focus fully on the conversation instead of taking notes. Our close rate has improved since we started using this.",
    helpful: 58,
  },
];

function StarRating({ count, size = "sm" }: { count: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${sz} ${i < count ? "text-amber-400 fill-amber-400" : "text-slate-200"}`}
        />
      ))}
    </div>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs w-3 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full bg-amber-400"
        />
      </div>
      <span className="text-slate-400 text-xs w-5 flex-shrink-0">{count}</span>
    </div>
  );
}

export default function ChromeReviews() {
  const totalReviews = 8241;
  const ratingDist = [
    { label: "5", count: 7610 },
    { label: "4", count: 412 },
    { label: "3", count: 148 },
    { label: "2", count: 43 },
    { label: "1", count: 28 },
  ];

  return (
    <section className="py-24 bg-white" id="reviews">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4">
            <Chrome className="w-4 h-4 text-amber-600" />
            <span className="text-amber-700 text-sm font-medium">Chrome Web Store</span>
          </div>
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Rated #1 on the Chrome Web Store
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Over 8,000 verified reviews from real users — not bots.
          </p>
        </motion.div>

        {/* Rating summary + reviews */}
        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Summary card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-slate-50 rounded-3xl p-7 border border-slate-200 sticky top-24"
          >
            {/* Big rating */}
            <div className="text-center mb-6">
              <div className="text-7xl font-black text-slate-900 leading-none mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                4.9
              </div>
              <StarRating count={5} size="lg" />
              <p className="text-slate-400 text-sm mt-2">{totalReviews.toLocaleString()} reviews</p>
            </div>

            {/* Distribution */}
            <div className="space-y-2 mb-7">
              {ratingDist.map((r) => (
                <RatingBar key={r.label} label={r.label} count={r.count} total={totalReviews} />
              ))}
            </div>

            {/* Chrome store button */}
            <motion.a
              href="#"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors shadow-lg shadow-slate-900/20"
            >
              <Chrome className="w-4 h-4" />
              Add to Chrome — Free
            </motion.a>

            <p className="text-slate-400 text-xs text-center mt-3">
              500,000+ active users · No credit card
            </p>
          </motion.div>

          {/* Review cards */}
          <div className="lg:col-span-2 space-y-4">
            {reviews.map((review, i) => (
              <motion.div
                key={review.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-200/60 transition-all"
              >
                {/* Review header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${review.color}, ${review.color}99)`,
                        boxShadow: `0 2px 8px ${review.color}30`,
                      }}
                    >
                      {review.initials}
                    </div>
                    <div>
                      <p className="text-slate-800 font-semibold text-sm">{review.name}</p>
                      <p className="text-slate-400 text-xs">{review.date}</p>
                    </div>
                  </div>
                  <StarRating count={review.rating} />
                </div>

                {/* Review body */}
                <p className="text-slate-800 font-semibold text-sm mb-1.5">{review.title}</p>
                <p className="text-slate-500 text-sm leading-relaxed mb-3">{review.body}</p>

                {/* Helpful */}
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <ThumbsUp className="w-3 h-3" />
                  <span>{review.helpful} people found this helpful</span>
                </div>
              </motion.div>
            ))}

            {/* View more */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center pt-2"
            >
              <a
                href="#"
                className="text-indigo-600 font-medium text-sm hover:underline"
              >
                View all 8,241 reviews on Chrome Web Store →
              </a>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
