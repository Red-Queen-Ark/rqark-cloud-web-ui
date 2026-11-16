/**
 * Whether the primary input is a touch screen (phone, tablet).
 *
 * The media query tests the primary pointer, so a tablet with a keyboard case
 * still counts as touch while a touchscreen laptop with a trackpad does not.
 * A host without `matchMedia` is treated as touch-less.
 */
export function isTouchPrimaryInput(view: { matchMedia?: ((query: string) => { matches: boolean }) | undefined } = window): boolean {
  return view.matchMedia?.('(pointer: coarse)').matches ?? false;
}
