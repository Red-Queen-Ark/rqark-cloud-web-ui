import { i18n } from '@/i18n';
import type { PlanItem as PlanItemData } from '@/config/sessions';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PlanItem from './PlanItem.vue';

function mountItem(item: PlanItemData) {
  return mount(PlanItem, { props: { item }, global: { plugins: [i18n] } });
}

describe('PlanItem', () => {
  it('renders the content with the wording for a known status', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Draft the plan', status: 'completed' });

    expect(wrapper.get('[data-testid="plan-item"]').text()).toContain('Draft the plan');
    expect(wrapper.text()).toContain('Completed');
  });

  it('carries the state on a single glyph rather than a badge', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Later', status: 'pending' });

    expect(wrapper.find('[data-testid="plan-item-icon"]').exists()).toBe(true);
    expect(wrapper.find('.badge').exists()).toBe(false);
  });

  it('colours each state differently', () => {
    const colours = (['pending', 'in_progress', 'completed', 'cancelled'] as const).map((status) => mountItem({ id: 'p1', content: 'x', status }).get('[data-testid="plan-item-icon"]').classes().join(' '));

    expect(new Set(colours).size).toBe(4);
  });

  it('keeps the raw status wording, in place of a glyph, when the status is unknown', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Wait for review', status: 'awaiting_review' });

    expect(wrapper.text()).toContain('awaiting_review');
    expect(wrapper.find('[data-testid="plan-item-icon"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="plan-item-raw-status"]').exists()).toBe(true);
  });

  it('marks a completed item as struck through', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Done', status: 'completed' });

    expect(wrapper.get('.line-through').text()).toBe('Done');
  });

  it('spins the item the engine is working on', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Busy', status: 'in_progress' });

    expect(wrapper.get('[data-testid="plan-item-icon"]').classes()).toContain('animate-spin');
    expect(wrapper.find('.line-through').exists()).toBe(false);
    expect(wrapper.text()).toContain('In progress');
  });

  it('leaves an item that is only pending unstruck and still', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Later', status: 'pending' });

    expect(wrapper.get('[data-testid="plan-item-icon"]').classes()).not.toContain('animate-spin');
    expect(wrapper.find('.line-through').exists()).toBe(false);
    expect(wrapper.text()).toContain('Pending');
  });

  it('dims a cancelled item without claiming it was done', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Dropped', status: 'cancelled' });

    expect(wrapper.get('[data-testid="plan-item"]').text()).toContain('Dropped');
    expect(wrapper.text()).toContain('Cancelled');
    expect(wrapper.find('.line-through').exists()).toBe(false);
  });

  it('keeps a bare item unadorned when the status is missing', () => {
    const wrapper = mountItem({ id: 'p1', content: 'No status', status: '' });

    expect(wrapper.find('[data-testid="plan-item-icon"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No status');
  });
});
