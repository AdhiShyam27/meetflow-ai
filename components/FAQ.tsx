"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Does MeetFlow AI record my meeting audio?",
    a: "No — never. MeetFlow AI transcribes speech to text in real-time using your browser's local audio processing, but we never record or store your audio. Only the transcript text is ever sent to our servers, and only with your explicit permission.",
  },
  {
    q: "Will others in the meeting see the transcription?",
    a: "No. Transcription is completely private to you. No notification is sent to other participants, no bot joins the call, and nothing is visible on your screen share. Your transcript is for your eyes only.",
  },
  {
    q: "Does MeetFlow AI use ChatGPT to generate summaries?",
    a: "We use enterprise-grade AI APIs from leading providers (including Anthropic and OpenAI) with strict data processing agreements. Your data is never used for model training and is processed under strict enterprise confidentiality terms.",
  },
  {
    q: "Is my transcript data used to train your AI models?",
    a: "Absolutely not. Your transcript data belongs to you. We never use your meeting content to train, fine-tune, or improve any AI model — ours or anyone else's. This is a core commitment in our Terms of Service.",
  },
  {
    q: "What languages does MeetFlow AI support?",
    a: "MeetFlow AI supports 60+ languages including English, Spanish, French, German, Portuguese, Japanese, Mandarin, Hindi, Arabic, Korean, and many more. Speaker identification works across mixed-language meetings.",
  },
  {
    q: "Can I install MeetFlow AI for my entire team?",
    a: "Yes! Contact your IT admin to deploy MeetFlow AI via Chrome managed policies for your entire organization. Our Team and Enterprise plans include centralized billing, SSO, admin dashboards, and dedicated onboarding support.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-24 bg-off-white" id="faq">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="text-indigo-600 font-semibold text-sm uppercase tracking-widest mb-3">
            FAQ
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Questions? We&apos;ve got answers.
          </h2>
        </motion.div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                openIndex === i
                  ? "border-indigo-200 shadow-md shadow-indigo-100/50"
                  : "border-slate-200 hover:border-indigo-200/60"
              } bg-white`}
            >
              <button
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span
                  className={`font-semibold text-sm leading-snug transition-colors ${
                    openIndex === i ? "text-indigo-600" : "text-slate-800"
                  }`}
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {faq.q}
                </span>
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    openIndex === i
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {openIndex === i ? (
                    <Minus className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-slate-500 text-sm leading-relaxed border-t border-slate-100 pt-4">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Help link */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-10"
        >
          <p className="text-slate-400 text-sm">
            Still have questions?{" "}
            <a href="#" className="text-indigo-600 font-medium hover:underline">
              Visit our Help Center
            </a>{" "}
            or{" "}
            <a href="#" className="text-indigo-600 font-medium hover:underline">
              chat with us →
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
