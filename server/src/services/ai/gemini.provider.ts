import {
  fetchWithTimeout,
  type JsonRequest,
  type LlmProvider,
  ProviderError,
} from './llm-provider';

/** Google Gemini via the REST API. Structured output is enforced with `responseJsonSchema`. */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generateJson({ system, user, jsonSchema, timeoutMs }: JsonRequest): Promise<string> {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': this.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            temperature: 0.7,
            // Low thinking: ~6s instead of ~10s, with no visible quality drop for this task.
            thinkingConfig: { thinkingLevel: 'low' },
          },
        }),
      },
      timeoutMs,
    );

    const body = (await res.json().catch(() => null)) as GeminiResponse | null;
    if (!res.ok)
      throw new ProviderError(this.name, body?.error?.message ?? 'request failed', res.status);

    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
    if (!text) throw new ProviderError(this.name, 'empty response');
    return text;
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}
