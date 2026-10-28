<script setup lang="ts" generic="F extends ListedFile">
import { computed, shallowRef, useTemplateRef, watch } from "vue";
import ListIcon from "~icons/lucide/list";
import ListTree from "~icons/lucide/list-tree";

import { fileIcon } from "./fileIcon";
import { createFileListMode } from "./fileListMode";
import { revealed, treeRows, type ListedFile } from "./fileTree";
import FileTree from "./FileTree.vue";
import PanelWidthHandle from "./PanelWidthHandle.vue";
import { usePanelWidth } from "./usePanelWidth";

const props = defineProps<{ files: readonly F[]; active: string | null; label: string }>();
const emit = defineEmits<{ select: [path: string] }>();
defineSlots<{
  file(props: { file: F; label: string }): unknown;
  folder?(props: { path: string }): unknown;
  footer(): unknown;
}>();

const list = useTemplateRef<HTMLElement>("list");
const { mode, toggle } = createFileListMode();
const { widthStyle, resize } = usePanelWidth(list);
const closed = shallowRef<ReadonlySet<string>>(new Set());

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
    class="relative mr-(--island-overlap) flex w-60 shrink-0 flex-col island bg-sidebar pb-1"
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
      :label="label"
      @select="emit('select', $event)"
      @toggle="toggleFolder"
    >
      <template #file="row">
        <slot name="file" :file="row.file" :label="row.label" />
      </template>
      <template v-if="$slots.folder" #folder="{ path }">
        <slot name="folder" :path="path" />
      </template>
    </FileTree>
    <ul
      v-else
      role="listbox"
      :aria-label="label"
      class="mr-0.5 flex-1 overflow-y-auto rounded-b-island opaque-sidebar-scroller"
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
        <slot name="file" :file="file" :label="file.path" />
      </li>
    </ul>
    <slot name="footer" />
    <PanelWidthHandle label="File list width" :handle="resize" />
  </aside>
</template>
