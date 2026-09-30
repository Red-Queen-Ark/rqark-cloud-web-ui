import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useApiError } from './useApiError';

describe('useApiError', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('translates a code whose meaning is fixed', () => {
    const message = useApiError()({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } });
    expect(message).toBe('You do not have permission to perform this action.');
  });

  it('keeps the backend message when the code covers unrelated causes', () => {
    // BAD_REQUEST also reports unknown users, policy violations and bad bodies,
    // so the specific message has to survive.
    const message = useApiError()({ error: { code: 'BAD_REQUEST', message: 'Current password is incorrect.' } });
    expect(message).toBe('Current password is incorrect.');
  });

  it('keeps the backend message for a conflict', () => {
    const message = useApiError()({ error: { code: 'CONFLICT', message: 'Email is already taken.' } });
    expect(message).toBe('Email is already taken.');
  });

  it('falls back to the caller key when nothing is known', () => {
    expect(useApiError()(undefined, 'login.error')).toBe('Invalid credentials');
    expect(useApiError()({ error: { code: 'INTERNAL' } })).toBe('The server encountered an error. Please try again later.');
  });
});
