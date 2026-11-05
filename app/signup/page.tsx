"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { createClient, isDemoMode } from "@/lib/supabase/client";

const perks = [
  "Live transcription — no bot joins",
  "AI summaries in 10 seconds",
  "Works on Google Meet, Zoom & Teams",
  "10 free meetings per month",
];

type FieldErrors = { name?: string; email?: string; password?: string };

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const update = (k: keyof FieldErrors, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const validate = () => {
    const next: FieldErrors = {};
    if (!form.name.trim()) {
      next.name = "Please enter your name.";
    }
    if (!form.email.trim()) {
      next.email = "Please enter your email address.";
    }
    if (!form.password) {
      next.password = "Please choose a password.";
    } else if (form.password.length < 8) {
      next.password = "Password must be at least 8 characters.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setLoading(true);

    try {
      if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 900));
        localStorage.setItem("meetflow_demo_user", JSON.stringify({ email: form.email, name: form.name }));
        toast.success("Account created! Welcome to MeetFlow AI (Demo mode)");
        router.push("/dashboard");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      toast.success("Check your email to confirm your account!");
      router.push("/login");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Left: form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16">
        <div className="max-w-sm mx-auto w-full">
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
            <h1 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
              Create your free account
            </h1>
            <p className="text-slate-500 text-sm mb-7">
              Already have one?{" "}
              <a href="/login" className="text-indigo-600 font-medium hover:underline">
                Sign in
              </a>
            </p>

            {isDemoMode && (
              <div className="mb-5 py-2.5 px-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                ✨ Demo mode — no real account is created. Your data stays local.
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Sarah Chen"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "signup-name-error" : undefined}
                  className={`w-full px-4 py-3 rounded-xl border text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 transition-all ${
                    errors.name
                      ? "border-red-300 focus:ring-red-500/40 focus:border-red-400"
                      : "border-slate-200 focus:ring-indigo-500/50 focus:border-indigo-500"
                  }`}
                />
                {errors.name && (
                  <p id="signup-name-error" className="mt-1.5 text-xs text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Work email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@company.com"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "signup-email-error" : undefined}
                  className={`w-full px-4 py-3 rounded-xl border text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 transition-all ${
                    errors.email
                      ? "border-red-300 focus:ring-red-500/40 focus:border-red-400"
                      : "border-slate-200 focus:ring-indigo-500/50 focus:border-indigo-500"
                  }`}
                />
                {errors.email && (
                  <p id="signup-email-error" className="mt-1.5 text-xs text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="Min. 8 characters"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "signup-password-error" : undefined}
                    className={`w-full px-4 py-3 pr-11 rounded-xl border text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 transition-all ${
                      errors.password
                        ? "border-red-300 focus:ring-red-500/40 focus:border-red-400"
                        : "border-slate-200 focus:ring-indigo-500/50 focus:border-indigo-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="signup-password-error" className="mt-1.5 text-xs text-red-600">{errors.password}</p>
                )}
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-amber-200 disabled:opacity-60"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Creating account…" : "Get started — it's free"}
              </motion.button>

              <p className="text-slate-400 text-xs text-center">
                By signing up you agree to our{" "}
                <a href="#" className="text-indigo-600 hover:underline">Terms</a> and{" "}
                <a href="#" className="text-indigo-600 hover:underline">Privacy Policy</a>.
              </p>
            </form>
          </motion.div>
        </div>
      </div>

      {/* Right: perks */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1e1b4b 60%, #134e4a 100%)" }}
      >
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative z-10 max-w-sm"
        >
          <div className="text-4xl mb-6">✨</div>
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>
            What you get for free
          </h2>
          <p className="text-slate-400 text-sm mb-8">No credit card. No bots. No nonsense.</p>

          <ul className="space-y-4">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-3 h-3 text-teal-400" />
                </div>
                <span className="text-slate-300 text-sm">{perk}</span>
              </li>
            ))}
          </ul>

        </motion.div>
      </div>
    </div>
  );
}
