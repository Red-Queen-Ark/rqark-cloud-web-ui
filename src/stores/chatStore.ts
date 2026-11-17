import { defineStore } from 'pinia';
import type { ApiSessionDto } from '@/api';

export interface PendingTurn {
  sessionId: string;
  content: string;
  agent: string;
  provider: string;
  images?: string[];
  /** The project the session was started in, when the home page had one picked. */
  projectId?: string | null;
}

export const useChatStore = defineStore('chatStore', {
  state: () => ({
    pendingTurn: null as PendingTurn | null,
    /** Titles of the sessions the sidebar has seen, keyed by session id. */
    sessionTitles: {} as Record<string, string>,
    /**
     * The project each chat works in, keyed by session id; null for a session
     * with none.
     *
     * Filled from the same listing the sidebar reads, so the picker above the
     * chat input knows the session's project without a request of its own. The
     * key is present only for sessions the listing carried.
     */
    sessionProjects: {} as Record<string, string | null>,
    /**
     * The agent each chat was last sent to, keyed by session id.
     *
     * The picker lives in a component that is remounted on every navigation
     * (starting a chat from the home page lands on a new one), so a turn sent
     * during this page load is recorded here to bring the picker back to the
     * agent it used. A session this page load has not talked to yet comes up on
     * the agent the cloud stored for it, which the chat socket reads.
     */
    sessionAgents: {} as Record<string, string>,
    /**
     * The unsent composer text each chat is holding, keyed by session id.
     *
     * Kept in the store rather than in the input itself because the page is
     * reused across sessions and reloaded freely; a chat that is left and
     * reopened should still have what was being written in it. Attachments
     * are not kept, only text.
     */
    sessionDrafts: {} as Record<string, string>,
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
    /** Records what is typed in a chat; blank text drops the draft. */
    setDraft(sessionId: string, text: string) {
      if (text.trim() === '') {
        Reflect.deleteProperty(this.sessionDrafts, sessionId);
        return;
      }
      this.sessionDrafts[sessionId] = text;
    },
    clearDraft(sessionId: string) {
      Reflect.deleteProperty(this.sessionDrafts, sessionId);
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
    /** The sidebar lists whole sessions, so it republishes the projects whole. */
    setSessionProjects(sessions: ApiSessionDto[]) {
      this.sessionProjects = Object.fromEntries(sessions.filter((session) => session.id).map((session) => [session.id as string, session.project_id ?? null]));
    },
    /**
     * Records a project change on one session. The engine reads the stored
     * value on the next turn, so this only keeps the picker in step: the
     * session itself keeps working in the old directory until then.
     */
    setSessionProject(sessionId: string, projectId: string | null) {
      this.sessionProjects[sessionId] = projectId;
    },
  },
  // Only the drafts outlive a reload: the rest is rebuilt from the server, and
  // a pending turn is a one-shot handoff that must not be replayed.
  persist: { pick: ['sessionDrafts'] },
});
