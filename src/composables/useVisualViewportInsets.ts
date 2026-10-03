import { onBeforeUnmount, onMounted } from 'vue';

export interface VisualViewportInsets {
  inset: number;
  offsetTop: number;
  height: number;
}

export function measureVisualViewportInsets(layoutHeight: number, viewport: VisualViewport): VisualViewportInsets {
  const height = Math.max(0, Math.round(viewport.height));
  if (viewport.scale > 1.01) {
    return { inset: 0, offsetTop: 0, height };
  }
  const keyboardActive = height < layoutHeight - 1;
  const offsetTop = keyboardActive ? Math.max(0, Math.round(viewport.offsetTop)) : 0;
  return { inset: Math.max(0, Math.round(layoutHeight - height - offsetTop)), offsetTop, height };
}

export function applyVisualViewportInsets(target: HTMLElement = document.documentElement): VisualViewportInsets {
  const viewport = window.visualViewport;
  if (!viewport) {
    return { inset: 0, offsetTop: 0, height: 0 };
  }
  const next = measureVisualViewportInsets(document.documentElement.clientHeight, viewport);
  target.style.setProperty('--keyboard-inset', `${next.inset}px`);
  target.style.setProperty('--vv-offset-top', `${next.offsetTop}px`);
  target.style.setProperty('--vv-height', `${next.height}px`);
  return next;
}

export function useVisualViewportInsets(target?: HTMLElement) {
  const root = target ?? document.documentElement;
  const controller = new AbortController();
  let frame = 0;

  function apply() {
    applyVisualViewportInsets(root);
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(apply);
  }

  onMounted(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    const { signal } = controller;
    viewport.addEventListener('resize', schedule, { signal });
    viewport.addEventListener('scroll', schedule, { signal });
    window.addEventListener('orientationchange', schedule, { signal });
    apply();
  });

  onBeforeUnmount(() => {
    controller.abort();
    cancelAnimationFrame(frame);
    root.style.removeProperty('--keyboard-inset');
    root.style.removeProperty('--vv-offset-top');
    root.style.removeProperty('--vv-height');
  });

  return { apply, schedule };
}
