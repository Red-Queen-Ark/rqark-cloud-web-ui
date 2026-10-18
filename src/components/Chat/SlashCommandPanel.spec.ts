import { i18n } from '@/i18n';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { SlashEntry } from '@/config/slashCommands';
import SlashCommandPanel from './SlashCommandPanel.vue';

const entries: SlashEntry[] = [
  { name: '/clear', label: 'Clear the current conversation', kind: 'builtin' },
  { name: '/trip-itinerary', label: 'Trip itinerary', kind: 'sop' },
];

function mountPanel(overrides: { entries?: SlashEntry[]; activeIndex?: number } = {}) {
  return mount(SlashCommandPanel, {
    props: {
      entries: overrides.entries ?? entries,
      activeIndex: overrides.activeIndex ?? 0,
      label: 'Slash commands',
    },
    global: { plugins: [i18n] },
  });
}

describe('SlashCommandPanel', () => {
  it('lists every entry it is given', () => {
    const wrapper = mountPanel();

    expect(wrapper.findAll('[role="option"]')).toHaveLength(2);
    expect(wrapper.get('[data-testid="slash-option-clear"]').text()).toContain('/clear');
    expect(wrapper.get('[data-testid="slash-option-trip-itinerary"]').text()).toContain('Trip itinerary');
  });

  it('marks only the active row as selected', () => {
    const wrapper = mountPanel({ activeIndex: 1 });

    expect(wrapper.get('[data-testid="slash-option-trip-itinerary"]').attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[data-testid="slash-option-clear"]').attributes('aria-selected')).toBe('false');
  });

  it('emits the index of a clicked row', async () => {
    const wrapper = mountPanel();

    await wrapper.get('[data-testid="slash-option-trip-itinerary"]').trigger('click');

    expect(wrapper.emitted('select')?.[0]).toEqual([1]);
  });

  it('emits the index of a hovered row', async () => {
    const wrapper = mountPanel();

    await wrapper.get('[data-testid="slash-option-trip-itinerary"]').trigger('mouseenter');

    expect(wrapper.emitted('hover')?.[0]).toEqual([1]);
  });

  it('renders nothing without entries', () => {
    expect(mountPanel({ entries: [] }).find('[data-testid="slash-panel"]').exists()).toBe(false);
  });
});
