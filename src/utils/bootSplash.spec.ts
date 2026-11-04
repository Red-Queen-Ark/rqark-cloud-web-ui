import { dismissBootSplash } from '@/utils/bootSplash';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function splash(doc: Document = document): HTMLElement | null {
  return doc.getElementById('boot-splash');
}

function paintSplash(): HTMLElement {
  const element = document.createElement('div');
  element.id = 'boot-splash';
  document.body.append(element);
  return element;
}

describe('dismissBootSplash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    splash()?.remove();
  });

  it('removes the splash that index.html paints', () => {
    paintSplash();

    dismissBootSplash({ shownAt: performance.now() - 2000 });

    vi.advanceTimersByTime(2000);
    expect(splash()).toBeNull();
  });

  it('keeps the mark on screen for a moment before fading it out', () => {
    const element = paintSplash();

    // `main.ts` reads the paint time off `performance.now()`, so this is the
    // clock the splash has to be measured against.
    dismissBootSplash({ shownAt: performance.now() });

    // A splash that vanishes in the same frame it appears is a flash, not a
    // launch screen.
    expect(splash()).not.toBeNull();
    expect(element.classList.contains('is-going')).toBe(false);

    vi.advanceTimersByTime(700);
    expect(element.classList.contains('is-going')).toBe(true);

    vi.advanceTimersByTime(400);
    expect(splash()).toBeNull();
  });

  it('does not compare a performance timestamp against the wall clock', () => {
    const element = paintSplash();

    // The bug this pins: `Date.now() - performance.now()` is ~1.7e12, so the
    // minimum-visible window collapsed to zero and the splash vanished at once.
    dismissBootSplash({ shownAt: performance.now() });
    vi.advanceTimersByTime(100);

    expect(element.classList.contains('is-going'), 'gone after 100ms').toBe(false);

    // Waiting long enough is what dismisses it, not the clock mismatch.
    vi.advanceTimersByTime(600);
    expect(element.classList.contains('is-going')).toBe(true);
  });

  it('waits the minimum window when no paint time is given', () => {
    const element = paintSplash();

    dismissBootSplash({});

    expect(element.classList.contains('is-going')).toBe(false);
    vi.advanceTimersByTime(700);
    expect(element.classList.contains('is-going')).toBe(true);
  });

  it('is a no-op once it has already gone', () => {
    expect(() => dismissBootSplash()).not.toThrow();
  });
});
