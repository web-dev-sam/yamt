<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import ListIcon from "~icons/lucide/list";
import ListTree from "~icons/lucide/list-tree";

import type { FileEntry } from "../ipc";
import { fileIcon } from "./fileIcon";
import { createFileListMode } from "./fileListMode";
import { createFileListWidth, FILE_LIST_BOUNDS } from "./fileListWidth";
import FileMark from "./FileMark.vue";
import { revealed, treeRows } from "./fileTree";
import FileTree from "./FileTree.vue";
import ResizeDots from "./ResizeDots.vue";
import { useColumnDrag, type ColumnDrag } from "./useColumnDrag";

const props = defineProps<{ files: readonly FileEntry[]; active: string | null }>();
const emit = defineEmits<{ select: [path: string] }>();

const list = useTemplateRef<HTMLElement>("list");
const { mode, toggle } = createFileListMode();
const { width, setWidth, resetWidth } = createFileListWidth();
const resize = useColumnDrag({
  accepts: (event) => event.target === event.currentTarget,
  press: startResize,
  reset: resetWidth,
});
const closed = shallowRef<ReadonlySet<string>>(new Set());

const widthStyle = computed(() =>
  width.value === null ? FILE_LIST_BOUNDS : { ...FILE_LIST_BOUNDS, width: `${width.value}px` },
);
const rows = computed(() => treeRows(props.files, closed.value));
const viewButton = computed(() =>
  mode.value === "list"
    ? { icon: ListIcon, label: "View as tree" }
    : { icon: ListTree, label: "View as list" },
);

watch(
  () => props.active,
  (path) => {
    const next = path === null ? closed.value : revealed(closed.value, path);
    if (next !== closed.value) {
      closed.value = next;
    }
  },
);

function startResize(): ColumnDrag | null {
  if (list.value === null) {
    return null;
  }
  const pressWidth = list.value.getBoundingClientRect().width;
  return {
    moveBy: (dx) => {
      setWidth(pressWidth + dx, window.innerWidth);
    },
  };
}

function toggleFolder(path: string): void {
  const next = new Set(closed.value);
  if (!next.delete(path)) {
    next.add(path);
  }
  closed.value = next;
}
</script>

<template>
  <aside
    ref="list"
    class="relative flex w-60 shrink-0 flex-col rounded-island bg-panel pb-1"
    :style="widthStyle"
  >
    <div class="flex h-10 shrink-0 items-center justify-between pr-2 pl-3">
      <h2 class="font-semibold">Files</h2>
      <button
        type="button"
        :title="viewButton.label"
        :aria-label="viewButton.label"
        class="rounded p-1.5 hover:bg-hover"
        @mousedown.prevent
        @click="toggle"
      >
        <component :is="viewButton.icon" class="size-4" aria-hidden="true" />
      </button>
    </div>
    <FileTree
      v-if="mode === 'tree'"
      :rows="rows"
      :active="active"
      @select="emit('select', $event)"
      @toggle="toggleFolder"
    />
    <ul
      v-else
      role="listbox"
      aria-label="Conflicted files"
      class="mr-0.5 flex-1 overflow-y-auto rounded-b-island opaque-scroller"
    >
      <li
        v-for="file in files"
        :key="file.path"
        role="option"
        :aria-selected="file.path === active"
        class="mx-1 flex cursor-default items-center gap-2 rounded px-2 py-1 hover:bg-row-hover aria-selected:bg-row-selected"
        @click="emit('select', file.path)"
      >
        <component :is="fileIcon(file.path)" class="size-4 shrink-0" aria-hidden="true" />
        <FileMark :status="file.status" :label="file.path" />
      </li>
    </ul>
    <!-- Flex-centred dots in this handle make about half of the panes' scroll frames late in WebKitGTK; centred as an absolute box they do not. -->
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="File list width"
      class="absolute inset-y-0 -right-island z-10 w-island cursor-col-resize"
      v-on="resize.listeners"
    >
      <ResizeDots class="absolute inset-0 m-auto size-fit" :state="resize.dots.value" />
    </div>
  </aside>
</template>
