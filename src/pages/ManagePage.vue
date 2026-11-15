<template>
  <div data-testid="manage-page" class="space-y-4">
    <p class="text-base-content/70 max-w-md text-xs">{{ t('manage.hint') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
