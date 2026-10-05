import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { distanceFromBottom, scrollableParent, useStickyScroll } from './useStickyScroll';

class FakeResizeObserver {
  public static instances: FakeResizeObserver[] = [];
  public targets: Element[] = [];
  public observer: (() => void) | undefined;
  public disconnected = false;
  private readonly callback: () => void;

  public constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  public observe(target: Element) {
    this.targets.push(target);
  }

  public disconnect() {
    this.disconnected = true;
  }

  public fire() {
    if (!this.disconnected) {
      this.callback();
    }
  }
}

let sticky: ReturnType<typeof useStickyScroll>;

const Host = defineComponent({
  setup() {
    const content = ref<HTMLElement | null>(null);
    sticky = useStickyScroll(content);
    return () => h('div', { ref: content, 'data-testid': 'content' });
  },
});

interface Fixture {
  container: HTMLElement;
  wrapper: VueWrapper;
}

function height(element: HTMLElement, property: 'clientHeight' | 'scrollHeight', value: number) {
  Object.defineProperty(element, property, { configurable: true, value });
}

function scrollTop(element: HTMLElement, value: number) {
  Object.defineProperty(element, 'scrollTop', { configurable: true, writable: true, value });
}

function scrollTo(element: HTMLElement, value: number) {
  element.scrollTop = value;
  element.dispatchEvent(new Event('scroll'));
}

function open(): Fixture {
  const container = document.createElement('div');
  container.style.overflowY = 'auto';
  document.body.appendChild(container);
  height(container, 'clientHeight', 200);
  height(container, 'scrollHeight', 800);
  scrollTop(container, 600);
  const wrapper = mount(Host, { attachTo: container });
  return { container, wrapper };
}

function observer(): FakeResizeObserver {
  return FakeResizeObserver.instances[FakeResizeObserver.instances.length - 1];
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('scrollableParent', () => {
  it('finds the nearest ancestor that scrolls', () => {
    const outer = document.createElement('div');
    outer.style.overflowY = 'scroll';
    const inner = document.createElement('div');
    inner.style.overflowY = 'auto';
    const leaf = document.createElement('p');
    inner.appendChild(leaf);
    outer.appendChild(inner);

    expect(scrollableParent(leaf)).toBe(inner);
    expect(scrollableParent(outer)).toBeNull();
    expect(scrollableParent(null)).toBeNull();
  });

  it('skips ancestors that only clip', () => {
    const clipping = document.createElement('div');
    clipping.style.overflowY = 'hidden';
    const leaf = document.createElement('p');
    clipping.appendChild(leaf);

    expect(scrollableParent(leaf)).toBeNull();
  });
});

describe('distanceFromBottom', () => {
  it('is zero at the tail and grows as the reader climbs', () => {
    const element = document.createElement('div');
    height(element, 'clientHeight', 200);
    height(element, 'scrollHeight', 800);
    scrollTop(element, 600);
    expect(distanceFromBottom(element)).toBe(0);

    scrollTop(element, 100);
    expect(distanceFromBottom(element)).toBe(500);
  });
});

describe('useStickyScroll', () => {
  it('opens on the tail of the content it was handed', () => {
    const { container, wrapper } = open();

    expect(sticky.pinned.value).toBe(true);
    expect(container.scrollTop).toBe(800);
    wrapper.unmount();
  });

  it('follows the content as it grows', () => {
    const { container, wrapper } = open();

    height(container, 'scrollHeight', 1200);
    scrollTop(container, 800);
    observer().fire();

    expect(container.scrollTop).toBe(1200);
    wrapper.unmount();
  });

  it('picks the scroll region up late when it was not scrollable at first', () => {
    const wrapper = mount(Host);
    expect(sticky.container.value).toBeNull();

    const container = document.createElement('div');
    container.style.overflowY = 'auto';
    height(container, 'clientHeight', 200);
    height(container, 'scrollHeight', 800);
    scrollTop(container, 0);
    document.body.appendChild(container);
    container.appendChild(wrapper.element);

    observer().fire();

    expect(sticky.container.value).toBe(container);
    expect(container.scrollTop).toBe(800);
    wrapper.unmount();
  });

  it('lets the reader pull away and leaves the position alone', () => {
    const { container, wrapper } = open();

    scrollTo(container, 0);
    expect(sticky.pinned.value).toBe(false);
    expect(observer().targets).toContain(container);

    height(container, 'scrollHeight', 1200);
    observer().fire();

    expect(container.scrollTop).toBe(0);
    wrapper.unmount();
  });

  it('does not read a stale scroll as the reader pulling away', () => {
    const { container, wrapper } = open();

    height(container, 'scrollHeight', 1100);
    container.dispatchEvent(new Event('scroll'));
    expect(sticky.pinned.value).toBe(true);

    observer().fire();
    expect(container.scrollTop).toBe(1100);
    wrapper.unmount();
  });

  it('pins again once the reader is back at the tail', () => {
    const { container, wrapper } = open();

    scrollTo(container, 0);
    expect(sticky.pinned.value).toBe(false);

    scrollTo(container, 600);
    expect(sticky.pinned.value).toBe(true);
    wrapper.unmount();
  });

  it('jumps to the tail on demand', () => {
    const { container, wrapper } = open();

    scrollTo(container, 0);
    sticky.scrollToBottom();

    expect(container.scrollTop).toBe(800);
    expect(sticky.pinned.value).toBe(true);
    wrapper.unmount();
  });

  it('stops following and listening once it unmounts', () => {
    const { container, wrapper } = open();

    wrapper.unmount();
    expect(observer().disconnected).toBe(true);

    container.scrollTop = 0;
    container.dispatchEvent(new Event('scroll'));
    expect(sticky.pinned.value).toBe(true);
  });
});
