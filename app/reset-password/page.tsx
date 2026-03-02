"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      toast.success("Password updated! Redirecting…");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password";
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
        <div className="inline-flex items-center gap-2 mb-10">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-teal-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base" style={{ fontFamily: "'Inter', sans-serif" }}>
            <span className="text-indigo-600">Meet</span>
            <span className="text-slate-800">Flow</span>
            <span className="text-teal-500 text-sm ml-0.5">AI</span>
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm"
        >
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-5">
            <ShieldCheck className="w-6 h-6 text-teal-600" />
          </div>

          <h1
            className="text-xl font-bold text-slate-900 mb-1"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Set new password
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            Choose a strong password for your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Confirm password
              </label>
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Password strength indicator */}
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => {
                    const strength = Math.min(4, Math.floor(password.length / 3));
                    return (
                      <div
                        key={i}
                        className="flex-1 h-1 rounded-full transition-all"
                        style={{
                          background: i < strength
                            ? strength <= 1 ? "#EF4444" : strength <= 2 ? "#F59E0B" : strength <= 3 ? "#14B8A6" : "#22C55E"
                            : "#E2E8F0"
                        }}
                      />
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400">
                  {password.length < 8 ? "Too short" : password.length < 12 ? "Fair" : password.length < 16 ? "Good" : "Strong"}
                </p>
              </div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-200 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Updating…" : "Update password"}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
