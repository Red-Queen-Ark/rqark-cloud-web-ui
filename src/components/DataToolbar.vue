<template>
  <div data-testid="data-toolbar" class="flex flex-wrap items-end gap-2">
    <slot></slot>
    <div data-testid="data-toolbar-actions" class="ml-auto flex items-center gap-2">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
