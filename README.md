# Gussa to Gentleman

Type an office rant in Hindi or Hinglish and get back:
- **What you really meant**, in clean English
- **A British idiom** that fits, with its meaning
- **A polite reply** ready to paste into email or Teams (Polite / Very British / Firm)
- **A rage meter** made of five teacups

Built with **Angular** for the frontend and a **Cloudflare Worker** for the API. It uses the free tiers of **Groq**, with **Google Gemini** as a backup.

---

## How it fits together

```
Browser (Angular)
   │  POST /api/translate  { text, tone }
   ▼
Cloudflare Worker  (worker/src/index.ts)
   │  1. rate-limit per IP (10/min)
   │  2. validate input (≤ 500 chars)
   │  3. build prompt  (worker/src/prompt.ts)
   │  4. call Groq → if it fails, call Gemini
   │  5. validate the AI's JSON before returning it
   ▼
{ meaning, idiom, idiomMeaning, reply, rageLevel, rageLabel, provider }
```

If every provider fails, the Angular app falls back to the **offline phrasebook**
(`frontend/src/app/phrasebook.ts`), so the page always gives an answer.

The same Worker also serves the built Angular files, so you deploy **one thing**
with **one URL** and don't need any CORS setup.

### Rule #1 of API projects
**API keys never go in Angular code.** Everything shipped to the browser is public.
The keys live only in the Worker as encrypted secrets.

---

## Project layout

```
frontend/                      Angular 22 app (standalone, signals, zoneless)
  src/app/app.ts|html          UI + state (signals)
  src/app/translate.service.ts Calls /api/translate (never the AI directly)
  src/app/phrasebook.ts        Offline fallback + example rants
  proxy.conf.json              In dev, sends /api to the local Worker
worker/                        Cloudflare Worker (TypeScript)
  src/index.ts                 Routing, rate limit, validation, fallback
  src/prompt.ts                System prompt + output validation
  src/providers/groq.ts        OpenAI-compatible format
  src/providers/gemini.ts      Google generateContent format
  src/providers/types.ts       Common Provider interface
  wrangler.jsonc               Config: assets, rate limiter, model IDs
```

---

## Setup

### 1. Get free API keys (you need at least one)
- **Groq:** https://console.groq.com/keys (no card needed)
- **Gemini (backup):** https://aistudio.google.com/apikey
  Note: on Gemini's free tier, Google may use your inputs to improve its products. Groq doesn't.

### 2. Install
```bash
cd frontend && npm install
cd ../worker && npm install
```

### 3. Run locally
```bash
# Terminal 1: the API
cd worker
cp .dev.vars.example .dev.vars    # paste your keys into .dev.vars
npm run dev                       # http://localhost:8787

# Terminal 2: the Angular app with hot reload
cd frontend
npm start                         # http://localhost:4200  (/api is proxied to 8787)
```
Check which providers are active: http://localhost:8787/api/health

### 4. Deploy to Cloudflare (free)
```bash
cd frontend && npm run build              # outputs dist/frontend/browser
cd ../worker
npx wrangler login                        # opens browser, free account is fine
npx wrangler secret put GROQ_API_KEY      # paste key when asked
npx wrangler secret put GEMINI_API_KEY    # optional backup
npm run deploy
```
You get a URL like `https://gussa-to-gentleman.<your-subdomain>.workers.dev`. Share it with the team.
To use your own domain, go to the Cloudflare dashboard: Workers → your worker → Settings → Domains & Routes.

---

## Changing things

| I want to… | Edit |
|---|---|
| Change the AI model (when one is retired) | `vars` in `worker/wrangler.jsonc`, then run `npm run types` |
| Change how the AI writes | `worker/src/prompt.ts` |
| Allow more or fewer requests per person | `ratelimits` in `worker/wrangler.jsonc` |
| Add offline idioms | `ENTRIES` in `frontend/src/app/phrasebook.ts` |
| Add a new provider (OpenAI, Mistral, Workers AI…) | New file in `worker/src/providers/`, add it in `buildProviders()` |
| Rename the app | `<title>` in `frontend/src/index.html`, `<h1>` in `app.html`, `name` in `wrangler.jsonc` |

## Learning exercises
1. **Streaming:** stream the reply word by word using `stream: true` on Groq, plus `ReadableStream` in the Worker.
2. **Caching:** store answers for identical rants in Cloudflare KV to save quota.
3. **"Idiom of the day":** a `GET /api/idiom` endpoint plus a Cron Trigger.
4. **Unit tests for `parseResult`:** feed it broken JSON and check the errors it throws.
5. **Feedback:** 👍/👎 buttons that log which idioms people liked.

## Free-tier limits (check your own dashboards)
- Groq: rate limits per organisation. You'll get a `429` when you hit one, never a bill.
- Gemini: limits per project, resetting at midnight Pacific time.
- Cloudflare Workers free plan: plenty of requests per day for a team tool.

## Privacy
- Rants are sent to Groq or Gemini to be translated. Don't paste client names or confidential data.
- The Worker never logs the rant text. Recent history is kept only in each user's own browser.
