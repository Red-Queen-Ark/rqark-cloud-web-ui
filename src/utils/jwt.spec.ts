import { jwtExpiresAt } from '@/utils/jwt';
import { describe, expect, it } from 'vitest';

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function token(payload: unknown): string {
  return `header.${encode(payload)}.signature`;
}

describe('jwtExpiresAt', () => {
  it('reads the expiry in milliseconds', () => {
    expect(jwtExpiresAt(token({ sub: 'user-1', exp: 1800000000 }))).toBe(1800000000000);
  });

  it('accepts a unicode subject', () => {
    expect(jwtExpiresAt(token({ sub: '使用者', exp: 1800000000 }))).toBe(1800000000000);
  });

  it('answers for paddings of every length', () => {
    for (const subject of ['a', 'ab', 'abc', 'abcd', 'abcde']) {
      expect(jwtExpiresAt(token({ sub: subject, exp: 1800000000 }))).toBe(1800000000000);
    }
  });

  it('has no expiry for a token that is not a jwt', () => {
    expect(jwtExpiresAt('access-token')).toBeNull();
  });

  it('has no expiry for a token without an exp claim', () => {
    expect(jwtExpiresAt(token({ sub: 'user-1' }))).toBeNull();
  });

  it('has no expiry for a payload that is not json', () => {
    expect(jwtExpiresAt('header.not-json.signature')).toBeNull();
  });

  it('has no expiry for a missing token', () => {
    expect(jwtExpiresAt(undefined)).toBeNull();
  });
});
