<script setup lang="ts">
import type { Component } from "vue";
import ChevronDown from "~icons/lucide/chevron-down";
import ChevronRight from "~icons/lucide/chevron-right";

import { fileIcon } from "./fileIcon";
import FileMark from "./FileMark.vue";
import type { TreeRow } from "./fileTree";
import { folderIcon } from "./folderIcon";

defineProps<{ rows: readonly TreeRow[]; active: string | null }>();
const emit = defineEmits<{ select: [path: string]; toggle: [path: string] }>();

const ROW_PADDING_PX = 8;
const INDENT_PX = 8;
const TWISTIE_CENTRE_PX = 8;

function rowIcon(row: TreeRow): Component {
  switch (row.kind) {
    case "folder":
      return folderIcon(row.path, row.open);
    case "file":
      return fileIcon(row.file.path);
  }
}

function rowStart(depth: number): number {
  return ROW_PADDING_PX + depth * INDENT_PX;
}

function rowPadding(depth: number): string {
  return `${rowStart(depth)}px`;
}

function guideLeft(level: number): string {
  return `${rowStart(level - 1) + TWISTIE_CENTRE_PX}px`;
}

function pressed(row: TreeRow): void {
  switch (row.kind) {
    case "folder":
      emit("toggle", row.path);
      break;
    case "file":
      emit("select", row.file.path);
      break;
  }
}
</script>

<template>
  <ul
    role="tree"
    aria-label="Conflicted files"
    class="group mr-0.5 flex-1 overflow-y-auto rounded-b-island opaque-scroller"
  >
    <li
      v-for="row in rows"
      :key="row.kind === 'folder' ? `folder:${row.path}` : row.file.path"
      role="treeitem"
      :aria-level="row.depth + 1"
      :aria-expanded="row.kind === 'folder' ? row.open : undefined"
      :aria-selected="row.kind === 'file' ? row.file.path === active : undefined"
      class="relative mx-1 flex cursor-default items-center gap-2 rounded py-1 pr-2 hover:bg-row-hover aria-selected:bg-row-selected"
      :style="{ paddingLeft: rowPadding(row.depth) }"
      @click="pressed(row)"
    >
      <span
        v-for="level in row.depth"
        :key="level"
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 w-px bg-control-border opacity-0 transition-opacity duration-100 group-hover:opacity-100"
        :style="{ left: guideLeft(level) }"
      />
      <span class="flex size-4 shrink-0 items-center justify-center text-fg-muted">
        <template v-if="row.kind === 'folder'">
          <ChevronDown v-if="row.open" class="size-4" aria-hidden="true" />
          <ChevronRight v-else class="size-4" aria-hidden="true" />
        </template>
      </span>
      <component :is="rowIcon(row)" class="size-4 shrink-0" aria-hidden="true" />
      <span
        class="truncate"
        :class="{ 'text-fg-muted': row.kind === 'file' && row.file.status === 'Resolved' }"
      >
        {{ row.label }}
      </span>
      <FileMark v-if="row.kind === 'file'" :status="row.file.status" />
    </li>
  </ul>
</template>
