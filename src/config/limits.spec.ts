import { describe, expect, it } from 'vitest';
import { CONTENT_MAX_LENGTH } from './limits';

describe('CONTENT_MAX_LENGTH', () => {
  it('matches the backend ceiling', () => {
    expect(CONTENT_MAX_LENGTH).toBe(2000);
  });
});
