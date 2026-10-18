import * as api from '@/api';
import { i18n } from '@/i18n';
import type { ChatStatus } from '@/config/chatStatus';
import { resetSopList } from '@/composables/useSopList';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { nextTick } from 'vue';
import ChatInputArea from './ChatInputArea.vue';

vi.mock('@/api', () => ({
  getSops: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetSopList();
  (api.getSops as Mock).mockResolvedValue({ data: { items: [{ slug: 'trip-itinerary', title: 'Trip itinerary' }] } });
});

function mountArea(overrides: { agents?: string[]; defaultAgent?: string; providers?: { name?: string; model_name?: string }[]; status?: ChatStatus; streaming?: boolean } = {}) {
  return mount(ChatInputArea, {
    props: {
      agents: overrides.agents ?? ['researcher'],
      defaultAgent: overrides.defaultAgent,
      providers: overrides.providers ?? [{ name: 'openai', model_name: 'gpt-5' }],
      status: overrides.status,
      streaming: overrides.streaming,
    },
    global: { plugins: [i18n] },
  });
}

describe('ChatInputArea', () => {
  it('shows no status dot before a connection', () => {
    expect(mountArea().find('.status').exists()).toBe(false);
  });

  it('shows a warning dot while connecting', () => {
    expect(mountArea({ status: 'connecting' }).get('.status').classes()).toContain('status-warning');
  });

  it('shows a success dot once connected', () => {
    expect(mountArea({ status: 'connected' }).get('.status').classes()).toContain('status-success');
  });

  it('shows an error dot when the connection dropped', () => {
    expect(mountArea({ status: 'error' }).get('.status').classes()).toContain('status-error');
  });

  it('keeps send disabled until something is typed', async () => {
    const wrapper = mountArea();
    const send = wrapper.get('[data-testid="chat-send"]');
    expect(send.attributes('disabled')).toBeDefined();

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hi';
    await input.trigger('input');

    expect(send.attributes('disabled')).toBeUndefined();
  });

  it('emits the typed turn with the chosen agent and provider', async () => {
    const wrapper = mountArea();

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ content: 'hello', agent: 'researcher', provider: 'openai' }]);
  });

  it('falls back to the model name for a provider without a name', async () => {
    const wrapper = mountArea({ providers: [{ model_name: 'gpt-5' }] });

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ content: 'hello', agent: 'researcher', provider: 'gpt-5' }]);
  });

  async function submitWith(wrapper: ReturnType<typeof mountArea>): Promise<unknown> {
    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');
    await wrapper.get('[data-testid="chat-send"]').trigger('click');
    return wrapper.emitted('submit')?.[0];
  }

  function agentSelect(wrapper: ReturnType<typeof mountArea>) {
    // The provider picker comes first in the toolbar.
    return wrapper.findAll('select')[1];
  }

  it('starts on the stored default agent when there is one', async () => {
    const wrapper = mountArea({ agents: ['researcher', 'writer'], defaultAgent: 'writer' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('writer');
    expect(await submitWith(wrapper)).toEqual([{ content: 'hello', agent: 'writer', provider: 'openai' }]);
  });

  it('falls back to the first agent when the stored default is not on offer', async () => {
    const wrapper = mountArea({ agents: ['researcher', 'writer'], defaultAgent: 'deleted-since' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('researcher');
  });

  it('keeps a hand-picked agent when the default arrives after it', async () => {
    const wrapper = mountArea({ agents: ['researcher', 'writer'] });

    await agentSelect(wrapper).setValue('writer');
    // The default is read on its own request, so it can land after the user has
    // already chosen; the choice is the newer intent of the two.
    await wrapper.setProps({ defaultAgent: 'researcher' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('writer');
  });

  it('moves to the stored default when it changes the agent list', async () => {
    const wrapper = mountArea({ agents: ['researcher'], defaultAgent: 'researcher' });

    await wrapper.setProps({ agents: ['researcher', 'writer'], defaultAgent: 'writer' });

    expect((agentSelect(wrapper).element as HTMLSelectElement).value).toBe('writer');
  });

  it('clears the editor and disables send when the parent asks', async () => {
    const wrapper = mountArea();

    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = 'hello';
    await input.trigger('input');

    const area = wrapper.vm as unknown as { clear: () => void };
    area.clear();
    await nextTick();

    expect(input.element.textContent).toBe('');
    expect(wrapper.get('[data-testid="chat-send"]').attributes('disabled')).toBeDefined();
  });

  it('replaces send with stop while a turn is in flight', async () => {
    const wrapper = mountArea({ streaming: true });

    expect(wrapper.find('[data-testid="chat-send"]').exists()).toBe(false);

    await wrapper.get('[data-testid="chat-stop"]').trigger('click');

    expect(wrapper.emitted('stop')).toHaveLength(1);
  });
});

describe('ChatInputArea slash panel', () => {
  async function typeInto(wrapper: ReturnType<typeof mountArea>, text: string) {
    const input = wrapper.get('[data-testid="chat-input"]');
    input.element.textContent = text;
    await input.trigger('input');
    return input;
  }

  async function openWithSlash(wrapper: ReturnType<typeof mountArea>) {
    await nextTick();
    await nextTick();
    return typeInto(wrapper, '/');
  }

  it('opens on a slash and lists the built-in commands and the sops', async () => {
    const wrapper = mountArea();
    await openWithSlash(wrapper);

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slash-option-compact"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slash-option-stop"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slash-option-trip-itinerary"]').exists()).toBe(true);
  });

  it('narrows the list as more is typed', async () => {
    const wrapper = mountArea();
    await openWithSlash(wrapper);

    await typeInto(wrapper, '/trip');

    expect(wrapper.findAll('[role="option"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="slash-option-trip-itinerary"]').exists()).toBe(true);
  });

  it('closes once the text has a space', async () => {
    const wrapper = mountArea();
    await openWithSlash(wrapper);

    await typeInto(wrapper, '/stop now');

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);
  });

  it('stays closed while an IME is composing', async () => {
    const wrapper = mountArea();
    await nextTick();
    const input = wrapper.get('[data-testid="chat-input"]');

    await input.trigger('compositionstart');
    await typeInto(wrapper, '/trip');

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);

    await input.trigger('compositionend');
    await nextTick();

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(true);
  });

  it('completes the highlighted sop on Enter without sending the turn', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/trip');
    await input.trigger('keydown', { key: 'Enter' });

    expect(input.element.textContent).toBe('/trip-itinerary ');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);
  });

  it('completes on Tab too', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/com');
    await input.trigger('keydown', { key: 'Tab' });

    expect(input.element.textContent).toBe('/compact ');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('moves the highlight with the arrow keys and wraps around', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/');
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.get('[data-testid="slash-option-stop"]').attributes('aria-selected')).toBe('true');

    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.get('[data-testid="slash-option-trip-itinerary"]').attributes('aria-selected')).toBe('true');

    await input.trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.get('[data-testid="slash-option-stop"]').attributes('aria-selected')).toBe('true');
  });

  it('wraps the highlight from the last row to the first and back', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/');
    await input.trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.get('[data-testid="slash-option-trip-itinerary"]').attributes('aria-selected')).toBe('true');

    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.get('[data-testid="slash-option-compact"]').attributes('aria-selected')).toBe('true');
  });

  it('closes on Escape and leaves the text alone', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await input.trigger('keydown', { key: 'Escape' });

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);
    expect(input.element.textContent).toBe('/');
  });

  it('completes the row the mouse clicks', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/trip');
    await wrapper.get('[data-testid="slash-option-trip-itinerary"]').trigger('click');

    expect(input.element.textContent).toBe('/trip-itinerary ');
  });

  it('still offers the built-in commands when the sop read fails', async () => {
    (api.getSops as Mock).mockResolvedValue({ error: { error: { code: 'NOT_FOUND', message: 'Not found.' } } });
    const wrapper = mountArea();

    await openWithSlash(wrapper);

    expect(wrapper.find('[data-testid="slash-option-compact"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="slash-option-trip-itinerary"]').exists()).toBe(false);
  });
  it('does not reopen once an argument follows the completed slug', async () => {
    const wrapper = mountArea();
    const input = await openWithSlash(wrapper);

    await typeInto(wrapper, '/trip');
    await input.trigger('keydown', { key: 'Enter' });
    await typeInto(wrapper, '/trip-itinerary 大阪');

    expect(wrapper.find('[data-testid="slash-panel"]').exists()).toBe(false);
  });
});
