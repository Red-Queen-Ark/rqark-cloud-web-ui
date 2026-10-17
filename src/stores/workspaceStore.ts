import { defineStore } from 'pinia';
import { WORKSPACE_ROOT } from '@/config/workspace';

export type WorkspaceViewMode = 'list' | 'grid';

export const useWorkspaceStore = defineStore('workspaceStore', {
  state: () => ({
    path: WORKSPACE_ROOT,
    showHidden: false,
    viewMode: 'list' as WorkspaceViewMode,
  }),
  actions: {
    setPath(path: string) {
      this.path = path;
    },
    setShowHidden(showHidden: boolean) {
      this.showHidden = showHidden;
    },
    setViewMode(viewMode: WorkspaceViewMode) {
      this.viewMode = viewMode;
    },
    resetPath() {
      this.path = WORKSPACE_ROOT;
    },
  },
  persist: {
    pick: ['path', 'showHidden', 'viewMode'],
  },
});
