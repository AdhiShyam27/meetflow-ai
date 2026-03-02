"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Zap, Users, Building2, ArrowRight, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Free",
    icon: <Zap className="w-5 h-5" />,
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Perfect for trying out MeetFlow AI",
    color: "#64748B",
    featured: false,
    cta: "Get Started Free",
    ctaStyle: "outline",
    features: [
      "10 transcripts per month",
      "Basic AI summaries",
      "Chrome extension",
      "English only",
      "7-day transcript history",
      "Email support",
    ],
  },
  {
    name: "Pro",
    icon: <Sparkles className="w-5 h-5" />,
    monthlyPrice: 12,
    annualPrice: 9,
    description: "For professionals who run meetings daily",
    color: "#4F46E5",
    featured: true,
    cta: "Start Pro Trial",
    ctaStyle: "filled",
    features: [
      "Unlimited transcripts",
      "Advanced AI summaries & insights",
      "Custom AI prompts",
      "60+ languages",
      "All integrations (Slack, Jira, Notion…)",
      "Priority support",
      "Unlimited transcript history",
      "AI Workflows (10/month)",
    ],
  },
  {
    name: "Team",
    icon: <Users className="w-5 h-5" />,
    monthlyPrice: 20,
    annualPrice: 16,
    description: "Scale AI meeting intelligence across your team",
    color: "#14B8A6",
    featured: false,
    cta: "Contact Sales",
    ctaStyle: "outline-teal",
    features: [
      "Everything in Pro",
      "Team Spaces & shared library",
      "Admin dashboard",
      "SSO / SAML",
      "Custom onboarding",
      "Dedicated CSM",
      "Unlimited AI Workflows",
      "HIPAA & SOC 2 compliance",
    ],
  },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="py-24 bg-white" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-indigo-600 font-semibold text-sm uppercase tracking-widest mb-3">
            Pricing
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Start free. Scale when you&apos;re ready.
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto mb-8">
            No credit card required. Cancel anytime.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 bg-slate-100 rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !annual
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                annual
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Annual
              <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                Save 25%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className={`relative rounded-2xl p-7 transition-all duration-300 ${
                plan.featured
                  ? "shadow-2xl shadow-indigo-200/50 scale-[1.02]"
                  : "bg-white border border-slate-200/80 shadow-lg shadow-slate-100"
              }`}
              style={
                plan.featured
                  ? {
                      background: "linear-gradient(145deg, #0F172A 0%, #1e1b4b 100%)",
                    }
                  : {}
              }
            >
              {/* Featured gradient border */}
              {plan.featured && (
                <div
                  className="absolute -inset-[1px] rounded-2xl -z-10"
                  style={{
                    background: "linear-gradient(135deg, #4F46E5, #14B8A6, #F59E0B)",
                    borderRadius: "inherit",
                  }}
                />
              )}

              {/* Most Popular badge */}
              {plan.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1 rounded-full shadow-lg"
                    style={{ background: "linear-gradient(135deg, #4F46E5, #14B8A6)" }}
                  >
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="flex items-center gap-2.5 mb-5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: plan.featured ? `${plan.color}30` : `${plan.color}12`,
                    color: plan.featured ? "#A5B4FC" : plan.color,
                  }}
                >
                  {plan.icon}
                </div>
                <div>
                  <h3
                    className={`font-bold text-lg ${plan.featured ? "text-white" : "text-slate-800"}`}
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    {plan.name}
                  </h3>
                  <p className={`text-xs ${plan.featured ? "text-slate-400" : "text-slate-400"}`}>
                    {plan.description}
                  </p>
                </div>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-end gap-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={annual ? "annual" : "monthly"}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className={`text-4xl font-bold ${plan.featured ? "text-white" : "text-slate-900"}`}
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
                      {plan.monthlyPrice === 0
                        ? "Free"
                        : `$${annual ? plan.annualPrice : plan.monthlyPrice}`}
                    </motion.span>
                  </AnimatePresence>
                  {plan.monthlyPrice > 0 && (
                    <span className={`text-sm mb-1 ${plan.featured ? "text-slate-400" : "text-slate-400"}`}>
                      / user / mo
                    </span>
                  )}
                </div>
                {annual && plan.monthlyPrice > 0 && (
                  <p className={`text-xs mt-1 ${plan.featured ? "text-slate-400" : "text-slate-500"}`}>
                    Billed annually (${plan.annualPrice * 12}/yr)
                  </p>
                )}
              </div>

              {/* CTA */}
              <motion.a
                href="/signup"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-sm mb-7 transition-all ${
                  plan.ctaStyle === "filled"
                    ? "bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-500/30"
                    : plan.ctaStyle === "outline-teal"
                    ? "border border-teal-500 text-teal-600 hover:bg-teal-50 bg-transparent"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50 bg-transparent"
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4" />
              </motion.a>

              {/* Divider */}
              <div
                className={`h-px mb-6 ${plan.featured ? "bg-white/10" : "bg-slate-100"}`}
              />

              {/* Features */}
              <ul className="space-y-3">
                {plan.features.map((feature, fi) => (
                  <li key={fi} className="flex items-start gap-2.5">
                    <CheckCircle
                      className="w-4 h-4 flex-shrink-0 mt-0.5"
                      style={{
                        color: plan.featured ? "#5EEAD4" : plan.color,
                      }}
                    />
                    <span
                      className={`text-sm ${plan.featured ? "text-slate-300" : "text-slate-600"}`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Enterprise banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border border-indigo-200 bg-indigo-50/50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-slate-800 font-semibold text-sm">
                Need a custom enterprise plan?
              </p>
              <p className="text-slate-500 text-xs">
                Custom pricing, volume discounts, dedicated infrastructure
              </p>
            </div>
          </div>
          <motion.a
            href="#"
            whileHover={{ scale: 1.03 }}
            className="flex-shrink-0 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-md shadow-indigo-200"
          >
            Talk to Sales
            <ArrowRight className="w-4 h-4" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
