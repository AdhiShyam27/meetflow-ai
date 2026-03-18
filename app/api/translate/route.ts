import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limiter";
import { chatCompletion, resolveLLMConfig, FAST_MODEL } from "@/lib/llm";

const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://your-project.supabase.co";

// BCP-47 codes so the recording page can switch speech recognition language
const LANG_TO_CODE: Record<string, string> = {
  Spanish: "es-ES", French: "fr-FR", German: "de-DE",
  Hindi: "hi-IN", Mandarin: "zh-CN", Chinese: "zh-CN",
  Japanese: "ja-JP", Portuguese: "pt-BR", Arabic: "ar-SA",
  Russian: "ru-RU", Italian: "it-IT", Korean: "ko-KR",
  Dutch: "nl-NL", Turkish: "tr-TR", Polish: "pl-PL",
  Swedish: "sv-SE", Danish: "da-DK", Finnish: "fi-FI",
  Hebrew: "he-IL", Thai: "th-TH", Vietnamese: "vi-VN",
  Indonesian: "id-ID", Malay: "ms-MY", Tamil: "ta-IN",
  Telugu: "te-IN", Bengali: "bn-BD", Urdu: "ur-PK",
  Swahili: "sw-KE", Greek: "el-GR", Czech: "cs-CZ",
  Romanian: "ro-RO", Hungarian: "hu-HU", Ukrainian: "uk-UA",
};

const FALLBACK = { translated: "", wasTranslated: false, detectedLanguage: "English", languageCode: "en-US" };

export async function POST(request: NextRequest) {
  // ── Authentication ────────────────────────────────────────────────────────
  let userId: string | null = null;

  if (!isDemoMode) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  // Rate limit by user ID (more reliable than IP)
  const rateLimitKey = userId
    ? `translate:${userId}`
    : `translate:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;

  const rl = rateLimit(rateLimitKey, 120, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ...FALLBACK, translated: "" });
  }

  const text: unknown = body?.text;

  if (typeof text !== "string") {
    return NextResponse.json({ ...FALLBACK, translated: "" });
  }

  const safeText = text.slice(0, 2000);

  if (!safeText.trim()) {
    return NextResponse.json({ ...FALLBACK, translated: safeText });
  }

  const config = await resolveLLMConfig(userId);
  if (!config) {
    return NextResponse.json({ ...FALLBACK, translated: safeText });
  }

  try {
    const translateConfig = { ...config, model: FAST_MODEL };

    const response = await chatCompletion(translateConfig, {
      messages: [
        {
          role: "user",
          content: `Detect the language of the following text and respond in exactly one of these two formats:

If already in English:
ENGLISH: <original text unchanged>

If in any other language:
TRANSLATED:<LanguageName>:<BCP47Code>: <accurate English translation>

Where <LanguageName> is the full English name (e.g. Spanish, Hindi, French) and <BCP47Code> is the BCP-47 code (e.g. es-ES, hi-IN, fr-FR). No explanation, just the formatted response.

Text: ${safeText}`,
        },
      ],
      maxTokens: 512,
      stream: false,
    });

    const trimmed = response.trim();

    if (trimmed.startsWith("ENGLISH:")) {
      return NextResponse.json({
        translated: trimmed.slice("ENGLISH:".length).trim(),
        wasTranslated: false,
        detectedLanguage: "English",
        languageCode: "en-US",
      });
    }

    if (trimmed.startsWith("TRANSLATED:")) {
      const rest = trimmed.slice("TRANSLATED:".length);
      const firstColon = rest.indexOf(":");
      const secondColon = rest.indexOf(":", firstColon + 1);
      if (firstColon !== -1 && secondColon !== -1) {
        const langName = rest.slice(0, firstColon).trim();
        const langCode = rest.slice(firstColon + 1, secondColon).trim();
        const translated = rest.slice(secondColon + 1).trim();
        return NextResponse.json({
          translated,
          wasTranslated: true,
          detectedLanguage: langName,
          languageCode: LANG_TO_CODE[langName] ?? langCode,
        });
      }
    }

    return NextResponse.json({ ...FALLBACK, translated: safeText });
  } catch {
    return NextResponse.json({ ...FALLBACK, translated: safeText });
  }
}
