"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { createClient, isDemoMode } from "@/lib/supabase/client";

const DEMO_EMAIL = "demo@meetflow.ai";
const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isDemoMode) {
        // Demo mode — accept any credentials
        await new Promise((r) => setTimeout(r, 800));
        localStorage.setItem("meetflow_demo_user", JSON.stringify({ email, name: "Demo User" }));
        toast.success("Welcome back! (Demo mode)");
        router.push("/dashboard");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      toast.success("Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Left: form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16">
        <div className="max-w-sm mx-auto w-full">
          {/* Logo */}
          <a href="/" className="inline-flex items-center gap-2 mb-10 group">
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
          >
            <h1
              className="text-2xl font-bold text-slate-900 mb-1"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Welcome back
            </h1>
            <p className="text-slate-500 text-sm mb-8">
              Don&apos;t have an account?{" "}
              <a href="/signup" className="text-indigo-600 font-medium hover:underline">
                Sign up free
              </a>
            </p>

            {/* Demo banner */}
            {isDemoMode && (
              <button
                type="button"
                onClick={fillDemo}
                className="w-full mb-6 py-2.5 px-4 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors text-center"
              >
                ✨ Click to fill demo credentials
              </button>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
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

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <a href="/forgot-password" className="text-xs text-indigo-600 hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-200 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Signing in…" : "Sign in"}
              </motion.button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-slate-400 text-xs">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={async () => {
                if (isDemoMode) { fillDemo(); return; }
                const supabase = createClient();
                await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${window.location.origin}/auth/callback` },
                });
              }}
              className="mt-5 w-full py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors flex items-center justify-center gap-2.5"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </motion.div>
        </div>
      </div>

      {/* Right: brand panel */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1e1b4b 60%, #0c2340 100%)" }}
      >
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative z-10 max-w-sm text-center"
        >
          <div className="text-5xl mb-6">🎙️</div>
          <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>
            Your meetings,{" "}
            <span style={{ background: "linear-gradient(135deg,#6366F1,#14B8A6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
              distilled into action.
            </span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Sign in to access your transcripts, AI summaries, and meeting insights.
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[["2M+","Transcripts/week"],["500K+","Active users"],["4.9★","Chrome rating"]].map(([v,l]) => (
              <div key={l} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-white font-bold text-base">{v}</p>
                <p className="text-slate-400 text-xs mt-0.5">{l}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
