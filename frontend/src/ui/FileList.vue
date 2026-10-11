<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue";
import Check from "~icons/lucide/check";

import type { FileEntry } from "../ipc";
import { fileIcon } from "./fileIcon";

defineProps<{ files: readonly FileEntry[]; active: string | null }>();
const emit = defineEmits<{ select: [path: string] }>();

const list = useTemplateRef<HTMLElement>("list");
const handle = useTemplateRef<HTMLDivElement>("handle");
const width = shallowRef<number | null>(null);

const widthStyle = computed(() => (width.value === null ? {} : { width: `${width.value}px` }));

function startResize(event: PointerEvent): void {
  event.preventDefault();
  handle.value?.setPointerCapture(event.pointerId);
}

function resize(event: PointerEvent): void {
  if (list.value !== null && handle.value?.hasPointerCapture(event.pointerId) === true) {
    width.value = event.clientX - list.value.getBoundingClientRect().left;
  }
}
</script>

<template>
  <aside
    ref="list"
    class="relative flex w-60 max-w-[50vw] min-w-40 shrink-0 flex-col border-r border-separator bg-window"
    :style="widthStyle"
  >
    <h2 class="px-3 py-2 font-semibold">Files</h2>
    <ul role="listbox" aria-label="Conflicted files" class="flex-1 overflow-y-auto">
      <li
        v-for="file in files"
        :key="file.path"
        role="option"
        :aria-selected="file.path === active"
        class="mx-1 flex cursor-default items-center gap-2 rounded px-2 py-1 hover:bg-hover aria-selected:bg-row-selected"
        @click="emit('select', file.path)"
      >
        <component :is="fileIcon(file.path)" class="size-4 shrink-0" aria-hidden="true" />
        <span class="truncate" :class="{ 'text-fg-muted': file.status === 'Resolved' }">
          {{ file.path }}
        </span>
        <span
          v-if="file.status === 'Resolved'"
          class="ml-auto flex shrink-0 items-center gap-1 text-fg-muted"
        >
          <Check class="size-3.5" aria-hidden="true" />
          resolved
        </span>
      </li>
    </ul>
    <div
      ref="handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="File list width"
      class="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize"
      @pointerdown="startResize"
      @pointermove="resize"
    />
  </aside>
</template>
