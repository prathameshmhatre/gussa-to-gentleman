import { fetchWithTimeout, Provider, ProviderError } from './types';

// Groq uses the OpenAI-compatible "chat completions" format.
// The same code works for OpenAI, Mistral, Together, etc. by changing the URL + model.
// Docs: https://console.groq.com/docs/api-reference
export function groqProvider(apiKey: string, model: string): Provider {
  return {
    name: 'groq',
    async complete(systemPrompt, userText) {
      const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText },
          ],
          temperature: 0.7,
          // Reasoning models (gpt-oss) spend tokens "thinking" before answering,
          // so leave room and keep thinking short for a fast reply.
          max_completion_tokens: 1200,
          ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
          // JSON mode: asks the model to return a valid JSON object.
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) throw new ProviderError('groq', res.status, (await res.text()).slice(0, 300));

      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new ProviderError('groq', 502, 'Empty response');
      return text;
    },
  };
}
