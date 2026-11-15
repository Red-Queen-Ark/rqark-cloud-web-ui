<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <div class="drawer lg:drawer-open h-full">
    <input :id="drawerId" ref="drawerToggle" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content flex h-full min-h-0 flex-col">
      <slot></slot>
    </div>
    <div class="drawer-side z-40">
      <label :for="drawerId" class="drawer-overlay"></label>
      <div class="bg-base-100 border-base-300 flex h-full w-72 flex-col border-r">
        <div class="border-base-300 flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:h-14 sm:px-4">
          <img src="/logo.svg" alt="" class="h-8 w-8 shrink-0" />
          <span class="truncate text-lg font-bold tracking-tight">{{ appName }}</span>
          <span class="badge badge-ghost badge-sm ml-auto shrink-0">{{ t('manage.title') }}</span>
        </div>

        <ul class="menu menu-md w-full flex-nowrap scrollbar-thin flex-1 gap-1 overflow-x-hidden overflow-y-auto p-2">
          <li v-for="item in visibleItems" :key="item.pageId">
            <RouterLink :to="{ name: item.pageId, params: { lang: route.params.lang as string } }" :class="{ 'menu-active': isActive(item) }" :data-testid="`manage-sidebar-${item.pageId}-link`">
              <component :is="item.icon" class="h-4 w-4" />
              {{ t(item.i18nKey) }}
            </RouterLink>
          </li>
        </ul>

        <div class="border-base-300 shrink-0 border-t p-2">
          <ul class="menu menu-md w-full flex-nowrap gap-1 p-0">
            <li>
              <RouterLink :to="{ name: 'home', params: { lang: route.params.lang as string } }" data-testid="sidebar-chat-link">
                <ChatIcon class="h-4 w-4" />
                {{ t('chat.title') }}
              </RouterLink>
            </li>
          </ul>
        </div>
        <div class="border-base-300 shrink-0 border-t p-2">
          <button class="btn btn-ghost btn-sm text-error w-full justify-start gap-2" @click="logout">
            <LogoutIcon class="h-4 w-4" />
            {{ t('nav.logout') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatIcon from '@/components/svg/ChatIcon.vue';
import LogoutIcon from '@/components/svg/LogoutIcon.vue';
import type { SiderItem } from '@/config/siderbar';
import { manageSiderItemFor, manageSiderItems } from '@/config/manageSiderbar';
import { useAuthStore } from '@/stores/authStore';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const props = withDefaults(defineProps<{ buttonLabel?: string }>(), { buttonLabel: 'manage' });

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();

const drawerToggle = ref<HTMLInputElement | null>(null);
const drawerId = computed(() => `${props.buttonLabel}-drawer`);
const appName = import.meta.env.VITE_APP_NAME || 'App';

const visibleItems = computed(() => manageSiderItems.filter((item) => !item.superuserOnly || authStore.user?.is_superuser === true));

watch(
  () => route.fullPath,
  () => {
    if (drawerToggle.value) {
      drawerToggle.value.checked = false;
    }
  },
);

function isActive(item: SiderItem): boolean {
  return manageSiderItemFor(route.name as string)?.pageId === item.pageId;
}

function logout() {
  authStore.logout();
  router.push({ name: 'login', params: { lang: route.params.lang as string } });
}
</script>
