import { z } from "zod";

export class ConfigurationError extends Error {
  public details: z.ZodFormattedError<any>;
  constructor(message: string, details: z.ZodFormattedError<any>) {
    super(message);
    this.name = "ConfigurationError";
    this.details = details;
  }
}

export const envSchema = z.object({
  appName: z.string().default("MedKit AI"),
  appVersion: z.string().default("1.0.0"),
  appUrl: z.string().default("http://localhost:3000"),
  isDemoMode: z.boolean(),
  supabaseUrl: z.string().optional().default(""),
  supabaseAnonKey: z.string().optional().default(""),
  supabaseServiceKey: z.string().optional().default(""),
  geminiApiKey: z.string().optional().default(""),
  geminiModel: z.string().default("gemini-2.5-flash"),
  preferLiveProviders: z.boolean().default(false),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function getEnvConfig(envOverrides?: Record<string, string | undefined>): EnvConfig {
  const envSource = envOverrides || process.env;
  const raw = {
    appName: envSource.NEXT_PUBLIC_APP_NAME,
    appVersion: envSource.NEXT_PUBLIC_APP_VERSION,
    appUrl: envSource.NEXT_PUBLIC_APP_URL,
    isDemoMode: envSource.NEXT_PUBLIC_DEMO_MODE === "true",
    supabaseUrl: envSource.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: envSource.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceKey: envSource.SUPABASE_SERVICE_ROLE_KEY,
    geminiApiKey: envSource.GEMINI_API_KEY,
    geminiModel: envSource.GEMINI_MODEL,
    preferLiveProviders: envSource.PREFER_LIVE_PROVIDERS === "true",
    logLevel: envSource.LOG_LEVEL as any,
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigurationError(
      `Invalid environment configuration: ${JSON.stringify(parsed.error.format())}`,
      parsed.error.format()
    );
  }
  return parsed.data;
}

export const env = getEnvConfig();
