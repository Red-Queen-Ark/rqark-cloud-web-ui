import type { ApiSopDto } from '@/api';

/** One row of the slash panel: a command or a SOP the user wrote. */
export interface SlashEntry {
  /** What the message calls it, e.g. `/clear`. */
  name: string;
  /** The line shown beside the name: a translated description, or a SOP's title. */
  label: string;
  kind: 'builtin' | 'sop';
}

/**
 * The commands the front end answers itself. They are the two that act on the
 * turn rather than sending text: stopping it, and compacting the conversation
 * behind the next one. A SOP of the same name never shadows them.
 */
export const SLASH_COMMANDS: { name: string; descriptionKey: string }[] = [
  { name: '/compact', descriptionKey: 'chat.slashCompact' },
  { name: '/stop', descriptionKey: 'chat.slashStop' },
];

/**
 * The panel's rows for a prefix: the built-in commands first, then the SOPs.
 * Both lists are filtered by `startsWith`, which is what typing another
 * character narrows.
 */
export function slashEntries(prefix: string, sops: ApiSopDto[], translate: (key: string) => string): SlashEntry[] {
  const builtin = SLASH_COMMANDS.filter((command) => command.name.startsWith(prefix)).map((command) => ({ name: command.name, label: translate(command.descriptionKey), kind: 'builtin' as const }));
  const taken = new Set(SLASH_COMMANDS.map((command) => command.name));
  const extra = sops
    .map((sop) => ({ name: `/${sop.slug ?? ''}`, label: sop.title ?? '' }))
    .filter((entry) => entry.name.length > 1 && !taken.has(entry.name) && entry.name.startsWith(prefix))
    .map((entry) => ({ ...entry, kind: 'sop' as const }));
  return [...builtin, ...extra];
}
