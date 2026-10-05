import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue';

const DEFAULT_THRESHOLD = 32;

export function scrollableParent(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function distanceFromBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

export function useStickyScroll(content: Ref<HTMLElement | null>, threshold = DEFAULT_THRESHOLD) {
  const pinned = ref(true);
  const container = shallowRef<HTMLElement | null>(null);
  let observer: ResizeObserver | undefined;
  let lastScrollTop = 0;

  function scrollToBottom() {
    pinned.value = true;
    const element = resolve();
    if (element) {
      element.scrollTop = element.scrollHeight;
      lastScrollTop = element.scrollTop;
    }
  }

  function follow() {
    if (pinned.value) {
      scrollToBottom();
    }
  }

  function handleScroll() {
    const element = container.value;
    if (!element) {
      pinned.value = true;
      return;
    }
    const top = element.scrollTop;
    if (distanceFromBottom(element) <= threshold) {
      pinned.value = true;
    } else if (top < lastScrollTop) {
      pinned.value = false;
    }
    lastScrollTop = top;
  }

  function resolve(): HTMLElement | null {
    if (!container.value) {
      container.value = scrollableParent(content.value);
      container.value?.addEventListener('scroll', handleScroll, { passive: true });
      if (container.value) {
        observer?.observe(container.value);
      }
    }
    return container.value;
  }

  onMounted(() => {
    const element = content.value;
    if (!element) {
      return;
    }
    resolve();
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(follow);
      observer.observe(element);
      if (container.value) {
        observer.observe(container.value);
      }
    }
    scrollToBottom();
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    container.value?.removeEventListener('scroll', handleScroll);
  });

  return { pinned, container, scrollToBottom };
}
