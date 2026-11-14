import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lastRegisterSWOptions } from './__mocks__/virtual-pwa-register';
import './pwa';

interface RegisterSWOptions {
  onRegisteredSW: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
}

function onRegisteredSW(): RegisterSWOptions['onRegisteredSW'] {
  return (lastRegisterSWOptions.current as unknown as RegisterSWOptions).onRegisteredSW;
}

function fakeRegistration(): ServiceWorkerRegistration {
  return { update: vi.fn().mockResolvedValue(undefined) } as unknown as ServiceWorkerRegistration;
}

describe('service worker update checks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does nothing without a registration', () => {
    expect(() => onRegisteredSW()('/sw.js', undefined)).not.toThrow();
  });

  it('polls for an update every minute', () => {
    const registration = fakeRegistration();
    onRegisteredSW()('/sw.js', registration);

    vi.advanceTimersByTime(59_000);
    expect(registration.update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(registration.update).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it('checks when the window regains focus', () => {
    const registration = fakeRegistration();
    onRegisteredSW()('/sw.js', registration);

    window.dispatchEvent(new Event('focus'));
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('checks when the tab becomes visible', () => {
    const registration = fakeRegistration();
    onRegisteredSW()('/sw.js', registration);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('skips the check while the tab is hidden', () => {
    const registration = fakeRegistration();
    onRegisteredSW()('/sw.js', registration);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(60_000);
    expect(registration.update).not.toHaveBeenCalled();
  });
});
