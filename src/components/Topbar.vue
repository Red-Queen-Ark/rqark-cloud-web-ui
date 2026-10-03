<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <header class="bg-base-100 border-base-300 flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3 sm:h-14 sm:px-4">
    <div class="flex min-w-0 items-center gap-1">
      <label class="btn btn-ghost btn-sm btn-square lg:hidden" :for="drawerId" :aria-label="t('nav.openMenu')">
        <MenuIcon class="h-5 w-5" />
      </label>

      <div class="min-w-0">
        <h1 class="truncate text-base font-bold tracking-tight sm:text-lg">{{ pageTitle }}</h1>
        <p class="text-base-content/70 hidden truncate text-xs sm:block">{{ pageSubtitle }}</p>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-1 sm:gap-2">
      <ThemeSwitcher />
      <LanguageSwitcher />

      <div class="dropdown dropdown-end">
        <button tabindex="0" class="btn btn-ghost btn-sm gap-2 px-1 sm:px-2" :aria-label="t('nav.account')">
          <span class="bg-primary text-primary-content flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
            {{ initials }}
          </span>
          <span class="hidden text-sm font-medium sm:inline">{{ displayName }}</span>
          <ChevronDownIcon class="hidden h-3 w-3 opacity-50 sm:block" />
        </button>

        <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-50 mt-2 w-56 border border-base-300 shadow-lg">
          <li class="menu-title">
            <span class="text-base-content truncate">{{ displayName }}</span>
            <span class="truncate text-xs font-normal opacity-60">{{ authStore.user?.email }}</span>
          </li>
          <li>
            <RouterLink :to="{ name: 'settings' }">
              <CogIcon class="h-4 w-4" />
              {{ t('settings.title') }}
            </RouterLink>
          </li>
          <li>
            <button class="text-error" @click="logout">
              <LogoutIcon class="h-4 w-4" />
              {{ t('nav.logout') }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import ChevronDownIcon from '@/components/svg/ChevronDownIcon.vue';
import CogIcon from '@/components/svg/CogIcon.vue';
import LogoutIcon from '@/components/svg/LogoutIcon.vue';
import MenuIcon from '@/components/svg/MenuIcon.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { siderItemFor } from '@/config/siderbar';

const props = withDefaults(
  defineProps<{
    buttonLabel?: string;
  }>(),
  { buttonLabel: 'main' },
);

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const chatStore = useChatStore();

const drawerId = computed(() => `${props.buttonLabel}-drawer`);
const displayName = computed(() => authStore.displayName || t('user.display'));

const initials = computed(() => {
  const name = displayName.value.trim();
  return name ? name.slice(0, 1).toUpperCase() : '?';
});

// The header names the page the user is on, taking both texts from the same
// navigation entry that renders the sidebar.
const navItem = computed(() => siderItemFor(route.name as string));

// A chat is not a navigation entry, so the header names the session the route
// points at instead. The sidebar owns the session list and publishes its
// titles, which is also what keeps a renamed session in step with the header.
// An id nothing has listed yet is `undefined` rather than an empty title.
const sessionTitle = computed(() => {
  const uuid = route.params.uuid;
  return route.name === 'chat' && typeof uuid === 'string' ? chatStore.sessionTitles[uuid] : undefined;
});

const pageTitle = computed(() => {
  if (navItem.value) {
    return t(navItem.value.i18nKey);
  }
  if (sessionTitle.value !== undefined) {
    return sessionTitle.value.trim() || t('sessions.untitled');
  }
  return import.meta.env.VITE_APP_NAME || 'App';
});

const pageSubtitle = computed(() => (navItem.value ? t(navItem.value.subtitleKey) : ''));

function logout() {
  authStore.logout();
  router.push({ name: 'login', params: { lang: (route.params.lang as string) || 'en' } });
}
</script>
