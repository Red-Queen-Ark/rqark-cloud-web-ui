import { describe, expect, it } from 'vitest';
import { isIOSStandalone } from './iosStandalone';

const base = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
  standalone: true,
  displayModeStandalone: false,
};

describe('isIOSStandalone', () => {
  it('detects an iPad, which reports a desktop Safari user agent', () => {
    expect(isIOSStandalone(base)).toBe(true);
  });

  it('detects an iPhone from its user agent', () => {
    expect(isIOSStandalone({ ...base, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', platform: 'iPhone', maxTouchPoints: 5 })).toBe(true);
  });

  it('accepts the display-mode media query when standalone is not exposed', () => {
    expect(isIOSStandalone({ ...base, standalone: false, displayModeStandalone: true })).toBe(true);
  });

  it('ignores iOS in a browser tab', () => {
    expect(isIOSStandalone({ ...base, standalone: false, displayModeStandalone: false })).toBe(false);
  });

  it('ignores a real Mac, which has a single pointer and no touch points', () => {
    expect(isIOSStandalone({ ...base, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
  });

  it('ignores a desktop app window on another platform', () => {
    expect(isIOSStandalone({ ...base, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', platform: 'Linux x86_64', maxTouchPoints: 0 })).toBe(false);
  });
});
