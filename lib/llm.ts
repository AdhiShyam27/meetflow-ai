import { decrypt } from "@/lib/encryption";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LLMConfig {
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionOpts {
  messages: ChatMessage[];
  system?: string;
  maxTokens?: number;
  stream?: boolean;
}

// ── Popular models available on OpenRouter ──────────────────────────────────────

export const POPULAR_MODELS = [
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
] as const;

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";
export const FAST_MODEL = "anthropic/claude-haiku-4-5-20251001";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ── Config resolution ──────────────────────────────────────────────────────────

export function getServerLLMConfig(): LLMConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === "sk-or-your-key-here") return null;
  return { apiKey, model: DEFAULT_MODEL };
}

export async function getUserLLMConfig(userId: string): Promise<{ apiKey?: string; model?: string } | null> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("llm_config")
      .eq("id", userId)
      .single();

    if (!profile?.llm_config) return null;

    const decrypted = decrypt(profile.llm_config, userId);
    return JSON.parse(decrypted) as { apiKey?: string; model?: string };
  } catch {
    return null;
  }
}

export async function resolveLLMConfig(userId?: string | null): Promise<LLMConfig | null> {
  // Try user-specific config first
  if (userId) {
    const userConfig = await getUserLLMConfig(userId);
    if (userConfig?.apiKey) {
      return {
        apiKey: userConfig.apiKey,
        model: userConfig.model || DEFAULT_MODEL,
      };
    }
    // User has a model preference but no key — use server key with their model
    const serverConfig = getServerLLMConfig();
    if (serverConfig && userConfig?.model) {
      return { apiKey: serverConfig.apiKey, model: userConfig.model };
    }
  }

  return getServerLLMConfig();
}

// ── Chat completion (streaming + non-streaming) ────────────────────────────────

export async function chatCompletion(
  config: LLMConfig,
  opts: ChatCompletionOpts & { stream: true }
): Promise<ReadableStream<Uint8Array>>;
export async function chatCompletion(
  config: LLMConfig,
  opts: ChatCompletionOpts & { stream?: false }
): Promise<string>;
export async function chatCompletion(
  config: LLMConfig,
  opts: ChatCompletionOpts
): Promise<ReadableStream<Uint8Array> | string> {
  const messages: ChatMessage[] = [];

  // Prepend system message if provided
  if (opts.system) {
    messages.push({ role: "system", content: opts.system });
  }

  // Add conversation messages
  for (const msg of opts.messages) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const body = {
    model: config.model,
    messages,
    max_tokens: opts.maxTokens ?? 2048,
    stream: opts.stream ?? false,
  };

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "MeetFlow AI",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(`OpenRouter API error (${response.status}): ${errText}`);
  }

  // ── Non-streaming ──
  if (!opts.stream) {
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  // ── Streaming: parse SSE and emit just the text deltas ──
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last potentially incomplete line in buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return readable;
}
