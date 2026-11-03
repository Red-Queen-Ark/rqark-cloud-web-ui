import { dismissBootSplash } from '@/utils/bootSplash';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function splash(doc: Document = document): HTMLElement | null {
  return doc.getElementById('boot-splash');
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
    const element = document.createElement('div');
    element.id = 'boot-splash';
    document.body.append(element);

    dismissBootSplash({ shownAt: 0 });

    vi.advanceTimersByTime(2000);
    expect(splash()).toBeNull();
  });

  it('keeps the mark on screen for a moment before fading it out', () => {
    const element = document.createElement('div');
    element.id = 'boot-splash';
    document.body.append(element);

    dismissBootSplash({ shownAt: Date.now() });

    // A splash that vanishes in the same frame it appears is a flash, not a
    // launch screen.
    expect(splash()).not.toBeNull();
    expect(element.classList.contains('is-going')).toBe(false);

    vi.advanceTimersByTime(700);
    expect(element.classList.contains('is-going')).toBe(true);

    vi.advanceTimersByTime(400);
    expect(splash()).toBeNull();
  });

  it('is a no-op once it has already gone', () => {
    expect(() => dismissBootSplash()).not.toThrow();
  });
});
