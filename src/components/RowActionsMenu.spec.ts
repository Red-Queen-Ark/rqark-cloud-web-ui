import { i18n } from '@/i18n';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import RowActionsMenu from './RowActionsMenu.vue';

// A menu left open listens on the document, and the next test's keypress would
// reach a component whose teleport target has already been wiped.
enableAutoUnmount(afterEach);

const BUTTON = '[data-testid="row-actions-button"]';
const MENU = '[data-testid="row-actions-menu"]';

/** The menu is teleported to the body, so it is outside the wrapper's own tree. */
const menu = () => document.querySelector(MENU) as HTMLElement | null;

function mountMenu(label?: string) {
  return mount(RowActionsMenu, {
    props: { label },
    // Attached, because Escape hands the focus back to the button: a detached
    // element cannot take it.
    attachTo: document.body,
    slots: { default: '<li><button data-testid="row-action-edit">Edit</button></li><li><button class="text-error" data-testid="row-action-delete">Delete</button></li>' },
    global: { plugins: [i18n] },
  });
}

describe('RowActionsMenu', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('offers one kebab button until it is asked, named for what it holds', () => {
    const wrapper = mountMenu();

    expect(wrapper.get(BUTTON).attributes('aria-label')).toBe('More actions');
    expect(wrapper.get(BUTTON).attributes('aria-expanded')).toBe('false');
    expect(menu()).toBeNull();
  });

  it('opens above the table, not inside it, and lists every action the row gave it', async () => {
    const wrapper = mountMenu();
    await wrapper.get(BUTTON).trigger('click');

    const panel = menu();
    expect(panel).not.toBeNull();
    // Teleported and fixed: the pinned column and the scroller cannot clip it.
    expect(panel?.parentElement).toBe(document.body);
    expect(panel?.className).toContain('fixed');
    expect(wrapper.get(BUTTON).attributes('aria-expanded')).toBe('true');
    expect(panel?.textContent).toContain('Edit');
    expect(panel?.textContent).toContain('Delete');
  });

  it('takes a label for a row whose menu is about one thing', async () => {
    const wrapper = mountMenu('Row actions');

    expect(wrapper.get(BUTTON).attributes('aria-label')).toBe('Row actions');
  });

  it('puts itself away once an action has been taken', async () => {
    const wrapper = mountMenu();
    await wrapper.get(BUTTON).trigger('click');

    (document.querySelector('[data-testid="row-action-edit"]') as HTMLButtonElement).click();
    await wrapper.vm.$nextTick();

    expect(menu()).toBeNull();
  });

  it('closes on Escape and hands the focus back to the button', async () => {
    const wrapper = mountMenu();
    await wrapper.get(BUTTON).trigger('click');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(wrapper.get(BUTTON).element);
  });

  it('closes when the page is touched anywhere else', async () => {
    const wrapper = mountMenu();
    await wrapper.get(BUTTON).trigger('click');

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(menu()).toBeNull();
  });

  it('closes when the list scrolls under it rather than hanging over the wrong row', async () => {
    const wrapper = mountMenu();
    await wrapper.get(BUTTON).trigger('click');

    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();

    expect(menu()).toBeNull();
  });

  it('stops listening once it is gone', async () => {
    const wrapper = mountMenu();
    await wrapper.get(BUTTON).trigger('click');
    wrapper.unmount();

    expect(menu()).toBeNull();
  });
});
