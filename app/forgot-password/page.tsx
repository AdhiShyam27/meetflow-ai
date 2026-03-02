"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Zap, ArrowLeft, Loader2, Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) throw error;

      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send reset email";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50 px-4"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <a href="/login" className="inline-flex items-center gap-2 mb-10 group">
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base" style={{ fontFamily: "'Inter', sans-serif" }}>
            <span className="text-indigo-600">Meet</span>
            <span className="text-slate-800">Flow</span>
            <span className="text-teal-500 text-sm ml-0.5">AI</span>
          </span>
        </a>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm"
        >
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-teal-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                Check your email
              </h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                We sent a password reset link to <strong className="text-slate-700">{email}</strong>.
                Check your inbox (and spam folder).
              </p>
              <a
                href="/login"
                className="text-indigo-600 font-medium text-sm hover:underline"
              >
                Back to login
              </a>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-5">
                <Mail className="w-6 h-6 text-indigo-600" />
              </div>
              <h1
                className="text-xl font-bold text-slate-900 mb-1"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Forgot your password?
              </h1>
              <p className="text-slate-500 text-sm mb-6">
                Enter your email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-200 disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Sending…" : "Send reset link"}
                </motion.button>

                <div className="text-center">
                  <a href="/login" className="text-slate-500 text-sm hover:text-indigo-600 transition-colors">
                    Back to login
                  </a>
                </div>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
