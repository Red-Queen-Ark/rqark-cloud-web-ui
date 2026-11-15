import { describe, expect, it } from 'vitest';
import { AGENT_CLOUD_SOURCE, KNOWN_SESSION_SOURCES, SESSION_SOURCE_MAX_LENGTH, TUI_SOURCE, isKnownSessionSource } from './sessionSources';

describe('isKnownSessionSource', () => {
  it('knows the sources the apps stamp', () => {
    for (const source of KNOWN_SESSION_SOURCES) {
      expect(isKnownSessionSource(source)).toBe(true);
    }
  });

  it.each(['', 'tui', 'Agent_Cloud', 'SOMETHING_ELSE'])('does not claim %s', (source) => {
    expect(isKnownSessionSource(source)).toBe(false);
  });

  it('does not treat an inherited object key as a source', () => {
    expect(isKnownSessionSource('toString')).toBe(false);
  });

  it('spells the sources the way the apps do', () => {
    expect(TUI_SOURCE).toBe('TUI');
    expect(AGENT_CLOUD_SOURCE).toBe('AGENT_CLOUD');
    expect(KNOWN_SESSION_SOURCES).toEqual([TUI_SOURCE, AGENT_CLOUD_SOURCE]);
  });

  it('offers the source this UI writes on its own behalf', () => {
    expect(isKnownSessionSource(AGENT_CLOUD_SOURCE)).toBe(true);
  });

  it('matches the backend column width', () => {
    expect(SESSION_SOURCE_MAX_LENGTH).toBe(32);
  });
});
