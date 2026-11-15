export const TUI_SOURCE = 'TUI';

export const AGENT_CLOUD_SOURCE = 'AGENT_CLOUD';

export const KNOWN_SESSION_SOURCES = [TUI_SOURCE, AGENT_CLOUD_SOURCE] as const;

export const SESSION_SOURCE_MAX_LENGTH = 32;

export function isKnownSessionSource(source: string): boolean {
  return (KNOWN_SESSION_SOURCES as readonly string[]).includes(source);
}
