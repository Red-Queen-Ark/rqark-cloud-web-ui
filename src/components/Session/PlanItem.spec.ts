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

  it('keeps the raw status wording when the status is unknown', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Wait for review', status: 'awaiting_review' });

    expect(wrapper.text()).toContain('awaiting_review');
  });

  it('marks a completed item as struck through', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Done', status: 'completed' });

    expect(wrapper.get('.line-through').text()).toBe('Done');
  });

  it('spins the item the engine is working on', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Busy', status: 'in_progress' });

    expect(wrapper.find('.loading').exists()).toBe(true);
    expect(wrapper.find('.line-through').exists()).toBe(false);
    expect(wrapper.text()).toContain('In progress');
  });

  it('leaves an item that is only pending unstruck and still', () => {
    const wrapper = mountItem({ id: 'p1', content: 'Later', status: 'pending' });

    expect(wrapper.find('.loading').exists()).toBe(false);
    expect(wrapper.find('.line-through').exists()).toBe(false);
    expect(wrapper.text()).toContain('Pending');
  });

  it('falls back to an empty badge when the status is missing', () => {
    const wrapper = mountItem({ id: 'p1', content: 'No status', status: '' });

    expect(wrapper.get('.badge').classes()).toContain('badge-ghost');
    expect(wrapper.text()).toContain('No status');
  });
});
