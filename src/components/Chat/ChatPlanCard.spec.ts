import { i18n } from '@/i18n';
import type { PlanItem } from '@/config/sessions';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ChatPlanCard from './ChatPlanCard.vue';

function mountCard(items?: PlanItem[]) {
  return mount(ChatPlanCard, { props: { items }, global: { plugins: [i18n] } });
}

const items: PlanItem[] = [
  { id: 'p1', content: 'Draft the plan', status: 'completed' },
  { id: 'p2', content: 'Ship it', status: 'in_progress' },
  { id: 'p3', content: 'Wait for review', status: 'pending' },
];

const done: PlanItem[] = [
  { id: 'p1', content: 'Draft the plan', status: 'completed' },
  { id: 'p2', content: 'Ship it', status: 'completed' },
];

describe('ChatPlanCard', () => {
  it('renders nothing until there is a plan', () => {
    expect(mountCard().find('[data-testid="chat-plan-card"]').exists()).toBe(false);
    expect(mountCard([]).find('[data-testid="chat-plan-card"]').exists()).toBe(false);
  });

  it('lists each item through the shared plan-item row', () => {
    const card = mountCard(items);
    const rows = card.findAll('[data-testid="plan-item"]');

    expect(rows).toHaveLength(3);
    expect(card.text()).toContain('Draft the plan');
    expect(card.text()).toContain('Completed');
    expect(card.text()).toContain('In progress');
    expect(card.text()).toContain('Pending');
  });

  it('keeps the raw wording for a status this build does not know', () => {
    const card = mountCard([{ id: 'p1', content: 'Wait', status: 'awaiting_review' }]);

    expect(card.text()).toContain('awaiting_review');
  });

  it('strikes a completed item through and spins the one in flight', () => {
    const card = mountCard(items);

    expect(card.get('.line-through').text()).toBe('Draft the plan');
    expect(card.findAll('[data-testid="plan-item"]')[1]?.find('.animate-spin').exists()).toBe(true);
  });

  it('counts the plan in the footer', () => {
    const card = mountCard(items);

    expect(card.get('[data-testid="chat-plan-footer"]').text()).toBe('3 items · 1 completed · 1 in progress · 1 pending');
  });

  it('names every state it counts, cancelled included', () => {
    const card = mountCard([
      { id: 'p1', content: 'Draft', status: 'completed' },
      { id: 'p2', content: 'Dropped', status: 'cancelled' },
      { id: 'p3', content: 'Dropped too', status: 'cancelled' },
      { id: 'p4', content: 'Later', status: 'pending' },
    ]);

    expect(card.get('[data-testid="chat-plan-footer"]').text()).toBe('4 items · 1 completed · 1 pending · 2 cancelled');
  });

  it('leaves a status it does not know out of the tally, without losing it from the rows', () => {
    const card = mountCard([
      { id: 'p1', content: 'Draft', status: 'completed' },
      { id: 'p2', content: 'Wait', status: 'awaiting_review' },
    ]);

    expect(card.get('[data-testid="chat-plan-footer"]').text()).toBe('2 items · 1 completed');
    expect(card.text()).toContain('awaiting_review');
  });

  it('folds itself away once every item is done', async () => {
    const card = mountCard(items);
    expect(card.find('[data-testid="chat-plan-body"]').exists()).toBe(true);

    await card.setProps({ items: done });

    expect(card.find('[data-testid="chat-plan-body"]').exists()).toBe(false);
    expect(card.get('[data-testid="chat-plan-footer"]').text()).toBe('2 items · all completed');
  });

  it('opens again when the next plan puts an item in flight', async () => {
    const card = mountCard(done);
    expect(card.find('[data-testid="chat-plan-body"]').exists()).toBe(false);

    await card.setProps({
      items: [
        { id: 'n1', content: 'Next', status: 'in_progress' },
        { id: 'n2', content: 'After that', status: 'pending' },
      ],
    });

    expect(card.find('[data-testid="chat-plan-body"]').exists()).toBe(true);
  });

  it('stays folded when the user folded it and nothing new is in flight', async () => {
    const card = mountCard(items);

    await card.get('[data-testid="chat-plan-toggle"]').trigger('click');
    expect(card.find('[data-testid="chat-plan-body"]').exists()).toBe(false);

    await card.setProps({ items: [...items, { id: 'p4', content: 'Later still', status: 'pending' }] });

    expect(card.find('[data-testid="chat-plan-body"]').exists()).toBe(false);
  });

  it('opens and closes on the header', async () => {
    const card = mountCard(items);

    await card.get('[data-testid="chat-plan-toggle"]').trigger('click');
    expect(card.find('[data-testid="chat-plan-body"]').exists()).toBe(false);

    await card.get('[data-testid="chat-plan-toggle"]').trigger('click');
    expect(card.find('[data-testid="chat-plan-body"]').exists()).toBe(true);
  });

  it('points the header at the body it opens, for assistive technology', () => {
    const card = mountCard(items);
    const controls = card.get('[data-testid="chat-plan-toggle"]').attributes('aria-controls');

    expect(controls).toBeTruthy();
    expect(card.get('[data-testid="chat-plan-body"]').attributes('id')).toBe(controls);
  });
});
