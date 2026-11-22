<template>
  <div class="inline-flex">
    <button
      ref="trigger"
      type="button"
      :data-testid="triggerTestId"
      class="btn btn-ghost btn-square btn-xs"
      :class="triggerClass"
      :aria-label="label ?? t('common.moreActions')"
      :title="label ?? t('common.moreActions')"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      <EllipsisVerticalIcon class="h-4 w-4" />
    </button>

    <!--
      The menu is teleported out of the table on purpose. Every list page pins
      its actions column with `sticky`, inside a container that scrolls both
      ways, and the head is pinned over it: a menu rendered in the cell would be
      clipped by the container and painted under the pinned head. Fixed
      positioning against the button's box sidesteps both.
    -->
    <Teleport to="body">
      <ul
        v-if="open"
        ref="menu"
        :data-testid="menuTestId"
        class="menu bg-base-200 rounded-box fixed z-50 w-44 p-1 shadow-md"
        :style="{ top: `${box.top}px`, left: `${box.left}px`, visibility: box.ready ? 'visible' : 'hidden' }"
        @click="close"
      >
        <slot></slot>
      </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import EllipsisVerticalIcon from '@/components/svg/EllipsisVerticalIcon.vue';
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

withDefaults(
  defineProps<{
    /** The trigger's accessible name; the shared "more actions" label by default. */
    label?: string;
    /** Extra classes for the trigger, for a row that paints its own button. */
    triggerClass?: string;
    /** Test hooks for callers whose menu is not a table row's. */
    triggerTestId?: string;
    menuTestId?: string;
  }>(),
  {
    label: undefined,
    triggerClass: undefined,
    triggerTestId: 'row-actions-button',
    menuTestId: 'row-actions-menu',
  },
);

const { t } = useI18n();

/** Space kept between the button, the menu and the window edge, in pixels. */
const GAP = 4;
const EDGE = 8;

const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const box = ref({ top: 0, left: 0, ready: false });
/** Where the button sat when the menu opened, to tell a move from noise. */
const anchored = { top: 0, left: 0 };

/**
 * Hangs the menu off the button: below it when that leaves room, above it
 * otherwise, and flush with the button's right edge without running off screen.
 * Runs before the browser paints, so the menu never shows at the wrong place.
 */
function place() {
  const button = trigger.value?.getBoundingClientRect();
  const panel = menu.value?.getBoundingClientRect();

  if (!button || !panel) {
    return;
  }

  const below = button.bottom + GAP;
  const above = button.top - GAP - panel.height;
  const fitsBelow = below + panel.height + EDGE <= window.innerHeight;
  const fitsAbove = above >= EDGE;

  box.value = {
    top: Math.max(EDGE, fitsBelow || !fitsAbove ? below : above),
    left: Math.max(EDGE, Math.min(button.right - panel.width, window.innerWidth - panel.width - EDGE)),
    ready: true,
  };
  anchored.top = Math.round(button.top);
  anchored.left = Math.round(button.left);
}

async function toggle() {
  if (open.value) {
    close();
    return;
  }

  box.value.ready = false;
  open.value = true;
  listen(true);
  await nextTick();
  place();
}

async function close() {
  if (!open.value) {
    return;
  }

  open.value = false;
  listen(false);
}

/** A click anywhere but the button or the menu puts the menu away, as does Escape. */
function onPointerDown(event: MouseEvent) {
  const target = event.target as Node | null;

  if (!target || trigger.value?.contains(target) || menu.value?.contains(target)) {
    return;
  }

  void close();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return;
  }

  void close();
  trigger.value?.focus();
}

/**
 * A scroll that carries the button with it would leave the menu hanging over the
 * wrong row, so that closes it. A scroll somewhere else, such as the chat history
 * filling in behind the sidebar, leaves the button where it is and must not.
 */
function onScroll() {
  const button = trigger.value?.getBoundingClientRect();

  if (!button) {
    return;
  }

  if (Math.round(button.top) === Math.round(anchored.top) && Math.round(button.left) === Math.round(anchored.left)) {
    return;
  }

  void close();
}

function listen(on: boolean) {
  if (on) {
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close, true);
    return;
  }

  document.removeEventListener('mousedown', onPointerDown, true);
  document.removeEventListener('keydown', onKeydown, true);
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', close, true);
}

onBeforeUnmount(() => listen(false));
</script>
