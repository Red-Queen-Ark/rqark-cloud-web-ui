<template>
  <div id="auth-panel" class="bg-base-300 flex h-full overflow-y-auto">
    <!-- Desktop left promo -->
    <div class="border-base-300 relative hidden overflow-hidden border-r lg:flex lg:flex-[2]">
      <div class="absolute inset-0 opacity-10" :style="gridStyleContent"></div>
      <div class="pointer-events-none absolute right-0 top-0 h-full w-full opacity-25" :style="radialGradientCenter"></div>
      <div class="relative z-10 flex w-full flex-col items-center justify-center p-10">
        <div class="mb-8">
          <svg class="mx-auto h-64 w-80 drop-shadow-2xl" fill="none" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
            <rect x="50" y="80" width="60" height="80" rx="8" fill="var(--color-base-300)" />
            <rect x="130" y="60" width="60" height="100" rx="8" fill="var(--color-base-200)" />
            <rect x="210" y="40" width="60" height="120" rx="8" fill="var(--color-base-300)" />
            <rect x="290" y="80" width="60" height="80" rx="8" fill="var(--color-primary)" opacity="0.8" />
            <path d="M110 120 L130 110" stroke="var(--color-primary)" stroke-width="2" opacity="0.5" />
            <path d="M190 110 L210 100" stroke="var(--color-primary)" stroke-width="2" opacity="0.5" />
            <path d="M270 100 L290 120" stroke="var(--color-primary)" stroke-width="2" opacity="0.5" />
            <circle cx="90" cy="140" r="12" fill="var(--color-success)" opacity="0.8" />
            <path d="M85 140 L88 143 L95 136" stroke="white" stroke-width="2" fill="none" />
            <circle cx="170" cy="130" r="12" fill="var(--color-success)" opacity="0.8" />
            <path d="M165 130 L168 133 L175 126" stroke="white" stroke-width="2" fill="none" />
            <circle cx="250" cy="110" r="12" fill="var(--color-success)" opacity="0.8" />
            <path d="M245 110 L248 113 L255 106" stroke="white" stroke-width="2" fill="none" />
          </svg>
        </div>
        <img src="/logo.svg" alt="" class="mx-auto mb-4 h-24 w-24" />
        <h2 class="mb-4 text-center text-3xl font-semibold text-base-content">
          {{ appName }}
        </h2>
        <p class="max-w-md text-center text-lg leading-relaxed text-base-content/75">
          {{ promoText }}
        </p>
      </div>
    </div>

    <!-- Right side form -->
    <div class="relative flex flex-1 items-center justify-center p-8">
      <!-- Mobile grid background -->
      <div class="absolute inset-0 z-0 opacity-10 lg:hidden" :style="gridStyleContent"></div>
      <!-- Mobile gradient accent -->
      <div class="pointer-events-none absolute right-0 top-0 h-full w-full opacity-25 lg:hidden" :style="radialGradient"></div>

      <div class="relative z-10 w-full max-w-sm">
        <img src="/logo.svg" alt="" class="mx-auto mb-6 h-24 w-24 lg:hidden" />
        <h1 class="mb-2 text-3xl font-semibold text-base-content">
          {{ title }}
        </h1>
        <p class="mb-8 text-sm text-base-content/75">
          {{ subtitle }}
        </p>

        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle: string;
    promo?: string;
  }>(),
  { promo: '' },
);

const { t } = useI18n();

const appName = import.meta.env.VITE_APP_NAME || 'App';

const promoText = computed(() => props.promo || t('login.promo'));

const gridStyleContent = computed(() => 'background-image: linear-gradient(var(--color-base-content) 1px, transparent 1px), linear-gradient(90deg, var(--color-base-content) 1px, transparent 1px); background-size: 40px 40px;');

const radialGradient = computed(() => 'background: radial-gradient(circle at top right, var(--color-info), transparent 40%);');

const radialGradientCenter = computed(() => 'background: radial-gradient(circle at center, var(--color-info), transparent 60%);');
</script>
