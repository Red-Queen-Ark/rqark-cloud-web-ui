import { describe, expect, it } from 'vitest';
import { MESSAGE_ROLES, PLAN_STATUSES, messageRoleStyle, planStatusStyle } from './sessions';

describe('planStatusStyle', () => {
  it('maps each known status onto its own label and badge', () => {
    const styles = PLAN_STATUSES.map((status) => planStatusStyle(status));

    expect(styles.map((style) => style.labelKey)).toEqual(['sessions.planStatus.pending', 'sessions.planStatus.inProgress', 'sessions.planStatus.completed', 'sessions.planStatus.cancelled']);
    // A shared badge would leave the states indistinguishable at a glance.
    expect(new Set(styles.map((style) => style.badgeClass)).size).toBe(4);
  });

  it.each([undefined, '', 'awaiting_review'])('falls back for %s without claiming a known label', (status) => {
    const style = planStatusStyle(status);

    // An empty labelKey is the signal to render the raw status instead.
    expect(style.labelKey).toBe('');
    expect(style.badgeClass).toBe('badge-ghost');
  });

  it('does not treat an inherited object key as a status', () => {
    // `toString` is on every object: a plain lookup would answer with a function.
    expect(planStatusStyle('toString').labelKey).toBe('');
    expect(planStatusStyle('constructor').labelKey).toBe('');
  });
});

describe('messageRoleStyle', () => {
  it('gives every role its own label', () => {
    const labels = MESSAGE_ROLES.map((role) => messageRoleStyle(role).labelKey);

    expect(labels).toEqual(['sessions.role.system', 'sessions.role.user', 'sessions.role.assistant', 'sessions.role.tool']);
    expect(new Set(labels).size).toBe(4);
  });

  it('anchors only the two roles that are sides of one exchange', () => {
    // The bubble layout is a two-party conversation; system and tool are not a
    // party to it and would be misread if pushed onto one side.
    expect(messageRoleStyle('user').placement).toBe('chat-end');
    expect(messageRoleStyle('assistant').placement).toBe('chat-start');
    expect(messageRoleStyle('system').placement).toBe('');
    expect(messageRoleStyle('tool').placement).toBe('');
  });

  it.each([undefined, '', 'developer'])('falls back for %s without claiming a label', (role) => {
    expect(messageRoleStyle(role)).toEqual({ labelKey: '', placement: '' });
  });

  it('does not treat an inherited object key as a role', () => {
    expect(messageRoleStyle('toString').labelKey).toBe('');
  });
});
