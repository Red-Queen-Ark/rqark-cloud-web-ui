/**
 * Catalogue of the plan-item statuses a session can carry.
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
 * Catalogue of the roles a message can carry.
 *
 * Mirrored from `rqark-core`, which builds each message with one of these four
 * words. As with the statuses above, a role this build does not know is shown
 * rather than hidden or guessed at.
 */
export const MESSAGE_ROLES = ['system', 'user', 'assistant', 'tool'] as const;

export type MessageRole = (typeof MESSAGE_ROLES)[number];

export interface MessageRoleStyle {
  /** Human wording, under `sessions.role`. */
  labelKey: string;
  /**
   * daisyUI chat placement, or empty when the role is not a speaker turn.
   *
   * A bubble is anchored to one side or the other, which reads as "who said
   * this". Only `user` and `assistant` are two sides of one exchange; `system`
   * and `tool` are neither, so they are laid out as a block of their own
   * instead of being pushed onto a side they do not belong to.
   */
  placement: string;
}

const MESSAGE_ROLE_STYLES: Record<MessageRole, MessageRoleStyle> = {
  system: { labelKey: 'sessions.role.system', placement: '' },
  user: { labelKey: 'sessions.role.user', placement: 'chat-end' },
  assistant: { labelKey: 'sessions.role.assistant', placement: 'chat-start' },
  tool: { labelKey: 'sessions.role.tool', placement: '' },
};

export function messageRoleStyle(role?: string): MessageRoleStyle {
  if (role && (MESSAGE_ROLES as readonly string[]).includes(role)) {
    return MESSAGE_ROLE_STYLES[role as MessageRole];
  }

  return { labelKey: '', placement: '' };
}
