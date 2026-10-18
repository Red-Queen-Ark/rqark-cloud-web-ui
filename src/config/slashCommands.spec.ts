import type { ApiSopDto } from '@/api';
import { describe, expect, it } from 'vitest';
import { SLASH_COMMANDS, slashEntries } from './slashCommands';

const translate = (key: string) => key;

const sops: ApiSopDto[] = [
  { slug: 'trip-itinerary', title: 'Trip itinerary', content: '# Trip itinerary' },
  { slug: 'weekly-review', title: 'Weekly review', content: '# Weekly review' },
];

describe('slashEntries', () => {
  it('offers every built-in command for a bare slash', () => {
    const entries = slashEntries('/', [], translate);

    expect(entries.map((entry) => entry.name)).toEqual(SLASH_COMMANDS.map((command) => command.name));
    expect(entries.every((entry) => entry.kind === 'builtin')).toBe(true);
  });

  it('narrows both lists with startsWith', () => {
    expect(slashEntries('/t', sops, translate).map((entry) => entry.name)).toEqual(['/trip-itinerary']);
    expect(slashEntries('/s', sops, translate).map((entry) => entry.name)).toEqual(['/stop']);
    expect(slashEntries('/zzz', sops, translate)).toEqual([]);
  });

  it('lists a SOP after the built-in commands with its title', () => {
    const entries = slashEntries('/', sops, translate);

    expect(entries.slice(SLASH_COMMANDS.length)).toEqual([
      { name: '/trip-itinerary', label: 'Trip itinerary', kind: 'sop' },
      { name: '/weekly-review', label: 'Weekly review', kind: 'sop' },
    ]);
  });

  it('lets a built-in win a name clash', () => {
    const entries = slashEntries('/stop', [{ slug: 'stop', title: 'Stop it' }], translate);

    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('builtin');
  });

  it('drops a SOP without a slug', () => {
    expect(slashEntries('/', [{ title: 'No slug' }], translate)).toHaveLength(SLASH_COMMANDS.length);
  });

  it('matches case-sensitively', () => {
    expect(slashEntries('/S', sops, translate)).toEqual([]);
  });
});
