/**
 * Cross-tab owner of the token pair.
 *
 * The backend refresh token is single use: whoever spends it gets a new pair
 * and everyone else is left holding a dead token. Every tab therefore has to
 * agree on one shared pair and on one tab doing the rotation at a time, which
 * is what this module provides:
 *
 *  - `localStorage` under `TOKENS_KEY` is the source of truth, so it is already
 *    written before a rotation releases the lock.
 *  - `withAuthTokenLock` serialises rotations across tabs (Web Locks, with a
 *    lease-based fallback for browsers without it).
 *  - `onAuthSessionChange` lets the other tabs adopt a new pair (or a logout)
 *    without polling.
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type AuthSessionEvent = { type: 'tokens'; pair: TokenPair } | { type: 'logout' };

const TOKENS_KEY = 'rqark.auth.tokens';
/** Where pinia-persistedstate used to keep the pair, read once to migrate. */
const LEGACY_KEY = 'authStore';
const LEASE_KEY = 'rqark.auth.refresh-lock';
const LOCK_NAME = 'rqark-auth-refresh';
const LEASE_MS = 20_000;
const LEASE_WAIT_MS = 10_000;

interface Lease {
  owner: string;
  expiresAt: number;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Private-mode Safari and friends can throw on access.
    return null;
  }
}

export function readTokenPair(): TokenPair | null {
  return readSharedPair() ?? migrateLegacyPair();
}

function readSharedPair(): TokenPair | null {
  const raw = storage()?.getItem(TOKENS_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TokenPair> | null;
    if (typeof parsed?.accessToken !== 'string' || typeof parsed.refreshToken !== 'string') {
      return null;
    }
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    return null;
  }
}

/**
 * Sessions written before the pair moved out of the pinia blob would otherwise
 * log every existing user out once on upgrade, so the old entry is adopted and
 * then stripped of its tokens.
 */
function migrateLegacyPair(): TokenPair | null {
  try {
    const raw = storage()?.getItem(LEGACY_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { accessToken?: unknown; refreshToken?: unknown } | null;
    if (typeof parsed?.accessToken !== 'string' || typeof parsed.refreshToken !== 'string') {
      return null;
    }
    const pair = { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    writeTokenPair(pair);
    delete parsed.accessToken;
    delete parsed.refreshToken;
    storage()?.setItem(LEGACY_KEY, JSON.stringify(parsed));
    return pair;
  } catch {
    return null;
  }
}

export function writeTokenPair(pair: TokenPair): void {
  try {
    storage()?.setItem(TOKENS_KEY, JSON.stringify(pair));
  } catch {
    // A full or unavailable storage only costs us cross-tab sync.
  }
}

export function clearTokenPair(): void {
  try {
    storage()?.removeItem(TOKENS_KEY);
  } catch {
    // Ignore, same as above.
  }
}

/**
 * Calls `handler` when another tab writes a new pair or logs out. Fires only
 * for *other* tabs, which is exactly what we want: the writing tab already has
 * the new state in memory.
 */
export function onAuthSessionChange(handler: (event: AuthSessionEvent) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const listener = (event: StorageEvent): void => {
    if (event.key !== TOKENS_KEY || (event.storageArea && event.storageArea !== storage())) {
      return;
    }
    const pair = readTokenPair();
    handler(pair ? { type: 'tokens', pair } : { type: 'logout' });
  };

  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

function readLease(): Lease | null {
  const raw = storage()?.getItem(LEASE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Lease> | null;
    if (typeof parsed?.owner !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    return { owner: parsed.owner, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fallback lock for browsers without the Web Locks API (Safari < 15.4). */
async function withLeaseLock<T>(task: () => Promise<T>): Promise<T> {
  const owner = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + LEASE_WAIT_MS;

  for (;;) {
    const now = Date.now();
    const lease = readLease();
    if (!lease || lease.expiresAt <= now) {
      try {
        storage()?.setItem(LEASE_KEY, JSON.stringify({ owner, expiresAt: now + LEASE_MS } satisfies Lease));
      } catch {
        // No storage at all: nothing to serialise against, run the task.
        return task();
      }
      // `localStorage` is synchronous, so a read straight after the write tells
      // us whether another tab overwrote us in between.
      if (readLease()?.owner === owner) {
        break;
      }
    }
    if (Date.now() > deadline) {
      // Never deadlock the UI on a stuck lock; a duplicate rotation is far less
      // harmful than a frozen refresh.
      break;
    }
    await sleep(50 + Math.random() * 100);
  }

  try {
    return await task();
  } finally {
    if (readLease()?.owner === owner) {
      try {
        storage()?.removeItem(LEASE_KEY);
      } catch {
        // Nothing left to release.
      }
    }
  }
}

/** Runs `task` while holding the cross-tab refresh lock. */
export async function withAuthTokenLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (locks?.request) {
    return locks.request(LOCK_NAME, task);
  }
  return withLeaseLock(task);
}
