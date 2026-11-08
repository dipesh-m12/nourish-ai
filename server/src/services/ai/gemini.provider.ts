import {
  fetchWithTimeout,
  type JsonRequest,
  type JsonResponse,
  type LlmProvider,
  ProviderError,
} from './llm-provider';

/** Auth problems won't be fixed by another model; anything else (overload, limits, 5xx) might. */
const isWorthTryingNextModel = (status: number) => status !== 401 && status !== 403;

/**
 * Google Gemini via the REST API. Structured output is enforced with `responseJsonSchema`.
 * Tries `models` in order: a busy model ("high demand", 503/429) falls through to the next,
 * which on the same key usually has separate capacity (e.g. Flash → Flash-Lite).
 */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  readonly supportsImages = true;
  readonly fast = false;

  constructor(
    private readonly apiKey: string,
    private readonly models: string[],
  ) {}

  get model() {
    return this.models[0]!;
  }

  async generateJson(req: JsonRequest): Promise<JsonResponse> {
    let lastError: ProviderError | undefined;
    for (const model of this.models) {
      try {
        return { text: await this.call(model, req), model };
      } catch (err) {
        if (!(err instanceof ProviderError)) throw err;
        lastError = err;
        if (err.status !== undefined && !isWorthTryingNextModel(err.status)) throw err;
      }
    }
    throw lastError ?? new ProviderError(this.name, 'no models configured');
  }

  private async call(
    model: string,
    { system, user, images = [], jsonSchema, timeoutMs }: JsonRequest,
  ): Promise<string> {
    // Images go in as inline parts before the text, so the prompt can refer to "the photo".
    const parts = [
      ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
      { text: user },
    ];
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': this.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            temperature: 0.7,
            // Low thinking: ~6s instead of ~10s, with no visible quality drop for these tasks.
            thinkingConfig: { thinkingLevel: 'low' },
          },
        }),
      },
      timeoutMs,
    );

    const body = (await res.json().catch(() => null)) as GeminiResponse | null;
    if (!res.ok) {
      throw new ProviderError(
        `${this.name}/${model}`,
        body?.error?.message ?? 'request failed',
        res.status,
      );
    }

    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
    if (!text) throw new ProviderError(`${this.name}/${model}`, 'empty response', 502);
    return text;
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}
