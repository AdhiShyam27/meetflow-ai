"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  User, Shield, Trash2, Loader2, Eye, EyeOff,
  Save, AlertTriangle, CheckCircle2, Key, Link2, Link2Off, Zap, ChevronDown, ChevronUp,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  email: string;
  full_name: string;
}

interface GoogleStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

interface WorkflowConfig {
  slack: { enabled: boolean; webhookUrl: string };
  email: { enabled: boolean; recipients: string };
  notion: { enabled: boolean; apiKey: string; databaseId: string };
  linear: { enabled: boolean; apiKey: string; teamId: string };
  webhook: { enabled: boolean; url: string };
}

const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  slack: { enabled: false, webhookUrl: "" },
  email: { enabled: false, recipients: "" },
  notion: { enabled: false, apiKey: "", databaseId: "" },
  linear: { enabled: false, apiKey: "", teamId: "" },
  webhook: { enabled: false, url: "" },
};

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 ${checked ? "bg-indigo-600" : "bg-slate-200"}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

// ── Settings page ─────────────────────────────────────────────────────────────

function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile>({ email: "", full_name: "" });
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Password form
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Profile form
  const [savingProfile, setSavingProfile] = useState(false);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Google integration
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ connected: false, email: null, connectedAt: null });
  const [disconnecting, setDisconnecting] = useState(false);

  // LLM / AI model config
  const [llmModel, setLlmModel] = useState("anthropic/claude-sonnet-4-6");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmHasKey, setLlmHasKey] = useState(false);
  const [savingLlm, setSavingLlm] = useState(false);

  // Workflow config
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig>(DEFAULT_WORKFLOW_CONFIG);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [savingWorkflow, setSavingWorkflow] = useState<Record<string, boolean>>({});
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setProfile({
        email: user.email ?? "",
        full_name: user.user_metadata?.full_name ?? "",
      });
      setLoadingProfile(false);
    }
    load();

    // Fetch Google connection status
    fetch("/api/google/status")
      .then((r) => r.json())
      .then(setGoogleStatus)
      .catch(() => {});

    // Fetch LLM config
    fetch("/api/llm/config")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setLlmModel(data.model || "anthropic/claude-sonnet-4-6");
          setLlmHasKey(data.hasApiKey ?? false);
        }
      })
      .catch(() => {});

    // Fetch workflow config
    fetch("/api/workflows/config")
      .then((r) => r.ok ? r.json() : DEFAULT_WORKFLOW_CONFIG)
      .then((cfg: WorkflowConfig) => setWorkflowConfig(cfg))
      .catch(() => {})
      .finally(() => setWorkflowLoading(false));

    // Show toast based on redirect param
    const googleParam = searchParams.get("google");
    if (googleParam === "connected") toast.success("Google Calendar & Gmail connected!");
    if (googleParam === "error") toast.error("Google connection failed. Please try again.");
    if (googleParam === "not-configured") toast.error("Google credentials not configured. Add GOOGLE_CLIENT_ID to your environment.");
  }, [router, searchParams]);

  const disconnectGoogle = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      setGoogleStatus({ connected: false, email: null, connectedAt: null });
      toast.success("Google account disconnected");
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.updateUser({
        data: { full_name: profile.full_name },
      });
      if (authError) throw authError;
      if (user) {
        await supabase
          .from("profiles")
          .update({ full_name: profile.full_name })
          .eq("id", user.id);
      }
      toast.success("Profile updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error("Passwords do not match"); return; }
    setSavingPw(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pwForm.next });
      if (error) throw error;
      toast.success("Password updated successfully");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSavingPw(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }
    setDeleting(true);
    try {
      await fetch("/api/account", { method: "DELETE" });
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Account deleted. Goodbye!");
      router.push("/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  // Save LLM config
  const saveLlmConfig = async () => {
    setSavingLlm(true);
    try {
      const payload: Record<string, string> = { model: llmModel };
      if (llmApiKey) payload.apiKey = llmApiKey;
      const res = await fetch("/api/llm/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setLlmHasKey(data.hasApiKey);
      setLlmApiKey("");
      toast.success("AI model settings saved");
    } catch {
      toast.error("Failed to save AI model settings");
    } finally {
      setSavingLlm(false);
    }
  };

  // Toggle a workflow enabled state and save immediately
  const toggleWorkflow = async (key: keyof WorkflowConfig, enabled: boolean) => {
    const updated = { ...workflowConfig, [key]: { ...workflowConfig[key], enabled } };
    setWorkflowConfig(updated);
    if (enabled && !expandedWorkflow) setExpandedWorkflow(key);

    setSavingWorkflow((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch("/api/workflows/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: { enabled } }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success(`${key.charAt(0).toUpperCase() + key.slice(1)} workflow ${enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to save workflow settings");
      // Revert
      setWorkflowConfig(workflowConfig);
    } finally {
      setSavingWorkflow((s) => ({ ...s, [key]: false }));
    }
  };

  // Save a specific workflow's config
  const saveWorkflow = async (key: keyof WorkflowConfig) => {
    setSavingWorkflow((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch("/api/workflows/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: workflowConfig[key] }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Workflow settings saved");
    } catch {
      toast.error("Failed to save workflow settings");
    } finally {
      setSavingWorkflow((s) => ({ ...s, [key]: false }));
    }
  };

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const workflowDefs = [
    {
      key: "slack" as const,
      icon: "💬",
      name: "Slack",
      desc: "Post meeting summary to a Slack channel after each meeting.",
      config: (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Slack Webhook URL
            </label>
            <input
              type="url"
              value={workflowConfig.slack.webhookUrl}
              onChange={(e) => setWorkflowConfig((c) => ({ ...c, slack: { ...c.slack, webhookUrl: e.target.value } }))}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
            />
            <a
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-500 hover:underline mt-1 inline-block"
            >
              Create an Incoming Webhook →
            </a>
          </div>
        </div>
      ),
    },
    {
      key: "email" as const,
      icon: "📧",
      name: "Email",
      desc: "Send meeting summary to team members via Gmail.",
      config: (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Recipient emails (comma-separated)
            </label>
            <textarea
              value={workflowConfig.email.recipients}
              onChange={(e) => setWorkflowConfig((c) => ({ ...c, email: { ...c.email, recipients: e.target.value } }))}
              placeholder="alice@example.com, bob@example.com"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">Requires Google account connected above.</p>
          </div>
        </div>
      ),
    },
    {
      key: "notion" as const,
      icon: "📝",
      name: "Notion",
      desc: "Save meeting notes and action items to a Notion database.",
      config: (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notion API Key</label>
            <input
              type="password"
              value={workflowConfig.notion.apiKey}
              onChange={(e) => setWorkflowConfig((c) => ({ ...c, notion: { ...c.notion, apiKey: e.target.value } }))}
              placeholder="secret_..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Database ID</label>
            <input
              type="text"
              value={workflowConfig.notion.databaseId}
              onChange={(e) => setWorkflowConfig((c) => ({ ...c, notion: { ...c.notion, databaseId: e.target.value } }))}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
            />
          </div>
          <a
            href="https://www.notion.so/help/create-integrations-with-the-notion-api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-500 hover:underline inline-block"
          >
            Create an integration →
          </a>
        </div>
      ),
    },
    {
      key: "linear" as const,
      icon: "✅",
      name: "Linear",
      desc: "Create Linear issues from action items extracted from meetings.",
      config: (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Linear API Key</label>
            <input
              type="password"
              value={workflowConfig.linear.apiKey}
              onChange={(e) => setWorkflowConfig((c) => ({ ...c, linear: { ...c.linear, apiKey: e.target.value } }))}
              placeholder="lin_api_..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Team ID</label>
            <input
              type="text"
              value={workflowConfig.linear.teamId}
              onChange={(e) => setWorkflowConfig((c) => ({ ...c, linear: { ...c.linear, teamId: e.target.value } }))}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
            />
          </div>
        </div>
      ),
    },
    {
      key: "webhook" as const,
      icon: "🔗",
      name: "Custom Webhook",
      desc: "Send meeting data to any HTTP endpoint when a meeting completes.",
      config: (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Webhook URL</label>
            <input
              type="url"
              value={workflowConfig.webhook.url}
              onChange={(e) => setWorkflowConfig((c) => ({ ...c, webhook: { ...c.webhook, url: e.target.value } }))}
              placeholder="https://your-server.com/webhook"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
            />
            <p className="text-xs text-slate-400 mt-1">We&apos;ll POST a JSON payload with meeting data and summary.</p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div id="settings-root" className="p-6 max-w-2xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Inter', sans-serif" }}>
          Settings
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your account and preferences.</p>
      </div>

      <div className="space-y-6">

        {/* ── Profile ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
        >
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <User className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-semibold text-slate-800 text-sm">Profile</h2>
          </div>

          <form onSubmit={saveProfile} className="p-6 space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                {(profile.full_name || profile.email)[0]?.toUpperCase() ?? "U"}
              </div>
              <div>
                <p className="text-slate-800 font-semibold text-sm">{profile.full_name || "Your Name"}</p>
                <p className="text-slate-400 text-xs">{profile.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Your full name"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-slate-100 text-slate-400 text-sm bg-slate-50 cursor-not-allowed"
              />
              <p className="text-slate-400 text-xs mt-1">Email cannot be changed directly. Contact support.</p>
            </div>

            <div className="flex justify-end">
              <motion.button
                type="submit"
                disabled={savingProfile}
                whileHover={{ scale: savingProfile ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingProfile ? "Saving…" : "Save changes"}
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* ── Security ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
        >
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
              <Key className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-semibold text-slate-800 text-sm">Change Password</h2>
          </div>

          <form onSubmit={changePassword} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  value={pwForm.next}
                  onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
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
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm new password</label>
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={pwForm.confirm}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
              {pwForm.confirm && pwForm.next !== pwForm.confirm && (
                <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
              )}
              {pwForm.confirm && pwForm.next === pwForm.confirm && pwForm.next.length >= 8 && (
                <p className="text-teal-600 text-xs mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <motion.button
                type="submit"
                disabled={savingPw}
                whileHover={{ scale: savingPw ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-60"
              >
                {savingPw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                {savingPw ? "Updating…" : "Update password"}
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* ── Google Integration ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
        >
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <h2 className="font-semibold text-slate-800 text-sm">Google Calendar & Gmail</h2>
          </div>

          <div className="p-6">
            {googleStatus.connected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-slate-800 font-semibold text-sm">Connected</p>
                    <p className="text-slate-400 text-xs">{googleStatus.email}</p>
                  </div>
                </div>
                <motion.button
                  onClick={disconnectGoogle}
                  disabled={disconnecting}
                  whileHover={{ scale: disconnecting ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60"
                >
                  {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                  Disconnect
                </motion.button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-700 text-sm font-medium mb-0.5">Connect your Google account</p>
                  <p className="text-slate-400 text-xs">See upcoming meetings, import details, and email AI summaries.</p>
                </div>
                <motion.a
                  href="/api/google/auth"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm flex-shrink-0 ml-4"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <Link2 className="w-3.5 h-3.5" />
                  Connect Google
                </motion.a>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { icon: "📅", label: "Upcoming meetings in dashboard" },
                { icon: "⚡", label: "One-click start from calendar" },
                { icon: "📧", label: "Email AI summary to yourself" },
              ].map((f) => (
                <div key={f.label} className="rounded-xl p-3 bg-slate-50 border border-slate-100 text-center">
                  <div className="text-lg mb-1">{f.icon}</div>
                  <p className="text-slate-500 text-xs leading-tight">{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── AI Model (OpenRouter) ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.19 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
        >
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">AI Model</h2>
              <p className="text-slate-400 text-xs">Choose any LLM via OpenRouter</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Model</label>
              <div className="relative">
                <input
                  type="text"
                  list="llm-models"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="anthropic/claude-sonnet-4-6"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
                <datalist id="llm-models">
                  <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4.6</option>
                  <option value="anthropic/claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                  <option value="openai/gpt-4o">GPT-4o</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                  <option value="google/gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                </datalist>
              </div>
              <p className="text-xs text-slate-400 mt-1">Pick from the list or type any OpenRouter model slug.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                OpenRouter API Key {llmHasKey && <span className="text-teal-600 font-normal">(saved)</span>}
              </label>
              <input
                type="password"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                placeholder={llmHasKey ? "••••••••  (leave blank to keep current)" : "sk-or-... (optional — uses server default)"}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
              <p className="text-xs text-slate-400 mt-1">
                {llmHasKey ? "Your key is encrypted. Leave blank to keep it, or enter a new one." : "Optional. If empty, the server\u2019s default key is used."}
              </p>
            </div>

            <div className="flex justify-end">
              <motion.button
                type="button"
                disabled={savingLlm}
                onClick={saveLlmConfig}
                whileHover={{ scale: savingLlm ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-60"
              >
                {savingLlm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingLlm ? "Saving…" : "Save model"}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── Meeting Workflows ── */}
        <motion.div
          id="workflows"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
        >
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Meeting Workflows</h2>
            </div>
          </div>

          <div className="p-6">
            <p className="text-slate-500 text-xs mb-5 leading-relaxed">
              Automate post-meeting tasks. Runs automatically after each recording.
            </p>

            {workflowLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {workflowDefs.map((def) => {
                  const isExpanded = expandedWorkflow === def.key;
                  const isEnabled = workflowConfig[def.key].enabled;
                  const isSaving = savingWorkflow[def.key] ?? false;

                  return (
                    <div
                      key={def.key}
                      className={`rounded-xl border transition-all ${isEnabled ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-white"}`}
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-3 p-4">
                        <span className="text-xl flex-shrink-0">{def.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{def.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{def.desc}</p>
                        </div>
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          {isSaving && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
                          <Toggle
                            checked={isEnabled}
                            onChange={(v) => toggleWorkflow(def.key, v)}
                            disabled={isSaving}
                          />
                          <button
                            type="button"
                            onClick={() => setExpandedWorkflow(isExpanded ? null : def.key)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable config */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
                          <div className="pt-4">
                            {def.config}
                            <div className="flex justify-end mt-4">
                              <motion.button
                                type="button"
                                disabled={isSaving}
                                onClick={() => saveWorkflow(def.key)}
                                whileHover={{ scale: isSaving ? 1 : 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-60"
                              >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                {isSaving ? "Saving…" : "Save"}
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Danger Zone ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-red-200 overflow-hidden shadow-sm"
        >
          <div className="flex items-center gap-2.5 px-6 py-4 border-b border-red-100 bg-red-50/40">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <h2 className="font-semibold text-red-700 text-sm">Danger Zone</h2>
          </div>

          <div className="p-6">
            <p className="text-slate-600 text-sm mb-4 leading-relaxed">
              Permanently delete your account and all associated data — meetings, transcripts, and AI summaries. This action cannot be undone.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Type <strong className="font-mono text-red-600">DELETE</strong> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 py-3 rounded-xl border border-red-200 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all font-mono"
                />
              </div>

              <motion.button
                onClick={deleteAccount}
                disabled={deleting || deleteConfirm !== "DELETE"}
                whileHover={{ scale: deleting || deleteConfirm !== "DELETE" ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? "Deleting…" : "Delete my account"}
              </motion.button>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

export default function SettingsPageWrapper() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
