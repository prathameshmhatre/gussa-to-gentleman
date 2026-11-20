// ---------------------------------------------------------------------------
// Gussa to Gentleman: API Worker
//
// Browser ──POST /api/translate──▶ this Worker ──▶ Groq (or Gemini if Groq fails)
//
// Why a Worker in the middle?
//  • API keys live here as secrets. Anything in Angular code is public.
//  • We validate input, rate-limit per visitor, and validate the AI's output.
//  • We can switch providers without touching the frontend.
// ---------------------------------------------------------------------------

import { buildSystemPrompt, parseResult, PoliteResult, Tone, TONES } from './prompt';
import { geminiProvider } from './providers/gemini';
import { groqProvider } from './providers/groq';
import { Provider, ProviderError } from './providers/types';

// Secrets are added with `wrangler secret put`, so they aren't in wrangler.jsonc
// and `wrangler types` doesn't know about them. Declare them here.
interface AppEnv extends Env {
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

interface TranslateRequest {
  text?: unknown;
  tone?: unknown;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, providers: buildProviders(env).map((p) => p.name) });
    }

    if (url.pathname === '/api/translate') {
      if (request.method !== 'POST') return error(405, 'Use POST.');
      return handleTranslate(request, env);
    }

    return error(404, 'Not found.');
  },
} satisfies ExportedHandler<AppEnv>;

async function handleTranslate(request: Request, env: AppEnv): Promise<Response> {
  // 1. Rate limit: one visitor can't burn the whole team's free quota.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  if (!success) return error(429, 'Easy, tiger. Too many rants in a minute. Have a cuppa and try again shortly.');

  // 2. Validate input. Never trust the browser.
  let body: TranslateRequest;
  try {
    body = await request.json();
  } catch {
    return error(400, 'Body must be JSON: { "text": "...", "tone": "polite" }');
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const maxChars = Number(env.MAX_INPUT_CHARS) || 500;
  if (!text) return error(400, 'Please type your rant first.');
  if (text.length > maxChars) return error(400, `Keep it under ${maxChars} characters, please.`);

  const tone: Tone = typeof body.tone === 'string' && body.tone in TONES ? (body.tone as Tone) : 'polite';

  // 3. Call providers in order; fall back to the next one on any failure.
  const providers = buildProviders(env);
  if (providers.length === 0) return error(500, 'Server has no API key configured. See README step 3.');

  const systemPrompt = buildSystemPrompt(tone);
  const failures: string[] = [];

  for (const provider of providers) {
    try {
      const raw = await provider.complete(systemPrompt, text);
      const result: PoliteResult = parseResult(raw); // 4. Validate the AI's output too.
      return json({ ...result, provider: provider.name });
    } catch (err) {
      // Logged to Cloudflare dashboard (Workers > your worker > Logs). User text is not logged.
      const reason = err instanceof ProviderError ? `${err.status} ${err.message}` : String(err);
      console.warn(`Provider ${provider.name} failed: ${reason}`);
      // Status code only (no provider message) is safe to show and enough to debug.
      failures.push(err instanceof ProviderError ? `${provider.name} ${err.status}` : `${provider.name} bad-output`);
    }
  }

  return error(503, 'All our butlers are busy right now. Try again in a minute, or use an offline idiom.', {
    failed: failures,
  });
}

function buildProviders(env: AppEnv): Provider[] {
  const list: Provider[] = [];
  // trim(): a key pasted with a trailing space or newline causes a 401.
  const groqKey = env.GROQ_API_KEY?.trim();
  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (groqKey) list.push(groqProvider(groqKey, env.GROQ_MODEL));
  if (geminiKey) list.push(geminiProvider(geminiKey, env.GEMINI_MODEL));
  return list;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function error(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ error: message, ...extra }, status);
}
