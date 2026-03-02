"use client";

import { motion } from "framer-motion";

const companies = [
  { name: "Nextera", color: "#4F46E5" },
  { name: "Pulsewave", color: "#14B8A6" },
  { name: "CloudForm", color: "#6366F1" },
  { name: "DataSpark", color: "#F59E0B" },
  { name: "Vortex Labs", color: "#8B5CF6" },
  { name: "Gridline", color: "#0EA5E9" },
  { name: "Arcway", color: "#14B8A6" },
  { name: "Elevate HQ", color: "#4F46E5" },
];

// Duplicate for seamless loop
const allCompanies = [...companies, ...companies];

function CompanyLogo({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white border border-slate-200/70 shadow-sm flex-shrink-0 hover:border-indigo-200 hover:shadow-md transition-all group">
      {/* Abstract logo mark */}
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="1" fill={color} opacity="0.8" />
          <rect x="8" y="1" width="5" height="5" rx="1" fill={color} opacity="0.4" />
          <rect x="1" y="8" width="5" height="5" rx="1" fill={color} opacity="0.4" />
          <rect x="8" y="8" width="5" height="5" rx="1" fill={color} opacity="0.8" />
        </svg>
      </div>
      <span
        className="text-sm font-semibold text-slate-600 group-hover:text-slate-800 transition-colors whitespace-nowrap"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {name}
      </span>
    </div>
  );
}

export default function LogoCloud() {
  return (
    <section className="py-16 bg-off-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center text-slate-500 text-sm font-medium uppercase tracking-widest"
        >
          Trusted by 10,000+ forward-thinking teams
        </motion.p>
      </div>

      {/* Marquee container */}
      <div className="relative">
        {/* Fade masks */}
        <div
          className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to right, #F8FAFC, transparent)" }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to left, #F8FAFC, transparent)" }}
        />

        {/* Scrolling row */}
        <div className="flex overflow-hidden">
          <motion.div
            className="flex gap-4 items-center"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 28,
                ease: "linear",
              },
            }}
          >
            {allCompanies.map((company, i) => (
              <CompanyLogo key={`${company.name}-${i}`} name={company.name} color={company.color} />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
