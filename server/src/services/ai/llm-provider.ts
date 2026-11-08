/**
 * Contract every AI provider implements. Services depend on this, never on a vendor SDK,
 * so providers can be swapped or chained (see ai.service.ts) without touching business logic.
 */
/** An image sent alongside the prompt (base64, no data: prefix). */
export interface ImageInput {
  mimeType: string;
  base64: string;
}

export interface JsonRequest {
  system: string;
  user: string;
  /** Optional images for vision tasks (e.g. photo proof). */
  images?: ImageInput[];
  /** JSON Schema the provider must follow (generated from a zod schema). */
  jsonSchema: Record<string, unknown>;
  timeoutMs: number;
}

export interface JsonResponse {
  /** Raw model text. Expected to be JSON, but callers must still parse and validate it. */
  text: string;
  /** The model that actually answered (a provider may fall back between its models). */
  model: string;
}

export interface LlmProvider {
  readonly name: string;
  /** Primary model, for logs. */
  readonly model: string;
  /** Providers that can't see images are skipped for requests that include them. */
  readonly supportsImages: boolean;
  /** Answers in ~2–3 s (vs ~6–9 s). Quick, simple asks try fast providers first. */
  readonly fast: boolean;
  generateJson(req: JsonRequest): Promise<JsonResponse>;
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
