import {
  fetchWithTimeout,
  type JsonRequest,
  type JsonResponse,
  type LlmProvider,
  ProviderError,
} from './llm-provider';

/**
 * Groq (OpenAI-compatible API).
 * - Text: strict `json_schema` structured output with the text model.
 * - Images: a separate vision model, which isn't reliable in strict-schema mode, so it uses
 *   JSON mode with the schema written into the prompt (the caller still validates with zod).
 *   The free tier allows only a few image requests per minute, so this is a last resort.
 */
export class GroqProvider implements LlmProvider {
  readonly name = 'groq';
  readonly fast = true;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly visionModel: string | null,
  ) {}

  get supportsImages() {
    return Boolean(this.visionModel);
  }

  async generateJson({
    system,
    user,
    images = [],
    jsonSchema,
    timeoutMs,
  }: JsonRequest): Promise<JsonResponse> {
    const vision = images.length > 0;
    const model = vision ? this.visionModel! : this.model;

    const messages = vision
      ? [
          {
            role: 'system',
            content: `${system}\n\nReturn ONLY a JSON object matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
          },
          {
            role: 'user',
            content: [
              ...images.map((img) => ({
                type: 'image_url',
                image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
              })),
              { type: 'text', text: user },
            ],
          },
        ]
      : [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ];

    const res = await fetchWithTimeout(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: vision ? 0.2 : 0.7,
          response_format: vision
            ? { type: 'json_object' }
            : {
                type: 'json_schema',
                json_schema: { name: 'response', strict: true, schema: jsonSchema },
              },
          messages,
        }),
      },
      timeoutMs,
    );

    const body = (await res.json().catch(() => null)) as GroqResponse | null;
    if (!res.ok) {
      throw new ProviderError(
        `${this.name}/${model}`,
        body?.error?.message ?? 'request failed',
        res.status,
      );
    }

    const text = body?.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError(`${this.name}/${model}`, 'empty response');
    return { text, model };
  }
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}
