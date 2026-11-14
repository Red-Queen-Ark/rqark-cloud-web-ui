<template>
  <FormModal :title="title" :description="description" :confirm-label="confirmLabel" :cancel-label="t('projects.cancel')" :saving="saving" box-class="max-w-xl" @confirm="submit" @cancel="emit('cancel')">
    <label class="form-control w-full">
      <span class="label-text pb-1">{{ t('projects.nameLabel') }}</span>
      <input v-model="name" data-testid="project-name" type="text" class="input input-bordered w-full" :placeholder="t('projects.namePlaceholder')" @input="nameTouched = true" @keydown.enter.prevent="submit" />
    </label>

    <div class="form-control w-full">
      <span class="label-text pb-1">{{ t('projects.pathLabel') }}</span>
      <ProjectFolderPicker v-model="path" />
      <label class="input input-bordered mt-2 flex w-full items-center gap-2">
        <span class="text-base-content/50 shrink-0 font-mono text-xs">/workspace/</span>
        <input v-model="pathText" data-testid="project-path" type="text" class="grow font-mono text-sm" :placeholder="t('projects.pathPlaceholder')" @keydown.enter.prevent="submit" />
      </label>
      <span class="text-base-content/60 pt-1 text-xs">{{ t('projects.pathHint') }}</span>
    </div>

    <p v-if="errorKey" data-testid="project-form-error" class="text-error text-sm">{{ t(`projects.${errorKey}`) }}</p>
    <p v-else-if="serverError" data-testid="project-form-error" class="text-error text-sm">{{ serverError }}</p>
  </FormModal>
</template>

<script setup lang="ts">
import FormModal from '@/components/FormModal.vue';
import ProjectFolderPicker from '@/components/Chat/ProjectFolderPicker.vue';
import { basename, checkProjectName, checkProjectPath } from '@/config/projects';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  /** The project being edited; absent when creating one. */
  project?: { project_name?: string; project_path?: string } | null;
  saving?: boolean;
  /** A message the parent got back from the cloud, already translated. */
  serverError?: string;
}>();

const emit = defineEmits<{
  confirm: [payload: { project_name: string; project_path: string }];
  cancel: [];
}>();

const { t } = useI18n();

const editing = computed(() => Boolean(props.project));
const title = computed(() => (editing.value ? t('projects.renameTitle') : t('projects.createTitle')));
const description = computed(() => (editing.value ? t('projects.renameDescription') : t('projects.createDescription')));
const confirmLabel = computed(() => (editing.value ? t('projects.save') : t('projects.create')));

const name = ref(props.project?.project_name ?? '');
const path = ref(props.project?.project_path ?? '');
const pathText = ref(props.project?.project_path ?? '');
const errorKey = ref('');
/** A rename keeps the stored name; a new project's name follows the folder until the user types their own. */
const nameTouched = ref(editing.value);
/** Guards the two-way binding between the picker and the text field, so neither writes back to itself. */
let syncing = false;

watch(path, (value) => {
  if (syncing) {
    return;
  }
  syncing = true;
  pathText.value = value;
  syncing = false;
  if (!nameTouched.value) {
    const guess = basename(value);
    if (guess) {
      syncing = true;
      name.value = guess;
      syncing = false;
    }
  }
});

watch(pathText, (value) => {
  if (syncing) {
    return;
  }
  syncing = true;
  path.value = value;
  syncing = false;
});

function submit() {
  errorKey.value = '';
  const nameCheck = checkProjectName(name.value);
  if (!nameCheck.ok) {
    errorKey.value = nameCheck.error ?? 'nameInvalid';
    return;
  }
  const pathCheck = checkProjectPath(pathText.value);
  if (!pathCheck.ok) {
    errorKey.value = pathCheck.error ?? 'pathRequired';
    return;
  }
  emit('confirm', { project_name: nameCheck.name, project_path: pathCheck.path });
}
</script>
