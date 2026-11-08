import 'dotenv/config';
import { z } from 'zod';

// Validate env once at startup so the server fails fast with a clear message.
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('30d'),
  // AI: both optional. With no keys, plans fall back to a built-in template.
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  // Tried in order when the main model is overloaded or rate-limited (same key, separate capacity).
  GEMINI_FALLBACK_MODELS: z
    .string()
    .default('gemini-3.5-flash-lite')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  // S3-compatible object storage (Neon). Private bucket; files are read through signed URLs only.
  AWS_ENDPOINT_URL_S3: z.url(),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_REGION: z.string().default('us-east-2'),
  S3_BUCKET: z.string().min(3),
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  // Groq model that can read images; last resort for photo proof (low free-tier limits).
  GROQ_VISION_MODEL: z.string().default('qwen/qwen3.8-27b'),
  /** Optional. Kept server-side only; see services/exercises. */
  MUSCLEWIKI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
