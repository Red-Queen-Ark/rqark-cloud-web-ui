/**
 * iOS/iPadOS paints a blur scrim over the top of a Home Screen web app and the
 * page cannot opt out of it (WebKit bugs 317153, 301994). The scrim covers the
 * status bar band, which on iPad is taller than `env(safe-area-inset-top)`
 * reports — that resolves to 0 on iPads, so a safe-area-only pad leaves the
 * topbar under the blur.
 *
 * The shell needs a clearance band on those platforms only; a desktop browser
 * installed as an app has no scrim and must not get the extra padding.
 */
export function isIOSStandalone(options: { userAgent: string; platform: string; maxTouchPoints: number; standalone: boolean; displayModeStandalone: boolean }): boolean {
  const { userAgent, platform, maxTouchPoints, standalone, displayModeStandalone } = options;
  if (!standalone && !displayModeStandalone) {
    return false;
  }
  // iPadOS 13+ reports a desktop Safari UA, so the touch-point check identifies
  // an iPad while the user agent claims to be a Mac.
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  return isIOS;
}

export function applyIOSStandaloneClass(root: HTMLElement = document.documentElement): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  const isStandalone = navigatorWithStandalone.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const matches = isIOSStandalone({
    userAgent: navigator.userAgent,
    platform: navigator.platform ?? '',
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: navigatorWithStandalone.standalone === true,
    displayModeStandalone: isStandalone,
  });
  root.classList.toggle('ios-standalone', matches);
  return matches;
}
