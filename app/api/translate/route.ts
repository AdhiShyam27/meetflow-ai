import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/rate-limiter";

const isDemoMode =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL === "https://your-project.supabase.co";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  // ── Rate limiting: 120 requests / minute per user (2/sec — enough for live speech) ──
  if (userId) {
    const rl = rateLimit(`translate:${userId}`, 120, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      );
    }
  }

  const body = await request.json();
  const text: unknown = body?.text;

  // ── Input validation ──────────────────────────────────────────────────────
  if (typeof text !== "string") {
    return NextResponse.json({ ...FALLBACK, translated: "" });
  }

  // Clamp to 2000 chars — more than enough for a single speech segment
  const safeText = text.slice(0, 2000);

  if (!safeText.trim()) {
    return NextResponse.json({ ...FALLBACK, translated: safeText });
  }

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
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
    });

    const response = (message.content[0] as { type: string; text: string }).text.trim();

    if (response.startsWith("ENGLISH:")) {
      return NextResponse.json({
        translated: response.slice("ENGLISH:".length).trim(),
        wasTranslated: false,
        detectedLanguage: "English",
        languageCode: "en-US",
      });
    }

    if (response.startsWith("TRANSLATED:")) {
      // Format: TRANSLATED:Spanish:es-ES: <translated text>
      const rest = response.slice("TRANSLATED:".length);
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
