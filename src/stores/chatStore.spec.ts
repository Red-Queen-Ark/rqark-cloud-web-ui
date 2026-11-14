import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from './chatStore';

describe('chatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('hands the pending turn to the session it was written for', () => {
    const store = useChatStore();
    store.setPendingTurn({ sessionId: 'session-a', content: 'hello', agent: 'researcher', provider: 'openai' });

    expect(store.takePendingTurn('session-a')).toEqual({ sessionId: 'session-a', content: 'hello', agent: 'researcher', provider: 'openai' });
    // Taken once: a remount must not send the same turn again.
    expect(store.takePendingTurn('session-a')).toBeNull();
  });

  it('keeps a pending turn away from another session', () => {
    const store = useChatStore();
    store.setPendingTurn({ sessionId: 'session-a', content: 'hello', agent: 'researcher', provider: 'openai' });

    expect(store.takePendingTurn('session-b')).toBeNull();
    expect(store.pendingTurn).toEqual({ sessionId: 'session-a', content: 'hello', agent: 'researcher', provider: 'openai' });
  });

  it('publishes the titles of the listed sessions', () => {
    const store = useChatStore();
    store.setSessionTitles([{ id: 'session-a', title: 'First chat' }, { id: 'session-b', title: '' }, { title: 'no id, so nowhere to put it' }]);

    expect(store.sessionTitles).toEqual({ 'session-a': 'First chat', 'session-b': '' });
  });

  it('drops a title the caller no longer lists', () => {
    const store = useChatStore();
    store.setSessionTitles([{ id: 'session-a', title: 'First chat' }]);
    store.setSessionTitles([{ id: 'session-b', title: 'Second chat' }]);

    expect(store.sessionTitles).toEqual({ 'session-b': 'Second chat' });
  });

  it('keeps a draft under the session it was typed in', () => {
    const store = useChatStore();
    store.setDraft('session-a', 'half a thought');
    store.setDraft('session-b', 'another');

    expect(store.sessionDrafts).toEqual({ 'session-a': 'half a thought', 'session-b': 'another' });
  });

  it('drops the draft when the text is blank', () => {
    const store = useChatStore();
    store.setDraft('session-a', 'half a thought');

    store.setDraft('session-a', '   ');

    expect(store.sessionDrafts).toEqual({});
  });

  it('forgets a draft the caller clears', () => {
    const store = useChatStore();
    store.setDraft('session-a', 'half a thought');

    store.clearDraft('session-a');

    expect(store.sessionDrafts).toEqual({});
  });
});
