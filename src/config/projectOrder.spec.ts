import { describe, expect, it } from 'vitest';
import { movedOrder, orderProjects, parseProjectOrder, toProjectOrderValue } from './projectOrder';

const projects = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('parseProjectOrder', () => {
  it('reads the ids out of the stored value', () => {
    expect(parseProjectOrder({ order: ['c', 'a', 'b'] })).toEqual(['c', 'a', 'b']);
  });

  it('drops entries that are not usable ids without losing the rest', () => {
    expect(parseProjectOrder({ order: ['c', '', 7, null, 'a'] })).toEqual(['c', 'a']);
  });

  it('reports nothing for a missing or malformed value', () => {
    expect(parseProjectOrder(undefined)).toBeUndefined();
    expect(parseProjectOrder(null)).toBeUndefined();
    expect(parseProjectOrder('c,a')).toBeUndefined();
    expect(parseProjectOrder({})).toBeUndefined();
    expect(parseProjectOrder({ order: 'c' })).toBeUndefined();
  });
});

describe('toProjectOrderValue', () => {
  it('wraps the ids in the object the config API stores', () => {
    expect(toProjectOrderValue(['c', 'a'])).toEqual({ order: ['c', 'a'] });
  });
});

describe('orderProjects', () => {
  it('follows the stored order', () => {
    expect(orderProjects(projects, ['c', 'a', 'b']).map((project) => project.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps the incoming order when nothing is stored', () => {
    expect(orderProjects(projects, []).map((project) => project.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts projects the order does not know after the ones it does, in their incoming order', () => {
    expect(orderProjects(projects, ['c']).map((project) => project.id)).toEqual(['c', 'a', 'b']);
  });

  it('ignores ids that no longer name a project', () => {
    expect(orderProjects(projects, ['gone', 'b', 'a']).map((project) => project.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the list it was given', () => {
    const input = [...projects];
    orderProjects(input, ['c', 'b', 'a']);
    expect(input).toEqual(projects);
  });
});

describe('movedOrder', () => {
  it('moves an id down to the dropped position', () => {
    expect(movedOrder(projects, 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('moves an id up to the dropped position', () => {
    expect(movedOrder(projects, 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('reports nothing for a no-op or an out-of-range move', () => {
    expect(movedOrder(projects, 1, 1)).toBeUndefined();
    expect(movedOrder(projects, -1, 1)).toBeUndefined();
    expect(movedOrder(projects, 0, 3)).toBeUndefined();
  });

  it('reports nothing when a project carries no id to store', () => {
    expect(movedOrder([{ id: 'a' }, {}], 0, 1)).toBeUndefined();
  });
});
