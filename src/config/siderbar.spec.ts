import { describe, expect, it } from 'vitest';
import { siderItemsFor, siderItemFor } from './siderbar';

describe('siderItemFor', () => {
  it('matches a page by its own route name', () => {
    expect(siderItemFor('tasks')?.pageId).toBe('tasks');
  });

  it('matches a detail route to the entry it belongs to', () => {
    expect(siderItemFor('taskDetail')?.pageId).toBe('tasks');
    expect(siderItemFor('taskSession')?.pageId).toBe('tasks');
  });

  it('returns nothing for a route that is not a navigation entry', () => {
    expect(siderItemFor('chat')).toBeUndefined();
    expect(siderItemFor(undefined)).toBeUndefined();
  });
});

describe('siderItemsFor', () => {
  it('keeps the console entry in its own block', () => {
    const manage = siderItemsFor('manage');

    expect(manage.map((item) => item.pageId)).toEqual(['manage']);
    expect(manage[0].superuserOnly).toBe(true);
  });

  it('treats an entry without a section as a main entry', () => {
    const main = siderItemsFor('main').map((item) => item.pageId);

    expect(main).toContain('workspace');
    expect(main).toContain('settings');
    expect(main).not.toContain('manage');
  });
});
