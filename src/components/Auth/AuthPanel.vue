<template>
  <div id="auth-panel" class="bg-base-300 flex h-full overflow-y-auto">
    <!-- Desktop left promo -->
    <div class="border-base-300 relative hidden overflow-hidden border-r lg:flex lg:flex-[2]">
      <div class="absolute inset-0 opacity-10" :style="gridStyleContent"></div>
      <div class="pointer-events-none absolute right-0 top-0 h-full w-full opacity-25" :style="radialGradientCenter"></div>
      <div class="relative z-10 flex w-full flex-col items-center justify-center p-10">
        <div class="mb-8">
          <AuthPromoIllustration class="mx-auto h-64 w-80 drop-shadow-2xl" />
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
import AuthPromoIllustration from '@/components/svg/AuthPromoIllustration.vue';
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
