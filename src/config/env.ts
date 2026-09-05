import { z } from "zod";

const envSchema = z.object({
  appName: z.string().default("MedKit AI"),
  appVersion: z.string().default("1.0.0"),
  appUrl: z.string().default("http://localhost:3000"),
  isDemoMode: z.boolean().default(true),
  supabaseUrl: z.string().optional().default(""),
  supabaseAnonKey: z.string().optional().default(""),
  supabaseServiceKey: z.string().optional().default(""),
  geminiApiKey: z.string().optional().default(""),
  geminiModel: z.string().default("gemini-2.5-flash"),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function getEnvConfig(): EnvConfig {
  const raw = {
    appName: process.env.NEXT_PUBLIC_APP_NAME,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    isDemoMode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL,
    logLevel: process.env.LOG_LEVEL as any,
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("Configuration warning: using fallback defaults", parsed.error.format());
    return envSchema.parse({});
  }
  return parsed.data;
}

export const env = getEnvConfig();
