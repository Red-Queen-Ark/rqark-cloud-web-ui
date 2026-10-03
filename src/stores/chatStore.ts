import { defineStore } from 'pinia';
import type { ApiSessionDto } from '@/api';

export interface PendingTurn {
  sessionId: string;
  content: string;
  agent: string;
  provider: string;
}

export const useChatStore = defineStore('chatStore', {
  state: () => ({
    pendingTurn: null as PendingTurn | null,
    /** Titles of the sessions the sidebar has seen, keyed by session id. */
    sessionTitles: {} as Record<string, string>,
  }),
  actions: {
    setPendingTurn(turn: PendingTurn) {
      this.pendingTurn = turn;
    },
    takePendingTurn(sessionId: string): PendingTurn | null {
      if (this.pendingTurn?.sessionId !== sessionId) {
        return null;
      }
      const turn = this.pendingTurn;
      this.pendingTurn = null;
      return turn;
    },
    /** The sidebar lists whole sessions, so it republishes the titles whole. */
    setSessionTitles(sessions: ApiSessionDto[]) {
      this.sessionTitles = Object.fromEntries(sessions.filter((session) => session.id).map((session) => [session.id as string, session.title ?? '']));
    },
    setSessionTitle(sessionId: string, title: string) {
      this.sessionTitles[sessionId] = title;
    },
  },
});
