"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const integrations = [
  {
    name: "Slack",
    description: "Send summaries to any channel",
    color: "#4A154B",
    bg: "#4A154B",
    letter: "S",
    shape: "circle",
  },
  {
    name: "Linear",
    description: "Auto-create issues from action items",
    color: "#5E6AD2",
    bg: "#5E6AD2",
    letter: "L",
    shape: "rounded",
  },
  {
    name: "HubSpot",
    description: "Log calls & update CRM records",
    color: "#FF7A59",
    bg: "#FF7A59",
    letter: "H",
    shape: "circle",
  },
  {
    name: "Notion",
    description: "Push notes to any workspace page",
    color: "#000000",
    bg: "#1f1f1f",
    letter: "N",
    shape: "rounded",
  },
  {
    name: "Jira",
    description: "Create and assign tickets instantly",
    color: "#0052CC",
    bg: "#0052CC",
    letter: "J",
    shape: "circle",
  },
  {
    name: "Google Docs",
    description: "Export transcripts as documents",
    color: "#4285F4",
    bg: "#4285F4",
    letter: "G",
    shape: "rounded",
  },
  {
    name: "Salesforce",
    description: "Update opportunities after every call",
    color: "#00A1E0",
    bg: "#00A1E0",
    letter: "SF",
    shape: "circle",
  },
  {
    name: "Asana",
    description: "Turn decisions into project tasks",
    color: "#F06A6A",
    bg: "#F06A6A",
    letter: "A",
    shape: "rounded",
  },
];

export default function Integrations() {
  return (
    <section className="py-24 bg-white" id="integrations">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-teal-600 font-semibold text-sm uppercase tracking-widest mb-3">
            Integrations
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Automate your post-meeting workflow
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Connect MeetFlow AI with the tools your team already uses and let AI handle the rest.
          </p>
        </motion.div>

        {/* Integration grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
          {integrations.map((integration, i) => (
            <motion.div
              key={integration.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              whileHover={{
                y: -4,
                boxShadow: `0 12px 32px ${integration.color}25`,
              }}
              className="group relative rounded-2xl p-5 bg-white border border-slate-200/80 cursor-pointer transition-all duration-300"
            >
              {/* Glow on hover */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${integration.color}08, transparent)`,
                }}
              />

              {/* Integration logo */}
              <div
                className={`w-11 h-11 flex items-center justify-center mb-3 text-white font-bold text-sm shadow-md ${
                  integration.shape === "circle" ? "rounded-full" : "rounded-xl"
                }`}
                style={{ background: integration.bg }}
              >
                {integration.letter}
              </div>

              <h3 className="text-slate-800 font-semibold text-sm mb-1 group-hover:text-indigo-600 transition-colors">
                {integration.name}
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {integration.description}
              </p>

              {/* Arrow indicator */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight
                  className="w-3.5 h-3.5"
                  style={{ color: integration.color }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center"
        >
          <p className="text-slate-400 text-sm mb-4">
            +50 more integrations available via Zapier and Make
          </p>
          <motion.a
            href="#"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm border border-indigo-200 rounded-full px-6 py-2.5 hover:bg-indigo-50 transition-colors"
          >
            View all integrations
            <ArrowRight className="w-4 h-4" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
