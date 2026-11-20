import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type Tone = 'polite' | 'british' | 'firm';

/** Must match PoliteResult in worker/src/prompt.ts (the API contract). */
export interface PoliteResult {
  meaning: string;
  idiom: string;
  idiomMeaning: string;
  reply: string;
  rageLevel: number;
  rageLabel: string;
  provider: string; // 'groq' | 'gemini' | 'offline'
}

/**
 * Talks to OUR Worker (/api/translate), never to Groq/Gemini directly.
 * The browser never sees an API key.
 */
@Injectable({ providedIn: 'root' })
export class TranslateService {
  private http = inject(HttpClient);

  async translate(text: string, tone: Tone): Promise<PoliteResult> {
    try {
      return await firstValueFrom(this.http.post<PoliteResult>('/api/translate', { text, tone }));
    } catch (err) {
      // Turn HTTP errors into a friendly message from the Worker, if it sent one.
      if (err instanceof HttpErrorResponse) {
        const base = typeof err.error?.error === 'string' ? err.error.error : null;
        const failed = Array.isArray(err.error?.failed) ? ` (${err.error.failed.join(', ')})` : '';
        const message = base ? base + failed : null;
        throw new TranslateError(err.status, message ?? 'Could not reach the server. Check your connection.');
      }
      throw err;
    }
  }
}

export class TranslateError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
