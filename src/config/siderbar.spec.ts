import { describe, expect, it } from 'vitest';
import { groupManageSiderItems, manageSiderGroups, manageSiderItemFor, manageSiderItems } from './manageSiderbar';
import { siderItemFor } from './siderbar';

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

describe('manageSiderItems', () => {
  it('lists the console pages once each', () => {
    const ids = manageSiderItems.map((item) => item.pageId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('agents');
    expect(ids).toContain('manageSettings');
  });

  it('keeps the account pages to superusers', () => {
    expect(manageSiderItems.find((item) => item.pageId === 'users')?.superuserOnly).toBe(true);
    expect(manageSiderItems.find((item) => item.pageId === 'groups')?.superuserOnly).toBe(true);
    expect(manageSiderItems.find((item) => item.pageId === 'agents')?.superuserOnly).toBeUndefined();
  });
});

describe('manageSiderItemFor', () => {
  it('names the list a detail page was opened from', () => {
    expect(manageSiderItemFor('sessionDetail')?.pageId).toBe('sessions');
    expect(manageSiderItemFor('memoryDetail')?.pageId).toBe('memory');
  });

  it('leaves the main navigation alone', () => {
    expect(manageSiderItemFor('tasks')).toBeUndefined();
  });
});

describe('groupManageSiderItems', () => {
  it('files every entry under a declared heading', () => {
    const keys = manageSiderGroups.map((group) => group.key);

    for (const item of manageSiderItems) {
      expect(keys).toContain(item.group);
    }
  });

  it('keeps the declared heading order and the entry order inside it', () => {
    const sections = groupManageSiderItems(manageSiderItems);

    expect(sections.map((section) => section.group.key)).toEqual(['overview', 'agents', 'memory', 'operations', 'access', 'system']);
    expect(sections.find((section) => section.group.key === 'memory')?.items.map((item) => item.pageId)).toEqual(['memory', 'agentState']);
  });

  it('drops a heading whose entries were all filtered out', () => {
    const withoutAccounts = manageSiderItems.filter((item) => item.superuserOnly !== true);
    const keys = groupManageSiderItems(withoutAccounts).map((section) => section.group.key);

    expect(keys).not.toContain('access');
  });
});
