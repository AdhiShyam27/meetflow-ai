"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Trophy, Mic2, Users, Star } from "lucide-react";

interface StatItem {
  icon: React.ReactNode;
  value: string;
  numericEnd: number;
  suffix: string;
  prefix: string;
  label: string;
  color: string;
}

const stats: StatItem[] = [
  {
    icon: <Trophy className="w-5 h-5" />,
    value: "#1",
    numericEnd: 1,
    suffix: "",
    prefix: "#",
    label: "Meeting AI Tool",
    color: "#F59E0B",
  },
  {
    icon: <Mic2 className="w-5 h-5" />,
    value: "2M+",
    numericEnd: 2,
    suffix: "M+",
    prefix: "",
    label: "Meetings Transcribed Weekly",
    color: "#4F46E5",
  },
  {
    icon: <Users className="w-5 h-5" />,
    value: "500K+",
    numericEnd: 500,
    suffix: "K+",
    prefix: "",
    label: "Active Users",
    color: "#14B8A6",
  },
  {
    icon: <Star className="w-5 h-5" />,
    value: "4.9",
    numericEnd: 49,
    suffix: "",
    prefix: "",
    label: "Chrome Store Rating",
    color: "#F59E0B",
  },
];

function AnimatedCounter({
  end,
  prefix,
  suffix,
  isHash,
  isDecimal,
}: {
  end: number;
  prefix: string;
  suffix: string;
  isHash: boolean;
  isDecimal: boolean;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1600;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end]);

  const displayValue = isDecimal
    ? (count / 10).toFixed(1)
    : isHash
    ? `#${count}`
    : `${prefix}${count}${suffix}`;

  return <span ref={ref}>{displayValue}</span>;
}

export default function StatsBar() {
  return (
    <section className="py-12 bg-off-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #0F172A 0%, #1e1b4b 50%, #0c1f3d 100%)",
            padding: "2px",
          }}
        >
          {/* Gradient border wrapper */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              background: "linear-gradient(135deg, rgba(79,70,229,0.5), rgba(20,184,166,0.3), rgba(245,158,11,0.3))",
            }}
          />
          <div
            className="relative rounded-3xl px-6 py-10"
            style={{
              background: "linear-gradient(135deg, #0F172A 0%, #1e1b4b 50%, #0c1f3d 100%)",
            }}
          >
            {/* Decorative element */}
            <div className="absolute top-0 right-0 w-64 h-64 opacity-10 pointer-events-none">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle cx="150" cy="50" r="80" fill="none" stroke="#4F46E5" strokeWidth="1" />
                <circle cx="150" cy="50" r="50" fill="none" stroke="#14B8A6" strokeWidth="1" />
              </svg>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="flex flex-col items-center text-center"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{
                      background: `${stat.color}20`,
                      border: `1px solid ${stat.color}40`,
                      color: stat.color,
                    }}
                  >
                    {stat.icon}
                  </div>
                  <div
                    className="text-3xl sm:text-4xl font-bold mb-1"
                    style={{ color: stat.color, fontFamily: "'Inter', sans-serif" }}
                  >
                    <AnimatedCounter
                      end={stat.numericEnd}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      isHash={stat.prefix === "#"}
                      isDecimal={stat.label === "Chrome Store Rating"}
                    />
                  </div>
                  <p className="text-slate-400 text-sm font-medium leading-tight">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
