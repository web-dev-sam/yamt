<script setup lang="ts" generic="P extends string">
import { useVirtualList } from "@vueuse/core";
import { computed, shallowRef, type Component } from "vue";
import ChevronDown from "~icons/lucide/chevron-down";
import ChevronRight from "~icons/lucide/chevron-right";
import XIcon from "~icons/lucide/x";

import type { ListRow, PaneEntry, Place, PlaceKey } from "../search";
import { fileIcon } from "./fileIcon";
import { PANE_ICONS } from "./searchIcons";
import type { SearchPaneInfo } from "./searching";
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
const PLACE_INDENT_PX = 28;

const activeKey = shallowRef<string | null>(null);

const rows = computed(() => props.rows);
const { list, containerProps, wrapperProps } = useVirtualList(rows, {
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
  const row = props.rows[Math.min(Math.max(index, 0), props.rows.length - 1)];
  if (row !== undefined) {
    activeKey.value = rowKey(row);
    keepInView(props.rows.indexOf(row));
  }
}

function groupIndexOf(path: string): number {
  return props.rows.findIndex((row) => row.kind === "group" && row.path === path);
}

function sideways(row: Row, opening: boolean): void {
  if (row.kind === "place") {
    if (!opening) {
      activate(groupIndexOf(row.path));
    }
    return;
  }
  if (row.open !== opening) {
    emit("toggle", row.path);
  } else if (opening) {
    activate(groupIndexOf(row.path) + 1);
  }
}

function keydown(event: KeyboardEvent): void {
  const index = activeIndex.value ?? -1;
  const row = props.rows[index];
  const moves: Readonly<Record<string, () => void>> = {
    ArrowDown: () => {
      activate(index + 1);
    },
    ArrowUp: () => {
      activate(index - 1);
    },
    ArrowLeft: () => {
      if (row !== undefined) {
        sideways(row, false);
      }
    },
    ArrowRight: () => {
      if (row !== undefined) {
        sideways(row, true);
      }
    },
    Enter: () => {
      if (row !== undefined) {
        pressed(row);
      }
    },
  };
  const move = moves[event.key];
  if (move !== undefined) {
    event.preventDefault();
    move();
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
    v-bind="containerProps"
    role="tree"
    tabindex="0"
    :aria-label="RESULTS_LABEL"
    class="group/list mr-0.5 min-h-0 flex-1 rounded-b-island opaque-sidebar-scroller outline-none"
    @keydown="keydown"
  >
    <div v-bind="wrapperProps">
      <div
        v-for="{ data: row } in list"
        :key="rowKey(row)"
        role="treeitem"
        :aria-level="row.kind === 'group' ? 1 : 2"
        :aria-expanded="row.kind === 'group' ? row.open : undefined"
        :aria-selected="rowKey(row) === activeKey"
        class="group mx-1 flex cursor-default items-center gap-1.5 rounded pr-1 pl-2 hover:bg-row-hover aria-selected:bg-row-selected"
        :style="{
          height: `${ROW_HEIGHT_PX}px`,
          paddingLeft: row.kind === 'place' ? `${PLACE_INDENT_PX}px` : undefined,
        }"
        @click="pressed(row)"
      >
        <template v-if="row.kind === 'group'">
          <span class="flex size-4 shrink-0 items-center justify-center text-fg-muted">
            <ChevronDown v-if="row.open" class="size-4" aria-hidden="true" />
            <ChevronRight v-else class="size-4" aria-hidden="true" />
          </span>
          <component :is="fileIcon(row.path)" class="size-4 shrink-0" aria-hidden="true" />
          <span class="shrink-0">{{ fileName(row.path) }}</span>
          <span class="min-w-0 flex-1 truncate text-fg-muted">{{ folderOf(row.path) }}</span>
          <span class="shrink-0 rounded-full bg-hover px-1.5 text-xs">{{ row.count }}</span>
        </template>
        <template v-else>
          <span class="flex min-w-0 flex-1 overflow-hidden whitespace-pre">
            <span class="shrink-0">{{ row.place.preview.before }}</span>
            <mark class="shrink-0 rounded-sm bg-search-match text-inherit">{{
              row.place.preview.match
            }}</mark>
            <span class="truncate">{{ row.place.preview.after }}</span>
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
