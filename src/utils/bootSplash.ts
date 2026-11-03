/**
 * Takes the first-paint splash away once the shell has painted.
 *
 * index.html shows it before any script has run, because iOS paints its own
 * launch image first and stretches it whenever no media query matches the
 * device exactly — a resized window, or a reported screen size the artwork does
 * not cover. The splash the app draws itself is the same artwork at its true
 * aspect ratio, so it covers that stretched frame and then steps aside.
 */
export function dismissBootSplash(doc: Document = document): void {
  doc.getElementById('boot-splash')?.remove();
}
