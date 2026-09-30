<template>
  <router-view />
</template>

<script lang="ts" setup>
import { useLanguage } from '../composables/useLanguage';
useLanguage();
</script>
