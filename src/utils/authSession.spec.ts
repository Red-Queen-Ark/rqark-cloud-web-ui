import { onAuthSessionChange, readTokenPair, writeTokenPair, clearTokenPair, withAuthTokenLock } from '@/utils/authSession';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TOKENS_KEY = 'rqark.auth.tokens';

function simulateOtherTabWrite(): void {
  window.dispatchEvent(new StorageEvent('storage', { key: TOKENS_KEY, newValue: null, storageArea: localStorage }));
}

describe('authSession', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips the pair through shared storage', () => {
    writeTokenPair({ accessToken: 'a', refreshToken: 'r' });
    expect(readTokenPair()).toEqual({ accessToken: 'a', refreshToken: 'r' });

    clearTokenPair();
    expect(readTokenPair()).toBeNull();
  });

  it('ignores a corrupted entry', () => {
    localStorage.setItem(TOKENS_KEY, '{"accessToken":1}');
    expect(readTokenPair()).toBeNull();
  });

  it('reports a pair another tab stored', () => {
    writeTokenPair({ accessToken: 'b', refreshToken: 'r2' });
    const handler = vi.fn();
    const stop = onAuthSessionChange(handler);

    simulateOtherTabWrite();

    expect(handler).toHaveBeenCalledWith({ type: 'tokens', pair: { accessToken: 'b', refreshToken: 'r2' } });
    stop();
  });

  it('reports a logout when the pair disappears', () => {
    const handler = vi.fn();
    const stop = onAuthSessionChange(handler);

    localStorage.removeItem(TOKENS_KEY);
    simulateOtherTabWrite();

    expect(handler).toHaveBeenCalledWith({ type: 'logout' });
    stop();
  });

  it('serialises concurrent lock holders', async () => {
    const events: string[] = [];
    const task = (name: string) => async () => {
      events.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push(`${name}:end`);
      return name;
    };

    const results = await Promise.all([withAuthTokenLock(task('a')), withAuthTokenLock(task('b'))]);

    expect(results).toEqual(['a', 'b']);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    expect(localStorage.getItem('rqark.auth.refresh-lock')).toBeNull();
  });
});
