import { defineStore } from 'pinia';
import { getProjects, type ApiProjectDto } from '@/api';

/**
 * The user's projects, kept in one place because two components read them: the
 * sidebar tree and the project picker above the chat input.
 *
 * The list is not persisted. Projects live in the data cloud and a stale copy
 * would offer a project that no longer exists, which is worse than one extra
 * request at boot.
 */
export const useProjectStore = defineStore('projectStore', {
  state: () => ({
    projects: [] as ApiProjectDto[],
    /** Whether a load has finished at least once, so an empty list can be trusted. */
    loaded: false,
  }),
  getters: {
    /** Projects newest first, the order the endpoint returns them in. */
    sorted: (state): ApiProjectDto[] => state.projects,
    byId:
      (state) =>
      (id?: string | null): ApiProjectDto | undefined =>
        id ? state.projects.find((project) => project.id === id) : undefined,
    nameOf:
      (state) =>
      (id?: string | null): string =>
        id ? (state.projects.find((project) => project.id === id)?.project_name ?? '') : '',
  },
  actions: {
    /**
     * Replaces the whole list with what the cloud has. A failure leaves the
     * previous list in place: a project that was there a second ago is a better
     * guess than an empty picker.
     */
    setProjects(projects: ApiProjectDto[]) {
      this.projects = projects;
      this.loaded = true;
    },
    async load() {
      // A failed load is not fatal anywhere: the sidebar keeps whatever it had
      // and the picker falls back to "no project", so the error is swallowed
      // rather than surfacing as an unhandled rejection in whichever component
      // asked first.
      try {
        const { data } = await getProjects();
        if (data) {
          this.setProjects(data);
        }
      } catch {
        // See above.
      }
      return this.projects;
    },
  },
});
