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

export interface PlanStatusStyle {
  /** Human wording, under `sessions.planStatus`. */
  labelKey: string;
  /**
   * daisyUI badge modifier. The four map onto the meaning of each state: an
   * untouched item is muted, work in flight is informative, and the two
   * terminal states are good and bad news respectively.
   */
  badgeClass: string;
}

/** The statuses `PlanUpdate` accepts, spelled as the tool spells them. */
export const PLAN_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

const PLAN_STATUS_STYLES: Record<PlanStatus, PlanStatusStyle> = {
  pending: { labelKey: 'sessions.planStatus.pending', badgeClass: 'badge-ghost' },
  in_progress: { labelKey: 'sessions.planStatus.inProgress', badgeClass: 'badge-info' },
  completed: { labelKey: 'sessions.planStatus.completed', badgeClass: 'badge-success' },
  cancelled: { labelKey: 'sessions.planStatus.cancelled', badgeClass: 'badge-error' },
};

/**
 * A badge and a label for `status`, falling back to the raw value.
 *
 * `labelKey` is empty for an unknown status, which tells the caller to print the
 * status itself: showing `awaiting_review` is honest, whereas mapping it onto
 * one of the four known styles would invent a meaning the engine never set.
 */
export function planStatusStyle(status?: string): PlanStatusStyle {
  if (status && (PLAN_STATUSES as readonly string[]).includes(status)) {
    return PLAN_STATUS_STYLES[status as PlanStatus];
  }

  return { labelKey: '', badgeClass: 'badge-ghost' };
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
