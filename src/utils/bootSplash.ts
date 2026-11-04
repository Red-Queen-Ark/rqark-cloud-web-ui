/**
 * Takes the first-paint splash away once the shell has painted.
 *
 * index.html shows it before any script has run, to cover the gap iOS leaves
 * between its own launch image and the first frame the app paints. It is only
 * shown for an installed iOS app; a browser tab never sees it.
 */
const SPLASH_ID = 'boot-splash';
/** Fades out rather than vanishing, so the swap is not a flash. */
const FADE_MS = 160;
/** Short enough to feel instant, long enough that the mark is actually seen. */
const MIN_VISIBLE_MS = 450;

export interface DismissOptions {
  /** Elements to search, so a test can pass a detached document. */
  doc?: Document;
  /**
   * When the splash first painted, on the `performance.now()` clock — the same
   * clock `main.ts` reads. Mixing it with `Date.now()` made the difference
   * astronomically large, so the minimum-visible window never applied and the
   * splash vanished in the first frame.
   */
  shownAt?: number;
}

export function dismissBootSplash({ doc = document, shownAt }: DismissOptions = {}): void {
  const splash = doc.getElementById(SPLASH_ID);
  if (!splash) {
    return;
  }

  const visibleFor = shownAt === undefined ? 0 : performance.now() - shownAt;
  const wait = Math.max(0, MIN_VISIBLE_MS - visibleFor);
  const remove = () => {
    splash.classList.add('is-going');
    setTimeout(() => splash.remove(), FADE_MS);
  };

  if (wait === 0) {
    remove();
    return;
  }
  setTimeout(remove, wait);
}
