import { Component, computed, inject, signal } from '@angular/core';
import { EXAMPLE_RANTS, offlineTranslate } from './phrasebook';
import { PoliteResult, Tone, TranslateError, TranslateService } from './translate.service';

interface HistoryItem {
  rant: string;
  result: PoliteResult;
}

const HISTORY_KEY = 'g2g-history';
const MAX_CHARS = 500; // keep in sync with MAX_INPUT_CHARS in worker/wrangler.jsonc

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private api = inject(TranslateService);

  readonly maxChars = MAX_CHARS;
  readonly examples = EXAMPLE_RANTS;
  readonly tones: { id: Tone; label: string; hint: string }[] = [
    { id: 'polite', label: 'Polite', hint: 'Warm and professional' },
    { id: 'british', label: 'Very British', hint: 'Polite, with a sting' },
    { id: 'firm', label: 'Firm', hint: 'Friendly pushback' },
  ];

  // State as signals: the template updates automatically when these change.
  readonly rant = signal('');
  readonly tone = signal<Tone>('british');
  readonly loading = signal(false);
  readonly result = signal<PoliteResult | null>(null);
  readonly notice = signal<string | null>(null);
  readonly copied = signal(false);
  readonly history = signal<HistoryItem[]>(loadHistory());

  readonly charsLeft = computed(() => MAX_CHARS - this.rant().length);
  readonly canSubmit = computed(() => this.rant().trim().length > 0 && this.charsLeft() >= 0 && !this.loading());
  readonly cups = [1, 2, 3, 4, 5];

  onInput(event: Event) {
    this.rant.set((event.target as HTMLTextAreaElement).value);
  }

  useExample(text: string) {
    this.rant.set(text);
  }

  async translate() {
    if (!this.canSubmit()) return;
    const text = this.rant().trim();
    this.loading.set(true);
    this.notice.set(null);
    this.copied.set(false);

    try {
      this.show(text, await this.api.translate(text, this.tone()));
    } catch (err) {
      // API failed (offline, quota used up, server down): fall back to the built-in phrasebook.
      const reason = err instanceof TranslateError ? err.message : 'Something went wrong.';
      this.notice.set(`${reason} Showing an offline idiom instead.`);
      this.show(text, offlineTranslate(text, this.tone()));
    } finally {
      this.loading.set(false);
    }
  }

  async copyReply() {
    const reply = this.result()?.reply;
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.notice.set('Copy was blocked by the browser. Select the text and copy it manually.');
    }
  }

  restore(item: HistoryItem) {
    this.rant.set(item.rant);
    this.result.set(item.result);
    this.notice.set(null);
  }

  clearHistory() {
    this.history.set([]);
    saveHistory([]);
  }

  private show(rant: string, result: PoliteResult) {
    this.result.set(result);
    const next = [{ rant, result }, ...this.history().filter((h) => h.rant !== rant)].slice(0, 5);
    this.history.set(next);
    saveHistory(next);
  }
}

// History stays in this browser only (localStorage). Nothing is stored on the server.
function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* storage blocked: history just won't persist */
  }
}
