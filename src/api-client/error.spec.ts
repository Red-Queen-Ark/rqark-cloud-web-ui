import { describe, expect, it } from 'vitest';
import { apiErrorCode, apiErrorMessage } from './error';

describe('api error helpers', () => {
  it('reads the code and message from the backend envelope', () => {
    const error = { error: { code: 'FORBIDDEN', message: 'You do not have permission.' } };
    expect(apiErrorCode(error)).toBe('FORBIDDEN');
    expect(apiErrorMessage(error)).toBe('You do not have permission.');
  });

  it('is undefined for unknown shapes', () => {
    expect(apiErrorCode(undefined)).toBeUndefined();
    expect(apiErrorMessage('boom')).toBeUndefined();
    expect(apiErrorCode({})).toBeUndefined();
  });
});
