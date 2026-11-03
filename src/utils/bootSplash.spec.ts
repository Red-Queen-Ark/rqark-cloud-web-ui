import { dismissBootSplash } from '@/utils/bootSplash';
import { describe, expect, it } from 'vitest';

describe('dismissBootSplash', () => {
  it('removes the splash that index.html paints', () => {
    const splash = document.createElement('div');
    splash.id = 'boot-splash';
    document.body.append(splash);

    dismissBootSplash();

    expect(document.getElementById('boot-splash')).toBeNull();
  });

  it('is a no-op once it has already gone', () => {
    expect(() => dismissBootSplash()).not.toThrow();
  });
});
