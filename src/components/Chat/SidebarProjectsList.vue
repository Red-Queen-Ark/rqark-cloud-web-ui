<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <li class="project-group min-w-0" data-testid="sidebar-projects">
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="text-base-content/70 hover:text-base-content flex min-w-0 flex-1 items-center gap-1 px-3 py-1.5 text-xs font-semibold tracking-wide uppercase"
        :aria-expanded="expanded"
        data-testid="sidebar-projects-toggle"
        @click="expanded = !expanded"
      >
        <ChevronRightIcon class="h-3 w-3 shrink-0 transition-transform" :class="{ 'rotate-90': expanded }" />
        <span class="truncate">{{ t('projects.title') }}</span>
        <span v-if="projects.length > 0" class="text-base-content/40 shrink-0 tabular-nums">{{ projects.length }}</span>
      </button>
      <RowActionsMenu :label="t('projects.more')" trigger-test-id="sidebar-projects-menu-button" menu-test-id="sidebar-projects-menu" :trigger-class="headerTriggerClass">
        <li>
          <button data-testid="sidebar-project-create" @click="openCreate">
            <PlusIcon class="h-3 w-3" />
            {{ t('projects.create') }}
          </button>
        </li>
      </RowActionsMenu>
    </div>

    <ul v-if="expanded" class="min-w-0" data-testid="sidebar-project-list">
      <li v-if="projects.length === 0" class="text-base-content/50 px-3 py-1 text-xs">{{ t('projects.empty') }}</li>
      <li v-for="project in projects" :key="project.id" class="min-w-0" :data-testid="`sidebar-project-${project.id}`">
        <div class="group flex min-w-0 items-center gap-1">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-1.5 text-left text-sm" :aria-expanded="isOpen(project.id)" :data-testid="`sidebar-project-toggle-${project.id}`" @click="toggle(project.id)">
            <ChevronRightIcon class="text-base-content/40 h-3 w-3 shrink-0 transition-transform" :class="{ 'rotate-90': isOpen(project.id) }" />
            <FolderIcon class="text-primary h-3.5 w-3.5 shrink-0" />
            <span class="truncate">{{ project.project_name }}</span>
            <span class="text-base-content/40 ml-auto shrink-0 text-xs tabular-nums">{{ sessionsOf(project.id).length }}</span>
          </button>
          <RowActionsMenu :label="t('projects.more')" :trigger-test-id="`sidebar-project-menu-button-${project.id}`" :menu-test-id="`sidebar-project-menu-${project.id}`" :trigger-class="triggerClass">
            <li>
              <button :data-testid="`sidebar-project-rename-${project.id}`" @click="openRename(project)">
                <PencilIcon class="h-3 w-3" />
                {{ t('projects.rename') }}
              </button>
            </li>
            <li>
              <button :data-testid="`sidebar-project-delete-${project.id}`" class="text-error" @click="confirmingDelete = project">
                <TrashIcon class="h-3 w-3" />
                {{ t('projects.delete') }}
              </button>
            </li>
          </RowActionsMenu>
        </div>

        <ul v-if="isOpen(project.id)" class="min-w-0" :data-testid="`sidebar-project-sessions-${project.id}`">
          <li v-if="sessionsOf(project.id).length === 0">
            <!-- An empty project offers its one useful action instead of saying
                 it is empty: the chat it starts is already filed here. -->
            <RouterLink :to="{ name: 'home', params: { lang }, query: { project: project.id } }" class="text-base-content/60" :data-testid="`sidebar-project-new-session-${project.id}`">
              <PlusIcon class="h-4 w-4" />
              {{ t('chat.newSession') }}
            </RouterLink>
          </li>
          <SidebarSessionRow v-for="session in sessionsOf(project.id)" :key="session.id" :session="session" :lang="lang" :active="isActive(session)" @deleted="emit('deleted', $event)" @renamed="rename" />
        </ul>
      </li>
    </ul>

    <Teleport to="body">
      <ProjectFormModal v-if="creating || renaming" :project="renaming" :saving="saving" :server-error="serverError" @confirm="save" @cancel="closeForm" />
      <FormModal
        v-if="confirmingDelete"
        :title="t('projects.deleteTitle', { name: confirmingDelete.project_name })"
        :description="t('projects.deleteDescription')"
        :confirm-label="t('projects.delete')"
        :cancel-label="t('projects.cancel')"
        confirm-class="btn-error"
        :saving="deleting"
        @confirm="remove"
        @cancel="confirmingDelete = null"
      />
    </Teleport>
  </li>
</template>

<script setup lang="ts">
import { deleteProjectsByUuid, postProjects, putProjectsByUuid, type ApiProjectDto, type ApiSessionDto } from '@/api';
import FormModal from '@/components/FormModal.vue';
import RowActionsMenu from '@/components/RowActionsMenu.vue';
import ChevronRightIcon from '@/components/svg/ChevronRightIcon.vue';
import FolderIcon from '@/components/svg/FolderIcon.vue';
import PencilIcon from '@/components/svg/PencilIcon.vue';
import PlusIcon from '@/components/svg/PlusIcon.vue';
import TrashIcon from '@/components/svg/TrashIcon.vue';
import { useApiError } from '@/composables/useApiError';
import { useAlertStore } from '@/stores/alertStore';
import { useProjectStore } from '@/stores/projectStore';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ProjectFormModal from './ProjectFormModal.vue';
import SidebarSessionRow from './SidebarSessionRow.vue';

const props = defineProps<{
  sessions: ApiSessionDto[];
  lang: string;
  activeSessionId?: string;
}>();

const emit = defineEmits<{ deleted: [id: string] }>();

const { t } = useI18n();
const alertStore = useAlertStore();
const apiError = useApiError();
const projectStore = useProjectStore();

/**
 * The group starts closed. Chat is what people came for, and an unfamiliar
 * section above it that pushes their sessions down is a worse first impression
 * than one extra click.
 */
const expanded = ref(false);
/**
 * The projects the user closed, which is the smaller map: a project's chats are
 * showing unless it was shut, so one click on the group reaches a conversation.
 */
const closed = ref<Record<string, boolean>>({});

const projects = computed(() => projectStore.projects);

function isOpen(id?: string): boolean {
  return id ? closed.value[id] !== true : false;
}

function toggle(id?: string) {
  if (!id) {
    return;
  }
  closed.value = { ...closed.value, [id]: isOpen(id) };
}

function sessionsOf(projectId?: string): ApiSessionDto[] {
  if (!projectId) {
    return [];
  }
  return props.sessions.filter((session) => session.project_id === projectId);
}

function rename(id: string, title: string) {
  const session = props.sessions.find((candidate) => candidate.id === id);
  if (session) {
    session.title = title;
  }
}

function isActive(session: ApiSessionDto): boolean {
  return Boolean(session.id) && session.id === props.activeSessionId;
}

/**
 * The section's own action is always visible: there is no row to hover, and a
 * control that only appears on hover has nothing to reveal it in a list this
 * tall.
 */
const headerTriggerClass = 'border-transparent rounded-full text-base-content/60 hover:text-base-content';

/** A project's kebab is a row action, so it shows on hover and focus like the session rows. */
const triggerClass = 'border-transparent rounded-full text-base-content/60 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100';

const creating = ref(false);
const renaming = ref<ApiProjectDto | null>(null);
const saving = ref(false);
const serverError = ref('');
const confirmingDelete = ref<ApiProjectDto | null>(null);
const deleting = ref(false);

// Drops the key of a project that is gone, so the map does not grow with every
// project ever deleted; the rest keep whatever the user left them at.
watch(
  () => projects.value.map((project) => project.id),
  (ids) => {
    const next: Record<string, boolean> = {};
    for (const id of ids) {
      if (id && closed.value[id]) {
        next[id] = true;
      }
    }
    closed.value = next;
  },
);

function openCreate() {
  renaming.value = null;
  serverError.value = '';
  creating.value = true;
}

function openRename(project: ApiProjectDto) {
  creating.value = false;
  serverError.value = '';
  renaming.value = project;
}

function closeForm() {
  creating.value = false;
  renaming.value = null;
  serverError.value = '';
}

async function save(payload: { project_name: string; project_path: string }) {
  if (saving.value) {
    return;
  }
  saving.value = true;
  serverError.value = '';
  try {
    const target = renaming.value;
    const { data, error } = target?.id ? await putProjectsByUuid({ path: { uuid: target.id }, body: payload }) : await postProjects({ body: payload });
    if (error || !data) {
      serverError.value = apiError(error, 'projects.saveError');
      return;
    }
    await projectStore.load();
    if (data.id) {
      // A project just created is the one being worked on, so it opens and the
      // group above it opens with it.
      closed.value = Object.fromEntries(Object.entries(closed.value).filter(([id]) => id !== data.id));
      expanded.value = true;
    }
    closeForm();
  } finally {
    saving.value = false;
  }
}

async function remove() {
  const target = confirmingDelete.value;
  if (!target?.id || deleting.value) {
    return;
  }
  deleting.value = true;
  try {
    const { error } = await deleteProjectsByUuid({ path: { uuid: target.id } });
    if (error) {
      alertStore.addItem({ level: 'error', message: apiError(error, 'projects.deleteError') });
      return;
    }
    confirmingDelete.value = null;
    await projectStore.load();
  } finally {
    deleting.value = false;
  }
}
</script>

<style scoped>
/* See SidebarChatSessionsList: daisyUI's menu sizes rows by the longest title,
   so the tree rows are plain blocks that the panel sizes instead. */
.project-group,
.project-group ul,
.project-group li {
  display: block;
  max-width: 100%;
  min-width: 0;
  white-space: normal;
}

.project-group ul ul li {
  display: block;
}
</style>
