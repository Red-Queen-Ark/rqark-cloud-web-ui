/**
 * Takes the first-paint splash away once the shell has painted.
 *
 * index.html shows it before any script has run, because iOS paints its own
 * launch image first and stretches it whenever no media query matches the
 * device exactly — a resized window, or a reported screen size the artwork does
 * not cover. The splash the app draws itself is the mark at its true aspect
 * ratio, inline so it needs no request, so it covers that stretched frame and
 * then steps aside.
 */
const SPLASH_ID = 'boot-splash';
/** Fades out rather than vanishing, so the swap is not a flash. */
const FADE_MS = 160;
/** Short enough to feel instant, long enough that the mark is actually seen. */
const MIN_VISIBLE_MS = 450;

export interface DismissOptions {
  /** Elements to search, so a test can pass a detached document. */
  doc?: Document;
  /** When the splash first painted, for the minimum-visible window. */
  shownAt?: number;
}

export function dismissBootSplash({ doc = document, shownAt = 0 }: DismissOptions = {}): void {
  const splash = doc.getElementById(SPLASH_ID);
  if (!splash) {
    return;
  }

  const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt));
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
