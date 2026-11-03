<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue";
import EllipsisVertical from "~icons/lucide/ellipsis-vertical";
import LoaderCircle from "~icons/lucide/loader-circle";

import type { Point } from "./menuPosition";
import { MORE, moreLabel } from "./mergeRequestsText";
import { vTooltip } from "./tooltip";
import { useDropdownMenu } from "./useDropdownMenu";
import { belowLeft, useMenuPlacement } from "./useMenuPlacement";

const props = defineProps<{ name: string; item: string; working: boolean }>();
const emit = defineEmits<{ choose: [] }>();

const opener = useTemplateRef<HTMLButtonElement>("opener");
const menu = useTemplateRef<HTMLUListElement>("menu");
const at = shallowRef<Point>({ x: 0, y: 0 });
const { openFor, toggle, close, menuKey } = useDropdownMenu<true>({
  menu: () => menu.value,
  opener: () => opener.value,
});
const placement = useMenuPlacement(menu, at);

const label = computed(() => moreLabel(props.name));

async function toggleMenu(): Promise<void> {
  if (props.working || opener.value === null) {
    return;
  }
  at.value = belowLeft(opener.value);
  await toggle(true);
}

async function choose(): Promise<void> {
  await close();
  emit("choose");
}
</script>

<template>
  <span class="flex">
    <button
      ref="opener"
      v-tooltip="MORE"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="openFor !== null"
      :aria-label="label"
      :aria-busy="working"
      :aria-disabled="working"
      class="rounded p-1 not-aria-disabled:cursor-pointer hover:bg-hover aria-disabled:text-fg-muted aria-disabled:hover:bg-transparent aria-expanded:bg-row-selected"
      @click="toggleMenu"
    >
      <LoaderCircle v-if="working" class="size-4 animate-spin" aria-hidden="true" />
      <EllipsisVertical v-else class="size-4" aria-hidden="true" />
    </button>
    <ul
      v-if="openFor !== null"
      ref="menu"
      role="menu"
      :aria-label="label"
      class="fixed z-20 rounded border border-control-border bg-panel py-1 shadow-lg"
      :style="placement"
      @keydown="menuKey"
    >
      <li role="none">
        <button
          type="button"
          role="menuitem"
          class="w-full px-3 py-1 text-left whitespace-nowrap outline-none hover:bg-hover focus:bg-row-selected"
          @click="choose"
        >
          {{ item }}
        </button>
      </li>
    </ul>
  </span>
</template>
