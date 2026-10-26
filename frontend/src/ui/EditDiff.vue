<script setup lang="ts">
import { shallowRef, watch } from "vue";
import ChevronRight from "~icons/lucide/chevron-right";

import type { AgentClient, EditDiff, FileEdit } from "../agent";
import { diffFailureText, editTitle, LOADING_DIFF_TEXT, TOO_LARGE_TEXT } from "./aiText";
import { createdFileLines, diffRowCells, editDiffLines, type DiffRow } from "./editDiffLines";

type ShownRow = { readonly tone: string; readonly cells: ReturnType<typeof diffRowCells> };

type Shown =
  | { readonly kind: "loading" }
  | { readonly kind: "rows"; readonly rows: readonly ShownRow[] }
  | { readonly kind: "note"; readonly text: string };

const props = defineProps<{ edit: FileEdit; client: Pick<AgentClient, "editDiff"> }>();

const ROW_CLASSES: Readonly<Record<DiffRow["kind"], string>> = {
  context: "",
  removed: "bg-chunk-deleted",
  added: "bg-chunk-inserted",
  noNewline: "text-fg-muted",
  skipped: "text-fg-muted",
  more: "text-fg-muted",
};

const opened = shallowRef(false);
const shown = shallowRef<Shown | null>(null);

watch(
  () => props.edit,
  (edit) => {
    shown.value = null;
    if (opened.value) {
      void load(edit);
    }
  },
);

function rowsShown(rows: readonly DiffRow[]): Shown {
  return {
    kind: "rows",
    rows: rows.map((row) => ({ tone: ROW_CLASSES[row.kind], cells: diffRowCells(row) })),
  };
}

function shownOf(edit: FileEdit, diff: EditDiff): Shown {
  switch (diff.kind) {
    case "differences":
      return rowsShown(editDiffLines(edit.oldText ?? "", edit.newText, diff.differences));
    case "tooLarge":
      return { kind: "note", text: TOO_LARGE_TEXT };
    case "appFailed":
    case "failed":
      return { kind: "note", text: diffFailureText(diff, navigator.platform) };
    default: {
      const _exhaustive: never = diff;
      return _exhaustive;
    }
  }
}

async function load(edit: FileEdit): Promise<void> {
  if (edit.oldText === null) {
    shown.value = rowsShown(createdFileLines(edit.newText));
    return;
  }
  shown.value = { kind: "loading" };
  const diff = await props.client.editDiff(edit);
  if (props.edit === edit) {
    shown.value = shownOf(edit, diff);
  }
}

function toggle(): void {
  opened.value = !opened.value;
  if (opened.value && shown.value === null) {
    void load(props.edit);
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1">
    <button
      type="button"
      :aria-expanded="opened"
      class="flex min-w-0 items-center gap-1 self-start rounded px-1 py-0.5 text-left hover:bg-hover"
      @click="toggle"
    >
      <ChevronRight
        class="size-3.5 shrink-0 transition-transform"
        :class="{ 'rotate-90': opened }"
        aria-hidden="true"
      />
      <span class="min-w-0 font-mono break-all">{{ editTitle(edit) }}</span>
    </button>
    <template v-if="opened && shown !== null">
      <p v-if="shown.kind === 'loading'" class="pl-5 text-fg-muted">{{ LOADING_DIFF_TEXT }}</p>
      <p v-else-if="shown.kind === 'note'" class="pl-5 text-fg-muted">{{ shown.text }}</p>
      <div
        v-else
        class="max-h-96 overflow-auto rounded border border-control-border opaque-scroller font-mono"
      >
        <div
          v-for="({ tone, cells }, index) in shown.rows"
          :key="index"
          class="grid min-w-max grid-cols-[3.5rem_3.5rem_1.25rem_auto_auto] whitespace-pre"
          :class="tone"
        >
          <span class="pr-2 text-right text-fg-muted select-none">{{ cells.old }}</span>
          <span class="pr-2 text-right text-fg-muted select-none">{{ cells.new }}</span>
          <span class="select-none">{{ cells.sign }}</span>
          <span class="pr-2">{{ cells.text }}</span>
          <span class="pr-2 text-fg-muted italic select-none">{{ cells.note }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
