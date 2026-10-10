import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeStore } from './themeStore';

let systemDark = false;
let listeners: ((event: MediaQueryListEvent) => void)[] = [];

/** Replaces the stub from test-setup with one whose `matches` can be flipped. */
function stubSystemPreference(dark: boolean) {
  systemDark = dark;
  listeners = [];
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: systemDark,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.push(listener);
    },
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

/** Pretends the OS switched its appearance, as the browser would report it. */
function flipSystemPreference(dark: boolean) {
  systemDark = dark;
  for (const listener of listeners) {
    listener({ matches: dark } as MediaQueryListEvent);
  }
}

beforeEach(() => {
  setActivePinia(createPinia());
  stubSystemPreference(false);
});

describe('themeStore', () => {
  it('defaults to the base family in system mode', () => {
    const store = useThemeStore();

    expect(store.family).toBe('base');
    expect(store.mode).toBe('system');
  });

  it('builds the theme from the family and an explicit mode', () => {
    const store = useThemeStore();

    store.setFamily('redqueen');
    store.setMode('dark');

    expect(store.theme).toBe('redqueen-dark');
    expect(document.documentElement.dataset.theme).toBe('redqueen-dark');
  });

  it('resolves system mode from the device preference', () => {
    stubSystemPreference(true);
    const store = useThemeStore();

    store.setMode('system');

    expect(store.resolvedMode).toBe('dark');
    expect(store.theme).toBe('base-dark');
  });

  it('repaints when the device flips while system mode is on', () => {
    const store = useThemeStore();
    store.setMode('system');
    store.init();

    expect(document.documentElement.dataset.theme).toBe('base-light');

    flipSystemPreference(true);
    expect(store.theme).toBe('base-dark');
    expect(document.documentElement.dataset.theme).toBe('base-dark');

    flipSystemPreference(false);
    expect(document.documentElement.dataset.theme).toBe('base-light');
  });

  it('leaves an explicit mode alone when the device flips', () => {
    const store = useThemeStore();
    store.setMode('light');
    store.init();

    flipSystemPreference(true);

    expect(store.theme).toBe('base-light');
    expect(document.documentElement.dataset.theme).toBe('base-light');
  });

  it('picks up the current device preference when switching to system', () => {
    const store = useThemeStore();
    store.setMode('light');

    stubSystemPreference(true);
    store.setMode('system');

    expect(store.theme).toBe('base-dark');
  });

  it('keeps the family when the mode changes', () => {
    const store = useThemeStore();

    store.setFamily('eva');
    store.setMode('system');
    store.setFamily('gqs');

    expect(store.theme).toBe('gqs-light');
  });
});
