import { fetchWithTimeout, Provider, ProviderError } from './types';

// Google Gemini uses its own "generateContent" format (different from OpenAI's).
// Seeing both side by side shows why the Provider interface is useful.
// Docs: https://ai.google.dev/gemini-api/docs/text-generation
// Note: newer Gemini models reject temperature/top_p, so we don't send them.
export function geminiProvider(apiKey: string, model: string): Provider {
  return {
    name: 'gemini',
    async complete(systemPrompt, userText) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey, // key in a header, not in the URL
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 600,
          },
        }),
      });

      if (!res.ok) throw new ProviderError('gemini', res.status, (await res.text()).slice(0, 300));

      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
      if (!text) throw new ProviderError('gemini', 502, 'Empty response');
      return text;
    },
  };
}
