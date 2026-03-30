import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

loadDotEnv();

const envSchema = z.object({
  GOOGLE_PLACES_API_KEY: z
    .string()
    .trim()
    .min(1, "GOOGLE_PLACES_API_KEY is required"),
  PORT: z.coerce.number().int().positive().default(8787),
  BROAD_SEARCH_CACHE_TTL_MS: z.coerce.number().int().positive().default(5 * 60 * 1000),
  PLACE_DETAILS_CACHE_TTL_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000)
});

export type AppConfig = z.infer<typeof envSchema>;

export function getConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
  }

  return parsed.data;
}
