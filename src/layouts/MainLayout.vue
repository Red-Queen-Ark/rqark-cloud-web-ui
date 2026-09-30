<template>
  <main class="bg-base-100 relative flex h-full flex-col">
    <Alert />
    <Sidebar button-label="main" :items="siderItems" class="flex-1">
      <Topbar />
      <div id="app-scroll" class="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div class="p-4 sm:p-6">
          <router-view />
        </div>
      </div>
    </Sidebar>
  </main>
</template>

<script lang="ts" setup>
import Sidebar from '@/components/Sidebar.vue';
import Topbar from '@/components/Topbar.vue';
import Alert from '@/components/Alert.vue';
import { siderItems } from '@/config/siderbar';
</script>
