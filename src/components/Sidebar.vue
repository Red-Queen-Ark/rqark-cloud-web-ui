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
        </div>

        <!-- daisyUI 5 gives .menu `width: fit-content`, which collapses the row
             highlight to the label width inside a stretched flex column. -->
        <ul class="menu menu-md w-full scrollbar-thin flex-1 gap-1 overflow-y-auto p-2">
          <SidebarChatSessionsList />
          <!-- <li v-for="item in visibleItems" :key="item.pageId">
            <RouterLink :to="{ name: item.pageId }" :class="{ 'menu-active': isActive(item) }">
              <svg
                class="h-4 w-4"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                :fill="item.filled ? 'currentColor' : 'none'"
                :stroke="item.filled ? 'none' : 'currentColor'"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              >
                <path :d="item.icon" />
              </svg>
              {{ t(item.i18nKey) }}
            </RouterLink>
          </li> -->
        </ul>

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
import LogoutIcon from '@/components/svg/LogoutIcon.vue';
import { useAuthStore } from '@/stores/authStore';
import type { SiderItem } from '@/config/siderbar';
import { siderItemFor } from '@/config/siderbar';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import SidebarChatSessionsList from './Chat/SidebarChatSessionsList.vue';

const props = defineProps<{
  buttonLabel: string;
  items: SiderItem[];
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();

const drawerToggle = ref<HTMLInputElement | null>(null);
const drawerId = computed(() => `${props.buttonLabel}-drawer`);
const appName = import.meta.env.VITE_APP_NAME || 'App';

// The backend answers 403 for a plain token on the admin endpoints, so the
// entries they back are hidden instead of leading to a rejected page.
const visibleItems = computed(() => props.items.filter((item) => !item.superuserOnly || authStore.user?.is_superuser === true));

// The drawer overlays the page on small screens, so navigating has to dismiss
// it. The checkbox is uncontrolled: the hamburger label toggles it natively.
watch(
  () => route.fullPath,
  () => {
    if (drawerToggle.value) {
      drawerToggle.value.checked = false;
    }
  },
);

function isActive(item: SiderItem): boolean {
  // The shared lookup rather than a name comparison, so a detail page keeps its
  // list's entry marked (see `SiderItem.aliases`).
  return siderItemFor(route.name as string)?.pageId === item.pageId;
}

function logout() {
  authStore.logout();
  router.push({ name: 'login', params: { lang: route.params.lang as string } });
}
</script>
