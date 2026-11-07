import { z } from 'zod';
import { env } from '../../config/env';
import { GeminiProvider } from './gemini.provider';
import { GroqProvider } from './groq.provider';
import type { LlmProvider } from './llm-provider';

const TIMEOUT_MS = 15_000;

/** Providers in priority order. Only those with a key configured are used. */
const providers: LlmProvider[] = [];
if (env.GEMINI_API_KEY) providers.push(new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL));
if (env.GROQ_API_KEY) providers.push(new GroqProvider(env.GROQ_API_KEY, env.GROQ_MODEL));

/**
 * Models sometimes wrap JSON in ```json fences or add a stray sentence, even in JSON mode.
 * Take the outermost {...} so one formatting slip doesn't fail the whole request.
 */
export function extractJson(text: string): unknown {
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('No JSON object in model output');
    return JSON.parse(unfenced.slice(start, end + 1));
  }
}

/** zod → JSON Schema for the providers (they reject the `$schema` meta key). */
function toProviderSchema(schema: z.ZodType) {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, { target: 'draft-7' });
  return jsonSchema;
}

export interface StructuredResult<T> {
  data: T;
  provider: string;
  model: string;
}

/**
 * Ask for structured JSON and get back validated, typed data. Tries each provider in turn:
 * a timeout, rate limit, outage or invalid output just moves on to the next one.
 * `check` adds rules a schema can't express (e.g. "meals add up to the target"); it returns
 * a reason to reject, or null. Throws only if every provider failed, so the caller picks a fallback.
 */
export async function generateStructured<S extends z.ZodType>(
  schema: S,
  prompt: { system: string; user: string },
  check?: (data: z.output<S>) => string | null,
): Promise<StructuredResult<z.output<S>>> {
  const jsonSchema = toProviderSchema(schema);
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const text = await provider.generateJson({ ...prompt, jsonSchema, timeoutMs: TIMEOUT_MS });
      const parsed = schema.safeParse(extractJson(text));
      if (!parsed.success) {
        failures.push(`${provider.name}: invalid shape (${parsed.error.issues[0]?.message})`);
        continue;
      }
      const problem = check?.(parsed.data);
      if (problem) {
        failures.push(`${provider.name}: ${problem}`);
        continue;
      }
      if (failures.length)
        console.warn('[ai] fell back to', provider.name, '←', failures.join(' | '));
      return { data: parsed.data, provider: provider.name, model: provider.model };
    } catch (err) {
      failures.push(err instanceof Error ? err.message : `${provider.name}: unknown error`);
    }
  }

  throw new Error(
    providers.length
      ? `All AI providers failed → ${failures.join(' | ')}`
      : 'No AI provider configured',
  );
}
