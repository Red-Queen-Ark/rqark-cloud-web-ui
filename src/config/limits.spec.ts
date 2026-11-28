import { describe, expect, it } from 'vitest';
import { SOP_CONTENT_MAX_LENGTH, STATE_BOARD_MAX_LENGTH } from './limits';

describe('content ceilings', () => {
  it('keeps the sop ceiling at the backend limit', () => {
    expect(SOP_CONTENT_MAX_LENGTH).toBe(2000);
  });

  it('raises the state board ceiling to the backend limit', () => {
    expect(STATE_BOARD_MAX_LENGTH).toBe(8000);
  });
});
