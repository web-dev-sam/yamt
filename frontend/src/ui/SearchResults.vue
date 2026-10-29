<script setup lang="ts" generic="P extends string">
import { useVirtualList } from "@vueuse/core";
import { computed, shallowRef, toRef, type Component } from "vue";
import ChevronDown from "~icons/lucide/chevron-down";
import ChevronRight from "~icons/lucide/chevron-right";
import XIcon from "~icons/lucide/x";

import type { ListRow, PaneEntry, Place, PlaceKey } from "../search";
import { fileIcon } from "./fileIcon";
import { PANE_ICONS } from "./searchIcons";
import type { SearchPaneInfo } from "./searching";
import { stepSearchList } from "./searchListKeys";
import { DISMISS_LABEL, paneHitTitle, RESULTS_LABEL } from "./searchText";

type Row = ListRow<P>;

const props = defineProps<{ rows: readonly Row[]; panes: readonly SearchPaneInfo<P>[] }>();
const emit = defineEmits<{
  toggle: [path: string];
  dismissPlace: [path: string, key: PlaceKey];
  dismissGroup: [path: string];
  go: [path: string, place: Place<P>, pane: P | null];
}>();

const ROW_HEIGHT_PX = 22;

const activeKey = shallowRef<string | null>(null);

const { list, containerProps, wrapperProps } = useVirtualList(toRef(props, "rows"), {
  itemHeight: ROW_HEIGHT_PX,
});

const activeIndex = computed(() => {
  const index = props.rows.findIndex((row) => rowKey(row) === activeKey.value);
  return index === -1 ? null : index;
});

function rowKey(row: Row): string {
  return row.kind === "group"
    ? JSON.stringify(["group", row.path])
    : JSON.stringify(["place", row.path, row.place.key]);
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function folderOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), 0));
}

function hitTitle(entry: PaneEntry<P>): string {
  const title = props.panes.find((info) => info.pane === entry.pane)?.title ?? entry.pane;
  return paneHitTitle(title, entry.hit.line);
}

function hitIcon(entry: PaneEntry<P>): Component | null {
  const info = props.panes.find((pane) => pane.pane === entry.pane);
  return info === undefined ? null : PANE_ICONS[info.icon];
}

function pressed(row: Row): void {
  activeKey.value = rowKey(row);
  if (row.kind === "group") {
    emit("toggle", row.path);
  } else {
    emit("go", row.path, row.place, null);
  }
}

function dismiss(row: Row): void {
  if (row.kind === "group") {
    emit("dismissGroup", row.path);
  } else {
    emit("dismissPlace", row.path, row.place.key);
  }
}

function keepInView(index: number): void {
  const element = containerProps.ref.value;
  if (element === null) {
    return;
  }
  const top = index * ROW_HEIGHT_PX;
  if (top < element.scrollTop) {
    element.scrollTop = top;
  } else if (top + ROW_HEIGHT_PX > element.scrollTop + element.clientHeight) {
    element.scrollTop = top + ROW_HEIGHT_PX - element.clientHeight;
  }
}

function activate(index: number): void {
  const row = props.rows[index];
  if (row !== undefined) {
    activeKey.value = rowKey(row);
    keepInView(index);
  }
}

function keydown(event: KeyboardEvent): void {
  const step = stepSearchList(props.rows, activeIndex.value, event.key);
  if (step.kind === "ignore") {
    return;
  }
  event.preventDefault();
  switch (step.kind) {
    case "activate":
      activate(step.index);
      break;
    case "toggle":
      emit("toggle", step.path);
      break;
    case "press": {
      const row = props.rows[step.index];
      if (row !== undefined) {
        pressed(row);
      }
      break;
    }
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

function focusList(): void {
  containerProps.ref.value?.focus();
  if (activeIndex.value === null) {
    activate(0);
  }
}

defineExpose({ focusList });
</script>

<template>
  <div
    :ref="containerProps.ref"
    role="tree"
    tabindex="0"
    :aria-label="RESULTS_LABEL"
    class="group/list mr-0.5 min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-b-island opaque-sidebar-scroller outline-none"
    @scroll="containerProps.onScroll"
    @keydown="keydown"
  >
    <!-- WebKitGTK's overlay scrollbar takes every press within 20 px of a scroller's right edge, and its horizontal one the last row's (review finding 1719): the rows end 20 px short and the list never scrolls sideways. -->
    <div v-bind="wrapperProps">
      <div
        v-for="{ data: row } in list"
        :key="rowKey(row)"
        role="treeitem"
        :aria-level="row.kind === 'group' ? 1 : 2"
        :aria-expanded="row.kind === 'group' ? row.open : undefined"
        :aria-selected="rowKey(row) === activeKey"
        class="group mr-5 ml-1 flex cursor-default items-center gap-1.5 rounded pr-1 hover:bg-row-hover aria-selected:bg-row-selected"
        :class="row.kind === 'place' ? 'pl-7' : 'pl-2'"
        :style="{ height: `${ROW_HEIGHT_PX}px` }"
        @click="pressed(row)"
      >
        <template v-if="row.kind === 'group'">
          <span class="flex size-4 shrink-0 items-center justify-center text-fg-muted">
            <ChevronDown v-if="row.open" class="size-4" aria-hidden="true" />
            <ChevronRight v-else class="size-4" aria-hidden="true" />
          </span>
          <component :is="fileIcon(row.path)" class="size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 truncate">{{ fileName(row.path) }}</span>
          <span class="min-w-0 flex-1 truncate text-fg-muted">{{ folderOf(row.path) }}</span>
          <span class="shrink-0 rounded-full bg-hover px-1.5 text-xs">{{ row.count }}</span>
        </template>
        <template v-else>
          <span class="flex min-w-0 flex-1 overflow-hidden whitespace-pre">
            <span class="shrink-0">{{ row.place.preview.before }}</span>
            <mark class="shrink-0 rounded-sm bg-search-match text-inherit">{{
              row.place.preview.match
            }}</mark>
            <span class="overflow-hidden text-ellipsis">{{ row.place.preview.after }}</span>
          </span>
          <button
            v-for="entry in row.shown"
            :key="entry.pane"
            type="button"
            :title="hitTitle(entry)"
            :aria-label="hitTitle(entry)"
            class="shrink-0 rounded p-0.5 text-fg-muted hover:bg-hover"
            @click.stop="emit('go', row.path, row.place, entry.pane)"
          >
            <component :is="hitIcon(entry)" class="size-3.5" aria-hidden="true" />
          </button>
        </template>
        <button
          type="button"
          :title="DISMISS_LABEL"
          :aria-label="DISMISS_LABEL"
          class="invisible shrink-0 rounded p-0.5 group-hover:visible group-aria-selected:visible hover:bg-hover"
          @mousedown.prevent
          @click.stop="dismiss(row)"
        >
          <XIcon class="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
