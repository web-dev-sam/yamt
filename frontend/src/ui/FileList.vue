<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import Check from "~icons/lucide/check";
import GitPullRequestClosed from "~icons/lucide/git-pull-request-closed";
import ListIcon from "~icons/lucide/list";
import ListTree from "~icons/lucide/list-tree";

import type { FileEntry } from "../ipc";
import type { AbortButton } from "./aborting";
import { fileIcon } from "./fileIcon";
import { createFileListMode } from "./fileListMode";
import { revealed, treeRows } from "./fileTree";
import FileTree from "./FileTree.vue";

const props = defineProps<{
  files: readonly FileEntry[];
  active: string | null;
  abortButton: AbortButton;
}>();
const emit = defineEmits<{ select: [path: string]; abort: [] }>();

const list = useTemplateRef<HTMLElement>("list");
const handle = useTemplateRef<HTMLDivElement>("handle");
const width = shallowRef<number | null>(null);
const { mode, toggle } = createFileListMode();
const closed = shallowRef<ReadonlySet<string>>(new Set());
let grabOffset = 0;

const widthStyle = computed(() => (width.value === null ? {} : { width: `${width.value}px` }));
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

function startResize(event: PointerEvent): void {
  event.preventDefault();
  if (list.value !== null) {
    grabOffset = event.clientX - list.value.getBoundingClientRect().right;
  }
  handle.value?.setPointerCapture(event.pointerId);
}

function resize(event: PointerEvent): void {
  if (list.value !== null && handle.value?.hasPointerCapture(event.pointerId) === true) {
    width.value = event.clientX - grabOffset - list.value.getBoundingClientRect().left;
  }
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
    class="relative flex w-60 max-w-[50vw] min-w-40 shrink-0 flex-col rounded-island bg-panel pb-1"
    :style="widthStyle"
  >
    <div class="flex h-10 shrink-0 items-center justify-between pr-2 pl-3">
      <h2 class="mr-auto font-semibold">Files</h2>
      <button
        v-if="abortButton !== 'hidden'"
        type="button"
        title="Abort merge"
        aria-label="Abort merge"
        class="rounded p-1.5 hover:bg-hover disabled:text-fg-muted disabled:hover:bg-transparent"
        :disabled="abortButton === 'running'"
        @mousedown.prevent
        @click="emit('abort')"
      >
        <GitPullRequestClosed class="size-4" aria-hidden="true" />
      </button>
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
      class="absolute inset-y-0 -right-island z-10 w-island cursor-col-resize"
      @pointerdown="startResize"
      @pointermove="resize"
    />
  </aside>
</template>
