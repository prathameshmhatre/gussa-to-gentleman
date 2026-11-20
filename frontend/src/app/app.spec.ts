import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { offlineTranslate } from './phrasebook';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Gentleman');
  });
});

describe('offlineTranslate', () => {
  it('matches a requirement-change rant to "Moving the goalposts"', () => {
    const r = offlineTranslate('client har din requirement badal deta hai', 'polite');
    expect(r.idiom).toBe('Moving the goalposts');
    expect(r.provider).toBe('offline');
  });

  it('falls back to a default idiom', () => {
    expect(offlineTranslate('namaste', 'firm').idiom).toBe('Keep calm and carry on');
  });
});
