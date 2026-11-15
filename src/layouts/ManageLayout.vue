<template>
  <main class="app-shell bg-base-100 relative flex h-full flex-col">
    <Alert />
    <ManageSidebar button-label="manage" class="flex-1">
      <Topbar button-label="manage" />
      <div id="app-scroll" class="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div class="p-4 sm:p-6">
          <router-view />
        </div>
      </div>
    </ManageSidebar>
  </main>
</template>

<script lang="ts" setup>
import ManageSidebar from '@/components/ManageSidebar.vue';
import Topbar from '@/components/Topbar.vue';
import Alert from '@/components/Alert.vue';
</script>
