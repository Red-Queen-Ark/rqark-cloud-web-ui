import { describe, expect, it } from 'vitest';
import { PLAN_STATUSES, planItemsFrom, planStatusStyle } from './sessions';

describe('planStatusStyle', () => {
  it('maps each known status onto its own glyph, colour and label', () => {
    const styles = PLAN_STATUSES.map((status) => planStatusStyle(status));

    expect(styles.map((style) => style.labelKey)).toEqual(['sessions.planStatus.pending', 'sessions.planStatus.inProgress', 'sessions.planStatus.completed', 'sessions.planStatus.cancelled']);
    // A shared colour would leave the states indistinguishable at a glance.
    expect(new Set(styles.map((style) => style.iconClass)).size).toBe(4);
    // Every known status draws something.
    expect(styles.every((style) => style.icon)).toBe(true);
  });

  it.each([undefined, '', 'awaiting_review'])('falls back for %s without claiming a known glyph', (status) => {
    const style = planStatusStyle(status);

    // An empty icon is the signal to render the raw status instead.
    expect(style.icon).toBeNull();
    expect(style.labelKey).toBe('');
    expect(style.iconClass).toBe('text-base-content/40');
  });

  it('does not treat an inherited object key as a status', () => {
    // `toString` is on every object: a plain lookup would answer with a function.
    expect(planStatusStyle('toString').labelKey).toBe('');
    expect(planStatusStyle('constructor').labelKey).toBe('');
  });
});

describe('planItemsFrom', () => {
  it('reads the fields the card needs, and gives an item with no id one from its position', () => {
    expect(
      planItemsFrom([
        { content: 'Draft the plan', status: 'completed' },
        { id: 'p2', content: 'Ship it', status: 'pending' },
      ]),
    ).toEqual([
      { id: '0', content: 'Draft the plan', status: 'completed' },
      { id: 'p2', content: 'Ship it', status: 'pending' },
    ]);
  });

  it('clears when there is nothing to show', () => {
    expect(planItemsFrom(undefined)).toEqual([]);
    expect(planItemsFrom([])).toEqual([]);
  });

  it('drops an entry with no content, which has nothing to render', () => {
    expect(
      planItemsFrom([
        { id: 'p1', content: '', status: 'pending' },
        { id: 'p2', status: 'pending' },
      ]),
    ).toEqual([]);
  });

  it('keeps an entry with no status rather than inventing one', () => {
    expect(planItemsFrom([{ id: 'p1', content: 'No status' }])).toEqual([{ id: 'p1', content: 'No status', status: '' }]);
  });
});
