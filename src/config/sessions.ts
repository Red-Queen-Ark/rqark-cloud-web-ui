/**
 * Catalogue of the plan-item statuses a session can carry, and the shape the UI
 * renders them in.
 *
 * `rqark-data-cloud` stores a session's `plan_items` opaquely: it keeps
 * `{id, content, status}` as JSON and validates neither the ids nor the statuses,
 * and the API has no endpoint that lists them. The engine is therefore the only
 * source of truth, and this file mirrors it by hand.
 *
 * Mirrored from `rqark-core`'s `PlanUpdate` tool, which is also the only writer
 * of these values: an agent calls it with one of these four words and the
 * session's plan is replaced wholesale.
 *
 * Keep this list in step with that tool. A status this build does not know is
 * still shown (see `planStatusStyle`), so a session written by a newer engine
 * renders with its raw status instead of being hidden or crashing.
 */

import CheckIcon from '@/components/svg/CheckIcon.vue';
import CircleIcon from '@/components/svg/CircleIcon.vue';
import CloseIcon from '@/components/svg/CloseIcon.vue';
import SpinnerIcon from '@/components/svg/SpinnerIcon.vue';
import type { Component } from 'vue';

export interface PlanStatusStyle {
  /**
   * The glyph that carries the state. One per row is all the row shows, so the
   * icon has to be the whole signal: shape names the state, colour ranks it.
   *
   * `null` for a status this build does not know, which tells the row to print
   * the raw status instead of inventing a glyph.
   */
  icon: Component | null;
  /**
   * daisyUI text colour for `icon`. The four map onto the meaning of each
   * state: an untouched item is muted, work in flight is informative, and the
   * two terminal states are good and bad news respectively.
   */
  iconClass: string;
  /** Human wording, under `sessions.planStatus`, for the row's screen-reader label. */
  labelKey: string;
}

/** The statuses `PlanUpdate` accepts, spelled as the tool spells them. */
export const PLAN_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

const PLAN_STATUS_STYLES: Record<PlanStatus, PlanStatusStyle> = {
  pending: { icon: CircleIcon, iconClass: 'text-base-content/30', labelKey: 'sessions.planStatus.pending' },
  in_progress: { icon: SpinnerIcon, iconClass: 'text-info', labelKey: 'sessions.planStatus.inProgress' },
  completed: { icon: CheckIcon, iconClass: 'text-success', labelKey: 'sessions.planStatus.completed' },
  cancelled: { icon: CloseIcon, iconClass: 'text-error', labelKey: 'sessions.planStatus.cancelled' },
};

/**
 * A glyph, a colour and a label for `status`, falling back to the raw value.
 *
 * `icon` and `labelKey` are empty for an unknown status, which tells the caller
 * to print the status itself: showing `awaiting_review` is honest, whereas
 * mapping it onto one of the four known glyphs would invent a meaning the
 * engine never set.
 */
export function planStatusStyle(status?: string): PlanStatusStyle {
  if (status && (PLAN_STATUSES as readonly string[]).includes(status)) {
    return PLAN_STATUS_STYLES[status as PlanStatus];
  }

  return { icon: null, iconClass: 'text-base-content/40', labelKey: '' };
}

/**
 * One plan item as the UI renders it, reduced to the fields the card shows.
 *
 * The plan arrives in two shapes and this is the one they are read into: the
 * websocket pushes `{id, content, status, icon}` and `GET /sessions/{uuid}`
 * returns `plan_items` as `{id?, content?, status?}`. The `icon` the engine sets
 * is dropped: the status already names the state, and it is the richer of the
 * two — it is what `planStatusStyle` colours.
 */
export interface PlanItem {
  id: string;
  content: string;
  status: string;
}

/**
 * Reads either stored shape into `PlanItem`s.
 *
 * An entry with no content has nothing to show and is dropped, the same call the
 * agent picker makes for a nameless component. An entry with no id falls back to
 * its position, so the list still has a stable key to render against. An entry
 * with no status keeps an empty one, which `planStatusStyle` renders as the raw
 * (empty) word rather than a state the engine never set.
 */
export function planItemsFrom(items?: { id?: string; content?: string; status?: string }[]): PlanItem[] {
  return (items ?? []).flatMap((item, index) => (typeof item.content === 'string' && item.content !== '' ? [{ id: item.id ?? String(index), content: item.content, status: item.status ?? '' }] : []));
}
