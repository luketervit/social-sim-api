import { z } from "zod";

const baseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const openRouterEnvSchema = baseEnvSchema.extend({
  OPENROUTER_API_KEY: z.string().min(1),
});

const deepSeekEnvSchema = baseEnvSchema.extend({
  DEEPSEEK_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof baseEnvSchema>;
export type OpenRouterEnv = z.infer<typeof openRouterEnvSchema>;
export type DeepSeekEnv = z.infer<typeof deepSeekEnvSchema>;

let _env: Env | null = null;
let _openRouterEnv: OpenRouterEnv | null = null;
let _deepSeekEnv: DeepSeekEnv | null = null;

export function getEnv(): Env {
  if (_env) return _env;
  const parsed = baseEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Missing or invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Missing required environment variables");
  }
  _env = parsed.data;
  return _env;
}

export function getOpenRouterEnv(): OpenRouterEnv {
  if (_openRouterEnv) return _openRouterEnv;
  const parsed = openRouterEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Missing or invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Missing required environment variables");
  }
  _openRouterEnv = parsed.data;
  return _openRouterEnv;
}

export function getDeepSeekEnv(): DeepSeekEnv {
  if (_deepSeekEnv) return _deepSeekEnv;
  const parsed = deepSeekEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Missing or invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Missing required environment variables");
  }
  _deepSeekEnv = parsed.data;
  return _deepSeekEnv;
}
