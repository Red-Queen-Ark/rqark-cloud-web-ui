import * as api from '@/api';
import { i18n } from '@/i18n';
import { useAlertStore } from '@/stores/alertStore';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import SidebarChatSessionMenu from './SidebarChatSessionMenu.vue';

vi.mock('@/api', () => ({ deleteSessionsByUuid: vi.fn() }));

const ID = 'session-latest';
const BUTTON = '[data-testid="sidebar-chat-session-menu-button"]';
const EDIT = '[data-testid="sidebar-chat-session-edit"]';
const DELETE = '[data-testid="sidebar-chat-session-delete"]';
const CONFIRM = '[data-testid="form-modal-box"] .btn-error';

let pinia: Pinia;

// The menu and the dialog are teleported to the body, so they sit outside the wrapper's own tree.
const dialog = () => document.querySelector('[data-testid="form-modal-box"]');
const editItem = () => document.querySelector<HTMLElement>(EDIT);
const deleteItem = () => document.querySelector<HTMLElement>(DELETE);

function mountMenu(active = false) {
  return mount(SidebarChatSessionMenu, { props: { sessionId: ID, active }, attachTo: document.body, global: { plugins: [i18n, pinia] } });
}

/** Opens the menu the way a user does; its items only exist while it is open. */
async function openMenu(wrapper: ReturnType<typeof mountMenu>) {
  await wrapper.get(BUTTON).trigger('click');
  await flushPromises();
}

describe('SidebarChatSessionMenu', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('recolours the trigger when the row it sits on is the open chat', () => {
    // The open row is filled with `neutral`, so base-content would vanish into it.
    expect(mountMenu().get(BUTTON).classes()).toContain('text-base-content/60');
    expect(mountMenu(true).get(BUTTON).classes()).toContain('text-neutral-content/70');
  });

  it('asks the row to start renaming without touching the api', async () => {
    const wrapper = mountMenu();
    await openMenu(wrapper);

    editItem()?.click();
    await flushPromises();

    expect(wrapper.emitted('edit')).toHaveLength(1);
    expect(dialog()).toBeNull();
    expect(api.deleteSessionsByUuid).not.toHaveBeenCalled();
  });

  it('confirms before deleting and reports the removed session', async () => {
    (api.deleteSessionsByUuid as Mock).mockResolvedValue({ data: undefined });

    const wrapper = mountMenu();
    await openMenu(wrapper);
    deleteItem()?.click();
    await flushPromises();
    expect(dialog()).not.toBeNull();
    expect(api.deleteSessionsByUuid).not.toHaveBeenCalled();

    (document.querySelector(CONFIRM) as HTMLButtonElement).click();
    await flushPromises();

    expect(api.deleteSessionsByUuid).toHaveBeenCalledWith({ path: { uuid: ID } });
    expect(wrapper.emitted('deleted')).toEqual([[ID]]);
    expect(dialog()).toBeNull();
  });

  it('keeps the dialog open and alerts when the delete fails', async () => {
    (api.deleteSessionsByUuid as Mock).mockResolvedValue({ error: { error: { code: 'INTERNAL', message: 'boom' } } });

    const alerts = useAlertStore();
    const addItem = vi.spyOn(alerts, 'addItem');

    const wrapper = mountMenu();
    await openMenu(wrapper);
    deleteItem()?.click();
    await flushPromises();
    (document.querySelector(CONFIRM) as HTMLButtonElement).click();
    await flushPromises();

    expect(addItem).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('deleted')).toBeUndefined();
    expect(dialog()).not.toBeNull();
  });
});
