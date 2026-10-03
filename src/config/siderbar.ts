import type { Component } from 'vue';
import CogIcon from '@/components/svg/CogIcon.vue';

export interface SiderItem {
  pageId: string;
  i18nKey: string;
  subtitleKey: string;
  icon: Component;
  /** Hides the entry from callers that are not superusers. */
  superuserOnly?: boolean;
  /**
   * Route names that belong to this entry without being its own page.
   *
   * A detail page is reached from the list and sits under the same heading, so
   * it should keep the list's title in the header and keep the entry marked in
   * the sidebar. Without this the two only match on the exact route name.
   */
  aliases?: string[];
}

export const siderItems: SiderItem[] = [
  {
    pageId: 'settings',
    i18nKey: 'settings.title',
    subtitleKey: 'settings.subtitle',
    icon: CogIcon,
  },
];

/** The navigation entry a route name belongs to, if any. */
export function siderItemFor(pageId?: string): SiderItem | undefined {
  return siderItems.find((item) => item.pageId === pageId || (pageId !== undefined && item.aliases?.includes(pageId) === true));
}
