import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { getAIProvider } from "@/features/ai/ai-provider";
import { getSpeechProvider } from "@/features/voice/speech-provider";
import { getOCRProvider } from "@/features/documents/ocr-provider";

export async function GET() {
  const isKeyAvailable = Boolean(env.geminiApiKey && env.geminiApiKey.trim().length > 5 && env.geminiApiKey !== "your-gemini-api-key");
  const aiProvider = getAIProvider();
  const speechProvider = getSpeechProvider();
  const ocrProvider = getOCRProvider();

  const isLive = isKeyAvailable && (!env.isDemoMode || env.preferLiveProviders);

  return NextResponse.json({
    mode: isLive ? "live" : "demo",
    displayLabel: isLive ? "Live Intelligence" : "Demo Mode",
    ai: {
      provider: aiProvider.name,
      model: isLive ? env.geminiModel : "deterministic-rules",
      isLive,
      status: "ready",
    },
    speech: {
      provider: speechProvider.name,
      isLive,
      status: "ready",
    },
    ocr: {
      provider: ocrProvider.name,
      isLive,
      status: "ready",
    },
    database: {
      type: env.isDemoMode ? "mock-adapter" : "supabase",
      isDemoMode: env.isDemoMode,
      status: "ready",
    },
  });
}
