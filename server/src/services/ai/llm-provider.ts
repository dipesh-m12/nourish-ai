/**
 * Contract every AI provider implements. Services depend on this, never on a vendor SDK,
 * so providers can be swapped or chained (see ai.service.ts) without touching business logic.
 */
export interface JsonRequest {
  system: string;
  user: string;
  /** JSON Schema the provider must follow (generated from a zod schema). */
  jsonSchema: Record<string, unknown>;
  timeoutMs: number;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  /** Raw model text. Expected to be JSON, but callers must still parse and validate it. */
  generateJson(req: JsonRequest): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${provider}: ${message}`);
  }
}

/** fetch with a hard timeout, so a slow provider can't stall the request. */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
