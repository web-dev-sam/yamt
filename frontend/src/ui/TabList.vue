<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue";
import Plus from "~icons/lucide/plus";
import X from "~icons/lucide/x";

import type { TabEntry, TabId } from "../ipc";
import { languageLabel } from "./compareTabs";
import { createFileListWidth, FILE_LIST_BOUNDS } from "./fileListWidth";
import ResizeDots from "./ResizeDots.vue";
import { useColumnDrag, type ColumnDrag } from "./useColumnDrag";

type Renaming = { readonly tab: TabId; readonly draft: string };

const props = defineProps<{
  tabs: readonly TabEntry[];
  shown: TabId | null;
  detected: ReadonlyMap<TabId, string | null>;
}>();
const emit = defineEmits<{
  add: [];
  select: [tab: TabId];
  close: [tab: TabId];
  rename: [tab: TabId, name: string];
}>();

const list = useTemplateRef<HTMLElement>("list");
const { width, setWidth, resetWidth } = createFileListWidth();
const resize = useColumnDrag({
  accepts: (event) => event.target === event.currentTarget,
  press: startResize,
  reset: resetWidth,
});
const renaming = shallowRef<Renaming | null>(null);

const widthStyle = computed(() =>
  width.value === null ? FILE_LIST_BOUNDS : { ...FILE_LIST_BOUNDS, width: `${width.value}px` },
);
const rows = computed(() =>
  props.tabs.map((tab) => ({
    tab,
    language: languageLabel(tab.language, props.detected.get(tab.id) ?? null),
  })),
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

function startRename(tab: TabEntry): void {
  renaming.value = { tab: tab.id, draft: tab.name };
}

function focusField(element: unknown): void {
  if (element instanceof HTMLInputElement && document.activeElement !== element) {
    element.focus();
    element.select();
  }
}

function editDraft(event: Event): void {
  if (renaming.value !== null && event.target instanceof HTMLInputElement) {
    renaming.value = { ...renaming.value, draft: event.target.value };
  }
}

function keepRename(tab: TabEntry): void {
  const current = renaming.value;
  if (current?.tab !== tab.id) {
    return;
  }
  renaming.value = null;
  const name = current.draft.trim();
  if (name !== "" && name !== tab.name) {
    emit("rename", tab.id, name);
  }
}

function cancelRename(): void {
  renaming.value = null;
}
</script>

<template>
  <aside
    ref="list"
    class="relative flex w-60 shrink-0 flex-col rounded-island bg-panel pb-1"
    :style="widthStyle"
  >
    <div class="flex h-10 shrink-0 items-center justify-between pr-2 pl-3">
      <h2 class="font-semibold">Tabs</h2>
      <button
        type="button"
        title="New tab"
        aria-label="New tab"
        class="rounded p-1.5 hover:bg-hover"
        @click="emit('add')"
      >
        <Plus class="size-4" aria-hidden="true" />
      </button>
    </div>
    <ul
      role="listbox"
      aria-label="Tabs"
      class="mr-0.5 flex-1 overflow-y-auto rounded-b-island opaque-scroller"
    >
      <li
        v-for="row in rows"
        :key="row.tab.id"
        role="option"
        :aria-selected="row.tab.id === shown"
        class="group mx-1 flex cursor-default items-center gap-2 rounded py-1 pr-1 pl-2 hover:bg-row-hover aria-selected:bg-row-selected"
        @click="emit('select', row.tab.id)"
      >
        <input
          v-if="renaming?.tab === row.tab.id"
          :ref="focusField"
          :value="renaming.draft"
          aria-label="Tab name"
          class="min-w-0 flex-1 rounded border border-control-border bg-panel px-1 outline-none"
          @input="editDraft"
          @keydown.enter.prevent="keepRename(row.tab)"
          @keydown.esc.prevent.stop="cancelRename"
          @blur="keepRename(row.tab)"
          @click.stop
          @dblclick.stop
        />
        <span v-else class="min-w-0 flex-1 truncate" @dblclick="startRename(row.tab)">
          {{ row.tab.name }}
        </span>
        <span class="shrink-0 text-fg-muted">{{ row.language }}</span>
        <button
          type="button"
          title="Close tab"
          :aria-label="`Close ${row.tab.name}`"
          class="invisible shrink-0 rounded p-0.5 group-hover:visible hover:bg-hover"
          @click.stop="emit('close', row.tab.id)"
        >
          <X class="size-3.5" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <!-- Flex-centred dots in this handle make about half of the panes' scroll frames late in WebKitGTK; centred as an absolute box they do not. -->
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Tab list width"
      class="absolute inset-y-0 -right-island z-10 w-island cursor-col-resize"
      v-on="resize.listeners"
    >
      <ResizeDots class="absolute inset-0 m-auto size-fit" :state="resize.dots.value" />
    </div>
  </aside>
</template>
