import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { measureVisualViewportInsets, useVisualViewportInsets } from './useVisualViewportInsets';

class FakeVisualViewport extends EventTarget {
  public height = 800;
  public offsetTop = 0;
  public scale = 1;
}

const Host = defineComponent({
  setup() {
    useVisualViewportInsets();
    return () => h('div');
  },
});

function viewport(overrides: { height?: number; offsetTop?: number; scale?: number } = {}): VisualViewport {
  return { height: 800, offsetTop: 0, scale: 1, ...overrides } as unknown as VisualViewport;
}

describe('measureVisualViewportInsets', () => {
  it('subtracts both the visual height and the pan from the layout height', () => {
    expect(measureVisualViewportInsets(800, viewport({ height: 500 })).inset).toBe(300);
    expect(measureVisualViewportInsets(800, viewport({ height: 500, offsetTop: 120 })).inset).toBe(180);
  });

  it('never returns a negative inset', () => {
    expect(measureVisualViewportInsets(800, viewport({ height: 500, offsetTop: 700 })).inset).toBe(0);
  });

  it('reports no keyboard while a pinch zoom is in effect', () => {
    const insets = measureVisualViewportInsets(800, viewport({ height: 400, scale: 1.5 }));
    expect(insets.inset).toBe(0);
    expect(insets.offsetTop).toBe(0);
  });

  it('drops a stale pan once the visual viewport is full height again', () => {
    const insets = measureVisualViewportInsets(800, viewport({ height: 800, offsetTop: 140 }));
    expect(insets.inset).toBe(0);
    expect(insets.offsetTop).toBe(0);
  });
});

describe('useVisualViewportInsets', () => {
  let fake: FakeVisualViewport;

  beforeEach(() => {
    fake = new FakeVisualViewport();
    vi.stubGlobal('visualViewport', fake);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (document.documentElement as unknown as { clientHeight?: number }).clientHeight;
  });

  it('publishes the keyboard inset and pan as custom properties', () => {
    const wrapper = mount(Host);
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('0px');

    fake.height = 500;
    fake.offsetTop = 60;
    fake.dispatchEvent(new Event('resize'));

    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('240px');
    expect(document.documentElement.style.getPropertyValue('--vv-offset-top')).toBe('60px');
    expect(document.documentElement.style.getPropertyValue('--vv-height')).toBe('500px');

    wrapper.unmount();
  });

  it('follows the visual viewport scroll that iOS fires while panning', () => {
    const wrapper = mount(Host);

    fake.height = 500;
    fake.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('300px');

    fake.offsetTop = 100;
    fake.dispatchEvent(new Event('scroll'));
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('200px');
    expect(document.documentElement.style.getPropertyValue('--vv-offset-top')).toBe('100px');

    wrapper.unmount();
  });

  it('clears the properties when the page unmounts', () => {
    const wrapper = mount(Host);
    fake.height = 500;
    fake.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('300px');

    wrapper.unmount();
    expect(document.documentElement.style.getPropertyValue('--keyboard-inset')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--vv-offset-top')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--vv-height')).toBe('');
  });
});
