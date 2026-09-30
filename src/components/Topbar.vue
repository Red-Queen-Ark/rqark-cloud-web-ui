<!-- eslint-disable vue/multi-word-component-names -->
<template>
  <header class="bg-base-100 border-base-300 flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3 sm:h-14 sm:px-4">
    <div class="flex min-w-0 items-center gap-1">
      <label class="btn btn-ghost btn-sm btn-square lg:hidden" :for="drawerId" :aria-label="t('nav.openMenu')">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
        </svg>
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
          <svg class="hidden h-3 w-3 opacity-50 sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
          </svg>
        </button>

        <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-50 mt-2 w-56 border border-base-300 shadow-lg">
          <li class="menu-title">
            <span class="text-base-content truncate">{{ displayName }}</span>
            <span class="truncate text-xs font-normal opacity-60">{{ authStore.user?.email }}</span>
          </li>
          <li>
            <RouterLink :to="{ name: 'settings' }">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
              </svg>
              {{ t('settings.title') }}
            </RouterLink>
          </li>
          <li>
            <button class="text-error" @click="logout">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
              </svg>
              {{ t('nav.logout') }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ThemeSwitcher from '@/components/ThemeSwitcher.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
import { useAuthStore } from '@/stores/authStore';
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

const drawerId = computed(() => `${props.buttonLabel}-drawer`);
const displayName = computed(() => authStore.displayName || t('user.display'));

const initials = computed(() => {
  const name = displayName.value.trim();
  return name ? name.slice(0, 1).toUpperCase() : '?';
});

// The header names the page the user is on, taking both texts from the same
// navigation entry that renders the sidebar.
const navItem = computed(() => siderItemFor(route.name as string));
const pageTitle = computed(() => (navItem.value ? t(navItem.value.i18nKey) : import.meta.env.VITE_APP_NAME || 'App'));
const pageSubtitle = computed(() => (navItem.value ? t(navItem.value.subtitleKey) : ''));

function logout() {
  authStore.logout();
  router.push({ name: 'login', params: { lang: (route.params.lang as string) || 'en' } });
}
</script>
