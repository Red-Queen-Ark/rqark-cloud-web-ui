import { defineStore } from 'pinia';
import type { ApiSessionDto } from '@/api';

export interface PendingTurn {
  sessionId: string;
  content: string;
  agent: string;
  provider: string;
  images?: string[];
}

export const useChatStore = defineStore('chatStore', {
  state: () => ({
    pendingTurn: null as PendingTurn | null,
    /** Titles of the sessions the sidebar has seen, keyed by session id. */
    sessionTitles: {} as Record<string, string>,
    /**
     * The agent each chat was last sent to, keyed by session id.
     *
     * The picker lives in a component that is remounted on every navigation
     * (starting a chat from the home page lands on a new one), and nothing on
     * the wire says which agent a session belongs to, so without this the
     * picker falls back to the first agent the moment a turn is submitted.
     */
    sessionAgents: {} as Record<string, string>,
  }),
  getters: {
    /** The agent a chat should come up on, from the last turn or one still in flight. */
    agentFor: (state) => (sessionId: string | undefined) => {
      if (!sessionId) {
        return undefined;
      }
      const chosen = state.sessionAgents[sessionId];
      if (chosen) {
        return chosen;
      }
      return state.pendingTurn?.sessionId === sessionId ? state.pendingTurn.agent : undefined;
    },
  },
  actions: {
    setSessionAgent(sessionId: string, agent: string) {
      this.sessionAgents[sessionId] = agent;
    },
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
