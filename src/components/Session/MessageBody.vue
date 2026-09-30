<template>
  <!--
    The only place in the app that binds HTML with `v-html`, and the only place
    that should ever do so.

    `html` is the output of `renderMarkdown()` in src/utils/markdown.ts, which is
    `marked` piped through DOMPurify. The disable below records that review at
    the point of use, rather than switching `vue/no-v-html` off for every file.
  -->
  <!-- eslint-disable-next-line vue/no-v-html -- output of renderMarkdown(), which sanitises with DOMPurify -->
  <div v-if="html" class="markdown-body min-w-0 text-sm break-words" v-html="html"></div>
  <pre v-else class="max-w-full font-mono text-xs break-words whitespace-pre-wrap">{{ raw }}</pre>
</template>

<script setup lang="ts">
defineProps<{
  /** Sanitised markdown HTML, or null when the payload is not plain text. */
  html: string | null;
  /** The payload as it stands, shown whenever there is no markdown to render. */
  raw: string;
}>();
</script>
