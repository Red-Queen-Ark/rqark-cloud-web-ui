import { describe, expect, it } from 'vitest';
import { isTouchPrimaryInput } from './pointer';

function view(coarse: boolean) {
  return { matchMedia: (query: string) => ({ matches: coarse && query === '(pointer: coarse)' }) };
}

describe('isTouchPrimaryInput', () => {
  it('is true when the primary pointer is coarse', () => {
    expect(isTouchPrimaryInput(view(true))).toBe(true);
  });

  it('is false when a precise pointer is available', () => {
    expect(isTouchPrimaryInput(view(false))).toBe(false);
  });

  it('is false without a matchMedia to ask', () => {
    expect(isTouchPrimaryInput({})).toBe(false);
  });
});
