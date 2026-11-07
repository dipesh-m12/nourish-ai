import {
  fetchWithTimeout,
  type JsonRequest,
  type LlmProvider,
  ProviderError,
} from './llm-provider';

/** Groq (OpenAI-compatible API). Structured output is enforced with a strict `json_schema`. */
export class GroqProvider implements LlmProvider {
  readonly name = 'groq';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generateJson({ system, user, jsonSchema, timeoutMs }: JsonRequest): Promise<string> {
    const res = await fetchWithTimeout(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.7,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'response', strict: true, schema: jsonSchema },
          },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      },
      timeoutMs,
    );

    const body = (await res.json().catch(() => null)) as GroqResponse | null;
    if (!res.ok)
      throw new ProviderError(this.name, body?.error?.message ?? 'request failed', res.status);

    const text = body?.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError(this.name, 'empty response');
    return text;
  }
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}
