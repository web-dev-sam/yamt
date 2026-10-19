<script setup lang="ts">
import { useElementSize, useWindowSize } from "@vueuse/core";
import { computed, shallowRef, useTemplateRef } from "vue";
import ChevronDown from "~icons/lucide/chevron-down";
import Pin from "~icons/lucide/pin";

import { menuPosition, type Point } from "./menuPosition";
import { DOT_CLASSES, type ServerButton } from "./serverButtons";
import ServerMenu from "./ServerMenu.vue";
import { LANGUAGE_SERVERS, pinLabel, pinTitle, SERVERS, type DotKind } from "./serverText";
import { useAppStore } from "./store";
import { useDropdownMenu } from "./useDropdownMenu";

type RowMenu = { readonly name: string; readonly at: Point; readonly opener: HTMLElement };

defineProps<{ buttons: readonly ServerButton[]; dot: DotKind }>();

const { togglePin } = useAppStore();
const opener = useTemplateRef<HTMLButtonElement>("opener");
const list = useTemplateRef<HTMLUListElement>("list");
const size = useElementSize(list, undefined, { box: "border-box" });
const viewport = useWindowSize();
const at = shallowRef<Point>({ x: 0, y: 0 });
const rowMenu = shallowRef<RowMenu | null>(null);
const { openFor, toggle, close, menuKey } = useDropdownMenu<"servers">({
  menu: () => list.value,
  opener: () => opener.value,
});

const expanded = computed(() => openFor.value !== null || rowMenu.value !== null);
const placement = computed(() => {
  const { x, y } = menuPosition({
    pointer: at.value,
    menu: { width: size.width.value, height: size.height.value },
    viewport: { width: viewport.width.value, height: viewport.height.value },
  });
  return { left: `${x}px`, top: `${y}px` };
});

async function groupClicked(): Promise<void> {
  if (rowMenu.value !== null) {
    rowMenu.value = null;
    return;
  }
  const box = opener.value?.getBoundingClientRect();
  if (box !== undefined) {
    at.value = { x: box.left, y: box.bottom };
  }
  await toggle("servers");
}

async function chooseRow(name: string): Promise<void> {
  await close();
  if (opener.value !== null) {
    rowMenu.value = { name, at: at.value, opener: opener.value };
  }
}

function closeRowMenu(): void {
  rowMenu.value = null;
}
</script>

<template>
  <button
    ref="opener"
    type="button"
    :title="LANGUAGE_SERVERS"
    :aria-label="LANGUAGE_SERVERS"
    aria-haspopup="menu"
    :aria-expanded="expanded"
    class="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-hover aria-expanded:bg-row-selected"
    @click="groupClicked"
  >
    <span class="size-2 shrink-0 rounded-full" :class="DOT_CLASSES[dot]" aria-hidden="true" />
    {{ SERVERS }}
    <ChevronDown class="size-4" aria-hidden="true" />
  </button>
  <Teleport to="body">
    <ul
      v-if="openFor !== null"
      ref="list"
      role="menu"
      :aria-label="LANGUAGE_SERVERS"
      class="fixed z-10 max-h-[60vh] w-max max-w-[30rem] overflow-y-auto rounded-md border border-control-border bg-panel-inline p-1 text-fg shadow-lg"
      :style="placement"
      @keydown="menuKey"
      @contextmenu.prevent
    >
      <li v-for="button in buttons" :key="button.key" role="none" class="flex gap-1">
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          aria-haspopup="menu"
          :title="button.title"
          :aria-label="button.name"
          :aria-description="button.title"
          class="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1 text-left outline-none hover:bg-hover focus:bg-row-selected"
          @click="chooseRow(button.name)"
        >
          <span class="size-2 shrink-0 rounded-full" :class="button.dot" aria-hidden="true" />
          <span class="truncate">{{ button.name }}</span>
        </button>
        <button
          type="button"
          role="menuitemcheckbox"
          tabindex="-1"
          :aria-checked="button.pinned"
          :aria-label="pinLabel(button.name)"
          :title="pinTitle(button.pinned)"
          class="rounded p-1 text-fg-muted outline-none hover:bg-hover focus:ring-1 focus:ring-primary aria-checked:bg-row-selected aria-checked:text-fg"
          @click="togglePin(button.key)"
        >
          <Pin class="size-4" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </Teleport>
  <ServerMenu
    v-if="rowMenu !== null"
    :name="rowMenu.name"
    :at="rowMenu.at"
    :opener="rowMenu.opener"
    @close="closeRowMenu"
  />
</template>
