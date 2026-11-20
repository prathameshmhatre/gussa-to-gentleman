// A common interface over different AI providers.
// index.ts only knows about `Provider`, so swapping or adding one (OpenAI, Mistral,
// Cloudflare Workers AI...) means writing one new file, nothing else changes.

export interface Provider {
  name: string;
  /** Returns the model's raw text answer. Throws ProviderError on failure. */
  complete(systemPrompt: string, userText: string): Promise<string>;
}

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number,
    message: string,
  ) {
    super(`${provider} failed (${status}): ${message}`);
  }
}

/** fetch with a timeout, so a slow provider doesn't hang the request forever. */
export async function fetchWithTimeout(url: string, init: RequestInit, ms = 15000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}
