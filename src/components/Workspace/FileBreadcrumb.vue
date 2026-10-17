<template>
  <nav data-testid="workspace-breadcrumb" class="breadcrumbs min-w-0 text-sm" aria-label="breadcrumb">
    <ul>
      <li>
        <button data-testid="workspace-breadcrumb-root" :class="{ 'font-semibold': segments.length === 0 }" @click="emit('navigate', '')">
          <HomeIcon class="h-4 w-4" />
          {{ rootLabel }}
        </button>
      </li>
      <li v-for="(segment, index) in segments" :key="segment.path">
        <button :data-testid="`workspace-breadcrumb-${segment.path}`" :class="{ 'font-semibold': index === segments.length - 1 }" @click="emit('navigate', segment.path)">
          {{ segment.name }}
        </button>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import HomeIcon from '@/components/svg/HomeIcon.vue';
import { breadcrumbOf } from '@/config/workspace';
import { computed } from 'vue';

const props = defineProps<{ path: string; rootLabel: string }>();

const emit = defineEmits<{ navigate: [path: string] }>();

const segments = computed(() => breadcrumbOf(props.path));
</script>
